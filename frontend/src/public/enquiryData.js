export const EVENT_TYPES = [
  "Wedding",
  "Intimate wedding",
  "Destination wedding",
  "Pre-wedding",
  "Engagement",
  "Other celebration",
];
export const COVERAGE_OPTIONS = [
  "Wedding photography",
  "Wedding cinematography",
  "Pre-wedding session",
  "Engagement coverage",
  "Multiple celebrations",
  "Destination coverage",
];
export const DELIVERABLE_OPTIONS = [
  "Edited photographs",
  "Cinematic wedding film",
  "Traditional wedding video",
  "Fine-art album",
  "Short films & reels",
];
export const BUDGET_OPTIONS = [
  "₹1,50,000 – ₹2,50,000",
  "₹2,50,000 – ₹4,00,000",
  "₹4,00,000 – ₹6,00,000",
  "₹6,00,000+",
  "I would prefer to discuss",
];
export const STEP_FIELDS = [
  ["name", "email", "phone"],
  ["eventType", "eventDate", "eventCity", "venue"],
  ["coverage", "deliverables", "budget", "details"],
];

export function emptyEnquiry() {
  return {
    name: "",
    email: "",
    phone: "",
    eventType: "",
    eventDate: "",
    datePending: false,
    eventCity: "",
    venue: "",
    coverage: [],
    deliverables: [],
    budget: "",
    details: "",
    website: "",
  };
}

export function indiaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function validEventDate(value, today = indiaToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value >= today
  );
}

export function validateEnquiry(values, step = null, today = indiaToday()) {
  const errors = {};
  const trimmed = (key) => String(values[key] || "").trim();
  if (trimmed("name").length < 2 || trimmed("name").length > 100)
    errors.name = "Please enter your full name (2–100 characters).";
  if (
    trimmed("email").length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed("email"))
  )
    errors.email = "Please enter a valid email address.";
  const phone = trimmed("phone");
  if (
    phone.length > 24 ||
    !/^\+?[\d\s().-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  )
    errors.phone = "Please enter a phone number with country code.";
  if (!EVENT_TYPES.includes(values.eventType))
    errors.eventType = "Choose the celebration you are planning.";
  if (!values.datePending && !validEventDate(values.eventDate, today))
    errors.eventDate =
      "Choose today or a future date, or select “Date not decided yet”.";
  if (trimmed("eventCity").length < 2 || trimmed("eventCity").length > 100)
    errors.eventCity = "Please enter your event city (2–100 characters).";
  if (trimmed("venue").length > 200)
    errors.venue = "Please keep the venue under 200 characters.";
  if (
    !Array.isArray(values.coverage) ||
    !values.coverage.length ||
    values.coverage.some((value) => !COVERAGE_OPTIONS.includes(value))
  )
    errors.coverage = "Choose at least one type of coverage.";
  if (
    !Array.isArray(values.deliverables) ||
    values.deliverables.some((value) => !DELIVERABLE_OPTIONS.includes(value))
  )
    errors.deliverables = "Choose from the listed deliverable preferences.";
  if (!BUDGET_OPTIONS.includes(values.budget))
    errors.budget =
      "Choose a budget range, or let us know you would prefer to discuss.";
  if (trimmed("details").length > 3000)
    errors.details = "Please keep your notes under 3,000 characters.";
  if (step === null) return errors;
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => STEP_FIELDS[step].includes(key)),
  );
}

export function createEnquiryRequestId(cryptoSource = globalThis.crypto) {
  if (!cryptoSource?.getRandomValues)
    throw new Error(
      "A secure request identifier could not be created. Please contact the studio directly.",
    );
  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  return `ta_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function enquirySource(location = globalThis.location) {
  const pathname = ["/enquire", "/quote"].includes(location?.pathname)
    ? location.pathname
    : "/enquire";
  const input = new URLSearchParams(location?.search || "");
  const source = new URLSearchParams();
  for (const key of [
    "story",
    "category",
    "collection",
    "location",
    "interest",
  ]) {
    const value = input.get(key);
    if (
      value &&
      /^[a-z\d][a-z\d _-]{0,79}$/i.test(value) &&
      !/^[a-f\d]{24,}$/i.test(value) &&
      !/^\d{7,}$/.test(value)
    )
      source.set(key, value);
  }
  return `website:${pathname}${source.size ? `?${source.toString()}` : ""}`;
}

// Keep this immutable snapshot for a retry until the visitor edits the form.
export function prepareEnquiryAttempt(
  values,
  { startedAt, source, requestId = createEnquiryRequestId() },
) {
  const clean = (key) => String(values[key] || "").trim();
  const body = {
    name: clean("name"),
    email: clean("email"),
    phone: clean("phone"),
    eventType: clean("eventType"),
    eventDate: values.datePending ? "" : clean("eventDate"),
    eventCity: clean("eventCity"),
    venue: clean("venue"),
    coverage: [...values.coverage],
    deliverables: [...values.deliverables],
    budget: clean("budget"),
    details: clean("details"),
    source,
    website: clean("website"),
    startedAt,
    requestId,
  };
  Object.freeze(body.coverage);
  Object.freeze(body.deliverables);
  return Object.freeze({
    requestId,
    body: Object.freeze(body),
    serialized: JSON.stringify(body),
  });
}
