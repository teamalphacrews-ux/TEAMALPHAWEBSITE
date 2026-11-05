import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWebsiteRouter } from "../website-server.mjs";
import {
  defaultSiteContent,
  projectSiteContent,
} from "../src/public/siteData.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const validForm = () => ({
  name: "Sample enquiry",
  email: "sample@example.test",
  phone: "+919800000001",
  eventType: "Wedding",
  eventDate: "2027-02-14",
  eventCity: "Bengaluru",
  venue: "To be confirmed",
  coverage: ["Photography", "Cinematography"],
  deliverables: ["Album", "Cinematic film"],
  budget: "₹1,50,000 – ₹2,50,000",
  details: "Please discuss coverage with us.",
  source: "/stories/wedding-editorial",
  startedAt: Date.now() - 3000,
  website: "",
});
const key = "sample_request_123456";
const configuredEnv = {
  WEBSITE_ENQUIRY_WEBHOOK_URL:
    "https://api.example.test/api/webhooks/enquiries",
  WEBSITE_ENQUIRY_WEBHOOK_SECRET: "s".repeat(40),
};

async function withApp(options, run) {
  const app = express();
  if (options?.trustProxy) app.set("trust proxy", "loopback");
  app.use("/api/website", createWebsiteRouter(options));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = (path, headers = {}) =>
    fetch(`${origin}/api/website${path}`, { headers });
  const post = (body, headers = {}) =>
    fetch(`${origin}/api/website/enquiries`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  try {
    await run({ get, post, origin });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("public manifest projection never exposes unpublished/private records or unsafe URLs", () => {
  const content = projectSiteContent({
    site: { name: "Team Alpha", apiKey: "private", phone: "+919110603953" },
    categories: [{ id: "wedding", label: "Weddings", internalId: "private" }],
    stories: [
      {
        id: "private-client",
        slug: "private-client",
        published: false,
        title: "Private client",
        category: "wedding",
        images: [{ approved: true, src: "/private.jpg" }],
      },
      {
        id: "public-story",
        slug: "public-story",
        published: true,
        title: "Wedding edit",
        category: "wedding",
        cover: "/unapproved.jpg",
        clientEmail: "private@example.test",
        invoice: { total: 999 },
        location: "Private venue",
        images: [
          { approved: false, src: "/private.jpg" },
          { approved: true, src: "javascript:alert(1)" },
          {
            approved: true,
            src: "/public.webp",
            alt: "Wedding portrait",
            srcSet: "/public-small.webp 640w, javascript:alert(1) 1280w",
            notes: "private",
          },
        ],
      },
    ],
    films: [
      {
        id: "private-film",
        published: false,
        url: "https://example.test/private.mp4",
        poster: "/public.webp",
      },
      {
        id: "public-film",
        published: true,
        title: "A film",
        url: "https://example.test/film.mp4",
        poster: "/public.webp",
        private: "secret",
      },
    ],
    sections: { reviews: false },
    sectionOrder: ["enquiry", "enquiry", "private"],
  });
  assert.equal(content.stories.length, 1);
  assert.equal(content.stories[0].cover, "/public.webp");
  assert.equal(content.stories[0].images[0].srcSet, "/public-small.webp 640w");
  assert.equal(content.sections.reviews, false);
  assert.equal(content.sectionOrder[0], "enquiry");
  assert.equal(content.films.length, 1);
  const output = JSON.stringify(content);
  assert.ok(
    !output.includes("private") &&
      !output.includes("javascript") &&
      !output.includes("unapproved"),
  );
});

test("publication keeps featured false without hiding a published story from the full portfolio", () => {
  const makeStory = (id, featured) => ({
    id,
    slug: id,
    published: true,
    title: id,
    category: "wedding",
    featured,
    images: [{ approved: true, src: "/public.webp", alt: "Public photograph" }],
  });
  const content = projectSiteContent({
    stories: [
      makeStory("featured-story", true),
      makeStory("portfolio-only", false),
      makeStory("default-featured", undefined),
    ],
  });
  assert.equal(content.stories.length, 3);
  assert.equal(
    content.stories.find((story) => story.id === "portfolio-only").featured,
    false,
  );
  assert.deepEqual(
    content.stories.filter((story) => story.featured).map((story) => story.id),
    ["featured-story", "default-featured"],
  );
});

test("default and static publication responsive descriptors match the actual optimized image pixels", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/site-content.json", import.meta.url),
      "utf8",
    ),
  );
  const metadata = new Map();
  for (const content of [defaultSiteContent, manifest]) {
    for (const story of content.stories) {
      assert.equal(typeof story.featured, "boolean");
      if (content === manifest) assert.equal(story.published, true);
      for (const image of story.images) {
        if (content === manifest) assert.equal(image.approved, true);
        for (const candidate of image.srcSet.split(",")) {
          const [src, descriptor] = candidate.trim().split(/\s+/);
          if (!metadata.has(src))
            metadata.set(
              src,
              await sharp(
                await readFile(new URL(`../public${src}`, import.meta.url)),
              ).metadata(),
            );
          assert.equal(
            Number.parseInt(descriptor, 10),
            metadata.get(src).width,
            src,
          );
        }
        const actual = metadata.get(image.src);
        assert.equal(image.width, actual.width);
        assert.equal(image.height, actual.height);
      }
    }
  }
});

