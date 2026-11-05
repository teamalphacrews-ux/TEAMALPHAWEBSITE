import express from "express";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  defaultSiteContent,
  projectSiteContent,
} from "./src/public/siteData.js";

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};
const formFields = new Set([
  "name",
  "email",
  "phone",
  "eventType",
  "eventDate",
  "eventCity",
  "venue",
  "coverage",
  "deliverables",
  "budget",
  "details",
  "source",
  "startedAt",
  "website",
  "requestId",
]);
const fail = (status, message) => Object.assign(new Error(message), { status });
const safeHttps = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
};
const externalLink = (value) => safeHttps(value)?.href || "";

function limiter(limit, windowMs) {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    if (buckets.size >= 10000)
      for (const [id, item] of buckets)
        if (item.until <= now) buckets.delete(id);
    if (buckets.size >= 10000 && !buckets.has(key)) return false;
    let item = buckets.get(key);
    if (!item || item.until <= now) {
      item = { count: 0, until: now + windowMs };
      buckets.set(key, item);
    }
    item.count += 1;
    return item.count <= limit;
  };
}

async function boundedJson(response, limit = 1048576) {
  const length = Number(response.headers?.get?.("content-length"));
  if (length > limit) throw new Error("Response too large");
  if (!response.body?.getReader) {
    // The fallback also supports small deterministic test transports.
    const value = await response.json();
    if (JSON.stringify(value).length > limit)
      throw new Error("Response too large");
    return value;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

function publicContentUrl(env) {
  const url = safeHttps(env.WEBSITE_CONTENT_URL);
  const hosts = (env.WEBSITE_CONTENT_ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (
    !url ||
    !hosts.includes(url.hostname.toLowerCase()) ||
    (url.port && url.port !== "443")
  )
    return null;
  // Never create a route into a local/private administration API.
  if (
    /^(localhost|.*\.localhost|.*\.local|.*\.internal|\d+(?:\.\d+){3}|\[.*\])$/i.test(
      url.hostname,
    )
  )
    return null;
  return url;
}

function validateForm(body, key, now) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((field) => !formFields.has(field))
  )
    throw fail(400, "Please check the enquiry fields.");
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(key))
    throw fail(400, "Please refresh the form and try again.");
  if (body.website !== undefined && body.website !== "")
    throw fail(400, "Unable to submit this enquiry.");
  if (
    typeof body.startedAt !== "number" ||
    !Number.isFinite(body.startedAt) ||
    now - body.startedAt < 1500 ||
    now - body.startedAt > 86400000
  )
    throw fail(400, "Please take a moment to review the form before sending.");
  const text = (field, max, required = false) => {
    if (body[field] === undefined || body[field] === "") {
      if (required) throw fail(400, `Please enter your ${field}.`);
      return "";
    }
    if (
      typeof body[field] !== "string" ||
      !body[field].trim() ||
      body[field].trim().length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body[field])
    )
      throw fail(400, `Please check ${field}.`);
    return body[field].trim();
  };
  const name = text("name", 120, true);
  const email = text("email", 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw fail(400, "Please enter a valid email address.");
  const phone = text("phone", 30, true);
  if (
    !/^[+\d\s().-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  )
    throw fail(400, "Please enter a valid phone number.");
  const eventDate = text("eventDate", 10);
  if (
    eventDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      Number.isNaN(Date.parse(eventDate)) ||
      new Date(eventDate).toISOString().slice(0, 10) !== eventDate)
  )
    throw fail(400, "Please enter a valid event date.");
  const values = (field) => {
    if (body[field] === undefined) return [];
    if (
      !Array.isArray(body[field]) ||
      body[field].length > 12 ||
      body[field].some(
        (value) =>
          typeof value !== "string" ||
          !value.trim() ||
          value.length > 100 ||
          /[\u0000-\u001f]/.test(value),
      )
    )
      throw fail(400, `Please check ${field}.`);
    return [...new Set(body[field].map((value) => value.trim()))];
  };
  const eventType = text("eventType", 80, true);
  const eventLocation = text("eventCity", 200, true);
  const notes = [
    "Source: Team Alpha public website",
    text("source", 500) && `Page / collection: ${text("source", 500)}`,
    text("venue", 240) && `Venue: ${text("venue", 240)}`,
    `Coverage: ${values("coverage").join(", ") || "To discuss"}`,
    `Deliverable preferences: ${values("deliverables").join(", ") || "To discuss"}`,
    `Estimated photography and film budget: ${text("budget", 100) || "To discuss"}`,
    "Date availability: enquiry only; not confirmed",
    text("details", 3000) && `Additional details: ${text("details", 3000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  if (notes.length > 4000)
    throw fail(400, "Please shorten your enquiry details.");
  return {
    key: `website:${key}`,
    payload: {
      name,
      email,
      phone,
      eventType,
      ...(eventDate ? { eventDate } : {}),
      eventLocation,
      notes,
    },
  };
}

function webhookConfig(env) {
  let url;
  try {
    url = new URL(env.WEBSITE_ENQUIRY_WEBHOOK_URL);
  } catch {
    return null;
  }
  const localHttp =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (!safeHttps(url.href) && !localHttp) ||
    url.username ||
    url.password ||
    !/\/api\/webhooks\/enquiries\/?$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    return null;
  const secret = env.WEBSITE_ENQUIRY_WEBHOOK_SECRET;
  return typeof secret === "string" && secret.length >= 32 && !/\s/.test(secret)
    ? { url, secret }
    : null;
}

export function createWebsiteRouter({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const router = express.Router();
  const reviewLimit = limiter(15, 60000);
  const globalReviewLimit = limiter(60, 60000);
  const enquiryAttemptLimit = limiter(20, 60000);
  const enquiryLimit = limiter(5, 3600000);
  const globalEnquiryLimit = limiter(60, 60000);
  const receipts = new Map();
  router.use((req, res, next) => {
    res.set(NO_STORE);
    next();
  });

  router.get("/content", async (_req, res) => {
    try {
      if (env.WEBSITE_CONTENT_FILE) {
        const fileInfo = await stat(env.WEBSITE_CONTENT_FILE);
        if (!fileInfo.isFile() || fileInfo.size > 1048576)
          throw new Error("Manifest too large");
        const source = await readFile(env.WEBSITE_CONTENT_FILE, "utf8");
        if (source.length > 1048576) throw new Error("Manifest too large");
        return res.json(projectSiteContent(JSON.parse(source)));
      }
      if (env.WEBSITE_CONTENT_URL) {
        const url = publicContentUrl(env);
        if (!url) throw new Error("Public manifest host not allowed");
        const response = await fetchImpl(url.href, {
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) throw new Error("Manifest unavailable");
        return res.json(projectSiteContent(await boundedJson(response)));
      }
      return res.json(defaultSiteContent);
    } catch {
      return res.status(503).json({
        error: "Published website content is temporarily unavailable.",
      });
    }
  });

  router.get("/reviews", async (req, res) => {
    const enabled = env.WEBSITE_REVIEWS_ENABLED !== "false";
    const configured =
      enabled &&
      typeof env.GOOGLE_PLACES_API_KEY === "string" &&
      !!env.GOOGLE_PLACES_API_KEY.trim() &&
      /^[A-Za-z0-9_-]{5,300}$/.test(env.GOOGLE_PLACE_ID || "");
    if (!configured) return res.json({ configured: false, reviews: [] });
    if (!reviewLimit(req.ip) || !globalReviewLimit("all"))
      return res.status(429).json({
        configured: true,
        error: "Reviews are temporarily unavailable.",
        reviews: [],
      });
    try {
      const response = await fetchImpl(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}?languageCode=en`,
        {
          headers: {
            "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "displayName,rating,userRatingCount,googleMapsUri,reviews,attributions",
          },
          redirect: "error",
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!response.ok) throw new Error("Reviews unavailable");
      const data = await boundedJson(response);
      const reviews = (Array.isArray(data.reviews) ? data.reviews : [])
        .slice(0, 5)
        .map((review) => ({
          id: typeof review.name === "string" ? review.name.slice(0, 300) : "",
          rating:
            Number.isFinite(review.rating) &&
            review.rating >= 1 &&
            review.rating <= 5
              ? review.rating
              : null,
          text:
            typeof review.text?.text === "string"
              ? review.text.text.slice(0, 10000)
              : "",
          languageCode:
            typeof review.text?.languageCode === "string"
              ? review.text.languageCode.slice(0, 20)
              : "",
          originalText:
            typeof review.originalText?.text === "string"
              ? review.originalText.text.slice(0, 10000)
              : "",
          relativePublishTimeDescription:
            typeof review.relativePublishTimeDescription === "string"
              ? review.relativePublishTimeDescription.slice(0, 120)
              : "",
          publishTime:
            typeof review.publishTime === "string"
              ? review.publishTime.slice(0, 60)
              : "",
          googleMapsUri: externalLink(review.googleMapsUri),
          authorAttribution: {
            displayName:
              typeof review.authorAttribution?.displayName === "string"
                ? review.authorAttribution.displayName.slice(0, 200)
                : "",
            uri: externalLink(review.authorAttribution?.uri),
            photoUri: externalLink(review.authorAttribution?.photoUri),
          },
        }))
        .filter(
          (review) =>
            review.authorAttribution.displayName &&
            review.text &&
            review.rating !== null,
        );
      return res.json({
        configured: true,
        displayName:
          typeof data.displayName?.text === "string"
            ? data.displayName.text.slice(0, 200)
            : "Team Alpha",
        rating:
          Number.isFinite(data.rating) && data.rating >= 0 && data.rating <= 5
            ? data.rating
            : null,
        reviewCount:
          Number.isInteger(data.userRatingCount) && data.userRatingCount >= 0
            ? data.userRatingCount
            : null,
        googleMapsUri: externalLink(data.googleMapsUri),
        reviews,
        attributions: (Array.isArray(data.attributions)
          ? data.attributions
          : []
        )
          .slice(0, 20)
          .map((item) => ({
            provider:
              typeof item.provider === "string"
                ? item.provider.slice(0, 200)
                : "",
            providerUri: externalLink(item.providerUri),
          }))
          .filter((item) => item.provider),
      });
    } catch {
      return res.status(503).json({
        configured: true,
        error: "Reviews are temporarily unavailable.",
        reviews: [],
      });
    }
  });

  router.post(
    "/enquiries",
    express.json({ limit: "16kb", strict: true }),
    async (req, res) => {
      try {
        let expectedOrigin;
        try {
          const originUrl = new URL(
            env.WEBSITE_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`,
          );
          if (
            originUrl.username ||
            originUrl.password ||
            originUrl.pathname !== "/" ||
            originUrl.search ||
            originUrl.hash ||
            !["http:", "https:"].includes(originUrl.protocol) ||
            (env.NODE_ENV === "production" &&
              (!env.WEBSITE_PUBLIC_ORIGIN || originUrl.protocol !== "https:"))
          )
            throw new Error("Canonical website origin required");
          expectedOrigin = originUrl.origin;
        } catch {
          throw fail(503, "Enquiries are temporarily unavailable.");
        }
        if (
          !req.get("origin") ||
          req.get("origin") !== expectedOrigin ||
          req.get("sec-fetch-site") === "cross-site"
        )
          throw fail(
            403,
            "Please submit the form from the Team Alpha website.",
          );
        if (!req.is("application/json"))
          throw fail(415, "Please submit the enquiry form as JSON.");
        if (!enquiryAttemptLimit(req.ip))
          throw fail(
            429,
            "Please wait before retrying, or contact the studio directly.",
          );
        const { key, payload } = validateForm(
          req.body,
          req.get("idempotency-key"),
          Date.now(),
        );
        const config = webhookConfig(env);
        if (!config)
          throw fail(
            503,
            "Online enquiries are being configured. Please contact the studio directly.",
          );
        const now = Date.now();
        for (const [id, value] of receipts)
          if (now - value.at > 3600000) receipts.delete(id);
        const fingerprint = createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex");
        const receipt = receipts.get(key);
        if (receipt && receipt.hash !== fingerprint)
          throw fail(
            409,
            "This submission changed. Please start a new enquiry.",
          );
        // Retries with the same payload retain the upstream receipt key.
        if (!receipt && (!enquiryLimit(req.ip) || !globalEnquiryLimit("all")))
          throw fail(
            429,
            "Please wait before sending another enquiry, or contact the studio directly.",
          );
        if (!receipt && receipts.size >= 10000)
          throw fail(
            503,
            "Enquiries are temporarily unavailable. Please try again shortly.",
          );
        receipts.set(key, { hash: fingerprint, at: now });
        const response = await fetchImpl(config.url.href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${config.secret}`,
            "Idempotency-Key": key,
          },
          body: JSON.stringify(payload),
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          throw fail(
            503,
            "Your enquiry could not be saved. Please retry or contact the studio directly.",
          );
        const result = await boundedJson(response, 16384);
        if (result.success !== true)
          throw fail(
            503,
            "Your enquiry could not be saved. Please retry or contact the studio directly.",
          );
        return res
          .status(result.duplicate ? 200 : 201)
          .json({ success: true, duplicate: !!result.duplicate });
      } catch (error) {
        return res.status(error.status || 503).json({
          error: error.status
            ? error.message
            : "Your enquiry could not be saved. Please retry or contact the studio directly.",
        });
      }
    },
  );
  router.use((error, _req, res, _next) =>
    res
      .status(error.type === "entity.too.large" ? 413 : 400)
      .json({ error: "Please check the enquiry form and try again." }),
  );
  return router;
}