test("content defaults are public editorial collections; remote publishing requires HTTPS exact host allowlist", async () => {
  let calls = 0;
  await withApp(
    {
      env: {},
      fetchImpl: async () => {
        calls += 1;
        throw new Error("Network must not be used");
      },
    },
    async ({ get }) => {
      const response = await get("/content");
      const body = await response.json();
      assert.equal(body.site.name, "Team Alpha");
      assert.equal(body.stories[0].title, "The wedding edit");
      assert.deepEqual(body.films, []);
    },
  );
  for (const url of [
    "https://private.example.test/manifest.json",
    "http://approved.example.test/manifest.json",
    "https://127.0.0.1/manifest.json",
    "https://user:password@approved.example.test/manifest.json",
  ]) {
    await withApp(
      {
        env: {
          WEBSITE_CONTENT_URL: url,
          WEBSITE_CONTENT_ALLOWED_HOSTS: "approved.example.test,127.0.0.1",
        },
        fetchImpl: async () => {
          calls += 1;
          throw new Error("Must not fetch rejected host");
        },
      },
      async ({ get }) => assert.equal((await get("/content")).status, 503),
    );
  }
  assert.equal(calls, 0);
});

test("allowlisted public content is projected without attaching studio credentials", async () => {
  let request;
  await withApp(
    {
      env: {
        WEBSITE_CONTENT_URL: "https://content.example.test/public.json",
        WEBSITE_CONTENT_ALLOWED_HOSTS: "content.example.test",
        ADMIN_TOKEN: "private",
      },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return jsonResponse({
          site: { name: "Published studio" },
          stories: [],
          sections: { reviews: false },
        });
      },
    },
    async ({ get }) => {
      const body = await (await get("/content")).json();
      assert.equal(body.site.name, "Published studio");
      assert.equal(body.sections.reviews, false);
      assert.equal(request.options.headers.Authorization, undefined);
      assert.equal(request.options.redirect, "error");
    },
  );
});

test("missing or disabled Google configuration returns no reviews and never invents a rating", async () => {
  for (const env of [
    {},
    {
      WEBSITE_REVIEWS_ENABLED: "false",
      GOOGLE_PLACES_API_KEY: "private",
      GOOGLE_PLACE_ID: "place_123",
    },
  ]) {
    await withApp(
      {
        env,
        fetchImpl: async () => {
          throw new Error("No external request expected");
        },
      },
      async ({ get }) => {
        const response = await get("/reviews");
        assert.equal(
          response.headers.get("cache-control"),
          "no-store, max-age=0",
        );
        assert.deepEqual(await response.json(), {
          configured: false,
          reviews: [],
        });
      },
    );
  }
});

test("Google reviews preserve author/source/provider attribution, restrict fields and do not cache responses", async () => {
  let calls = 0;
  const google = {
    displayName: { text: "Team Alpha" },
    rating: 4.9,
    userRatingCount: 124,
    googleMapsUri: "https://maps.google.com/?cid=123",
    privateToken: "never expose",
    attributions: [
      { provider: "Google Maps", providerUri: "https://maps.google.com/" },
    ],
    reviews: [
      {
        name: "places/id/reviews/id",
        rating: 5,
        text: { text: "A genuine API review", languageCode: "en" },
        originalText: { text: "A genuine API review" },
        publishTime: "2026-10-01T00:00:00Z",
        relativePublishTimeDescription: "a month ago",
        googleMapsUri: "https://maps.google.com/review?id=123",
        authorAttribution: {
          displayName: "API author",
          uri: "https://maps.google.com/contributor/123",
          photoUri: "https://example.test/author.jpg",
        },
        internal: "never expose",
      },
    ],
  };
  await withApp(
    {
      env: {
        GOOGLE_PLACES_API_KEY: "private-key",
        GOOGLE_PLACE_ID: "place_123",
      },
      fetchImpl: async (url, options) => {
        calls += 1;
        assert.match(
          url,
          /^https:\/\/places\.googleapis\.com\/v1\/places\/place_123\?languageCode=en$/,
        );
        assert.equal(options.headers["X-Goog-Api-Key"], "private-key");
        assert.ok(options.headers["X-Goog-FieldMask"].includes("attributions"));
        return jsonResponse(google);
      },
    },
    async ({ get }) => {
      for (let index = 0; index < 2; index++) {
        const response = await get("/reviews");
        const body = await response.json();
        assert.equal(
          body.reviews[0].authorAttribution.displayName,
          "API author",
        );
        assert.equal(
          body.reviews[0].googleMapsUri,
          google.reviews[0].googleMapsUri,
        );
        assert.deepEqual(body.attributions, google.attributions);
        assert.ok(
          !JSON.stringify(body).includes("private") &&
            !JSON.stringify(body).includes("internal"),
        );
        assert.equal(
          response.headers.get("cache-control"),
          "no-store, max-age=0",
        );
      }
    },
  );
  assert.equal(calls, 2);
});

test("Google upstream failure and rate guard never leak credentials or upstream errors", async () => {
  let calls = 0;
  await withApp(
    {
      env: {
        GOOGLE_PLACES_API_KEY: "private-key",
        GOOGLE_PLACE_ID: "place_123",
      },
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: "private-key billing error" }, 403);
      },
    },
    async ({ get }) => {
      for (let index = 0; index < 16; index++) {
        const response = await get("/reviews");
        assert.equal(response.status, index === 15 ? 429 : 503);
        assert.ok(
          !JSON.stringify(await response.json()).includes("private-key"),
        );
      }
    },
  );
  assert.equal(calls, 15);
});

test("enquiry guards reject cross-origin, honeypot, rapid, invalid date and unsupported fields before upstream", async () => {
  let calls = 0;
  await withApp(
    {
      env: configuredEnv,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ success: true });
      },
    },
    async ({ post }) => {
      assert.equal(
        (await post(validForm(), { Origin: "https://other.example.test" }))
          .status,
        403,
      );
      assert.equal((await post(validForm(), { Origin: "" })).status, 403);
      assert.equal(
        (await post({ ...validForm(), website: "spam" })).status,
        400,
      );
      assert.equal(
        (await post({ ...validForm(), startedAt: Date.now() })).status,
        400,
      );
      assert.equal(
        (await post({ ...validForm(), eventDate: "2027-02-30" })).status,
        400,
      );
      assert.equal((await post({ ...validForm(), role: "Admin" })).status, 400);
      assert.equal(
        (await post(validForm(), { "Idempotency-Key": "short" })).status,
        400,
      );
    },
  );
  assert.equal(calls, 0);
});

test("enquiries with missing credentials report unavailable, never false success", async () => {
  await withApp(
    {
      env: {},
      fetchImpl: async () => {
        throw new Error("Must not run");
      },
    },
    async ({ post }) => {
      const response = await post(validForm());
      assert.equal(response.status, 503);
      assert.ok((await response.json()).error.includes("contact"));
    },
  );
});

test("enquiry proxy preserves CRM fields and stable idempotency, hides secrets and lead IDs", async () => {
  const requests = [];
  await withApp(
    {
      env: configuredEnv,
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return jsonResponse({
          success: true,
          duplicate: requests.length > 1,
          leadId: "private-database-id",
        });
      },
    },
    async ({ post }) => {
      const form = { ...validForm(), requestId: key };
      for (let index = 0; index < 2; index++) {
        const response = await post(form);
        assert.equal(response.status, index ? 200 : 201);
        assert.deepEqual(await response.json(), {
          success: true,
          duplicate: !!index,
        });
      }
      const changed = await post({ ...form, name: "Changed name" });
      assert.equal(changed.status, 409);
    },
  );
  assert.equal(requests.length, 2);
  const request = requests[0];
  assert.equal(
    request.options.headers.Authorization,
    `Bearer ${configuredEnv.WEBSITE_ENQUIRY_WEBHOOK_SECRET}`,
  );
  assert.equal(request.options.headers["Idempotency-Key"], `website:${key}`);
  assert.equal(
    requests[1].options.headers["Idempotency-Key"],
    `website:${key}`,
  );
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(
    Object.keys(payload).sort(),
    [
      "name",
      "email",
      "phone",
      "eventType",
      "eventDate",
      "eventLocation",
      "notes",
    ].sort(),
  );
  assert.equal(payload.eventLocation, "Bengaluru");
  for (const text of [
    "Source: Team Alpha public website",
    "Venue: To be confirmed",
    "Photography, Cinematography",
    "Album, Cinematic film",
    "₹1,50,000",
    "/stories/wedding-editorial",
    "not confirmed",
  ])
    assert.ok(payload.notes.includes(text));
  assert.ok(payload.notes.length <= 4000);
});

test("enquiry rate guard bounds new submissions but a failed retry retains the receipt", async () => {
  let calls = 0;
  await withApp(
    {
      env: configuredEnv,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ secret: "upstream private details" }, 503);
      },
    },
    async ({ post }) => {
      const form = validForm();
      for (let index = 0; index < 6; index++) {
        const response = await post(form, {
          "Idempotency-Key": `sample_request_${index}_123456`,
        });
        assert.equal(response.status, index < 5 ? 503 : 429);
        assert.ok(!JSON.stringify(await response.json()).includes("private"));
      }
      assert.equal(
        (await post(form, { "Idempotency-Key": "sample_request_0_123456" }))
          .status,
        503,
      );
    },
  );
  assert.equal(calls, 6);
});

test("large and malformed JSON return bounded client-safe errors", async () => {
  await withApp({ env: configuredEnv }, async ({ post, origin }) => {
    const response = await post({ ...validForm(), details: "x".repeat(20000) });
    assert.equal(response.status, 413);
    assert.ok(!(await response.text()).includes("stack"));
    const malformed = await fetch(`${origin}/api/website/enquiries`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: '{"name":',
    });
    assert.equal(malformed.status, 400);
    assert.ok(!(await malformed.text()).includes("SyntaxError"));
  });
});

test("repeated receipt retries are also rate bounded", async () => {
  let calls = 0;
  await withApp(
    {
      env: configuredEnv,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ success: true, duplicate: true });
      },
    },
    async ({ post }) => {
      const form = validForm();
      for (let index = 0; index < 21; index++)
        assert.equal((await post(form)).status, index < 20 ? 200 : 429);
    },
  );
  assert.equal(calls, 20);
});

test("production enquiries require an explicit HTTPS canonical origin and ignore forged forwarding headers", async () => {
  let calls = 0;
  for (const canonical of [
    undefined,
    "http://studio.example.test",
    "https://studio.example.test/path",
  ]) {
    await withApp(
      {
        env: {
          ...configuredEnv,
          NODE_ENV: "production",
          ...(canonical ? { WEBSITE_PUBLIC_ORIGIN: canonical } : {}),
        },
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse({ success: true });
        },
      },
      async ({ post }) => {
        assert.equal((await post(validForm())).status, 503);
      },
    );
  }
  await withApp(
    {
      env: {
        ...configuredEnv,
        NODE_ENV: "production",
        WEBSITE_PUBLIC_ORIGIN: "https://studio.example.test",
      },
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ success: true });
      },
    },
    async ({ post }) => {
      assert.equal(
        (
          await post(validForm(), {
            Origin: "https://wrong.example.test",
            "X-Forwarded-Host": "studio.example.test",
            "X-Forwarded-Proto": "https",
          })
        ).status,
        403,
      );
      assert.equal(
        (await post(validForm(), { Origin: "https://studio.example.test" }))
          .status,
        201,
      );
    },
  );
  assert.equal(calls, 1);
});

test("Google requests have a global budget even across distinct trusted client addresses", async () => {
  let calls = 0;
  await withApp(
    {
      trustProxy: true,
      env: {
        GOOGLE_PLACES_API_KEY: "private-key",
        GOOGLE_PLACE_ID: "place_123",
      },
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ reviews: [] });
      },
    },
    async ({ get }) => {
      for (let index = 0; index < 61; index++) {
        const response = await get("/reviews", {
          "X-Forwarded-For": `203.0.113.${index + 1}`,
        });
        assert.equal(response.status, index < 60 ? 200 : 429);
      }
    },
  );
  assert.equal(calls, 60);
});
