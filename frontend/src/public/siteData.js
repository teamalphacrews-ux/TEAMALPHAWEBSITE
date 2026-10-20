const image = (src, alt, width, height) => {
  const name = src.split("/").at(-1).split(".")[0];
  return {
    src: `/assets/editorial/${name}-1280.webp`,
    srcSet: `/assets/editorial/${name}-640.webp ${Math.min(640, width)}w, /assets/editorial/${name}-1280.webp ${Math.min(1280, width)}w`,
    alt,
    width: Math.min(1280, width),
    height: Math.round((height * Math.min(1280, width)) / width),
  };
};

// Only media already supplied for the public website belongs in this fallback.
// These are editorial collections, not invented client weddings or venues.
export const defaultSiteContent = {
  site: {
    name: "Team Alpha",
    tagline: "The Wedding Artist",
    city: "Bengaluru",
    phone: "+919110603953",
    email: "Teamalphacrews@gmail.com",
    instagram: "https://instagram.com/teamalpha_crew",
    whatsapp: "https://wa.me/919110603953",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Team+Alpha+Photography+Bengaluru",
  },
  categories: [
    { id: "wedding", label: "Wedding Stories" },
    { id: "pre-wedding", label: "Pre-Wedding" },
    { id: "engagement", label: "Engagements" },
    { id: "intimate", label: "Intimate Weddings" },
    { id: "destination", label: "Destination Weddings" },
    { id: "films", label: "Wedding Films" },
  ],
  stories: [
    {
      id: "wedding-editorial",
      slug: "wedding-editorial",
      title: "The wedding edit",
      category: "wedding",
      featured: true,
      cover: "/assets/editorial/wedding-1280.webp",
      intro:
        "A selection from our wedding photography. Fleeting gestures, quiet anticipation and the people who make the day yours.",
      images: [
        image(
          "/assets/services/wedding.jpg",
          "A wedding portrait from the Team Alpha collection",
          1920,
          2878,
        ),
        image(
          "/assets/studio-wedding.webp",
          "An intimate wedding moment photographed by Team Alpha",
          1400,
          2099,
        ),
        image(
          "/assets/services/haldi.jpg",
          "Colour and celebration in the Team Alpha wedding collection",
          1920,
          2878,
        ),
      ],
    },
    {
      id: "pre-wedding-editorial",
      slug: "before-the-beginning",
      title: "Before the beginning",
      category: "pre-wedding",
      featured: true,
      cover: "/assets/editorial/pre_wedding-1280.webp",
      intro:
        "Time to be yourselves. An editorial collection of pre-wedding portraits, made with a little space for spontaneity.",
      images: [
        image(
          "/assets/services/pre_wedding.jpg",
          "A pre-wedding portrait from the Team Alpha collection",
          1920,
          2880,
        ),
        image(
          "/assets/studio-pre-wedding.webp",
          "A couple portrait photographed by Team Alpha",
          1100,
          1650,
        ),
      ],
    },
    {
      id: "engagement-editorial",
      slug: "a-promise-in-frame",
      title: "A promise in frame",
      category: "engagement",
      featured: true,
      cover: "/assets/editorial/engagement-1280.webp",
      intro:
        "The start of something beautifully personal. A selection of engagement imagery from the Team Alpha archive.",
      images: [
        image(
          "/assets/services/engagement.jpg",
          "An engagement photograph from the Team Alpha collection",
          1920,
          1280,
        ),
      ],
    },
  ],
  films: [],
  sections: {
    intro: true,
    portfolio: true,
    films: true,
    experience: true,
    reviews: true,
    collections: true,
    enquiry: true,
  },
  sectionOrder: [
    "intro",
    "portfolio",
    "films",
    "experience",
    "reviews",
    "collections",
    "enquiry",
  ],
};

const text = (value, limit = 500) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
const identifier = (value) =>
  /^[a-z0-9][a-z0-9-]{0,79}$/.test(value || "") ? value : "";
const safeUrl = (value, local = false) => {
  if (typeof value !== "string" || value.length > 2048) return "";
  if (
    local &&
    /^\/(?!\/)[^\s\\]*$/.test(value) &&
    !/(?:^|\/)\.\.(?:\/|$)/.test(value)
  )
    return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
};
const list = (value) => (Array.isArray(value) ? value : []);
const safeSrcSet = (value) =>
  typeof value === "string"
    ? value
        .split(",")
        .slice(0, 6)
        .map((candidate) => {
          const match = /^(\S+)\s+(\d{2,5})w$/.exec(candidate.trim());
          return match && safeUrl(match[1], true)
            ? `${safeUrl(match[1], true)} ${match[2]}w`
            : "";
        })
        .filter(Boolean)
        .join(", ")
    : "";

// A strict projection protects the public boundary even if a manifest includes
// operational fields by mistake. A story/film must be explicitly published.
export function projectSiteContent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return defaultSiteContent;
  const rawSite =
    input.site && typeof input.site === "object" ? input.site : {};
  const site = { ...defaultSiteContent.site };
  for (const key of ["name", "tagline", "city"])
    if (text(rawSite[key], 120)) site[key] = text(rawSite[key], 120);
  if (/^\+?[\d ()-]{7,24}$/.test(rawSite.phone || ""))
    site.phone = rawSite.phone;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSite.email || ""))
    site.email = text(rawSite.email, 254);
  for (const key of ["instagram", "whatsapp", "googleMapsUrl"])
    if (safeUrl(rawSite[key])) site[key] = safeUrl(rawSite[key]);
  const categories = list(input.categories)
    .slice(0, 20)
    .filter((item) => identifier(item?.id) && text(item?.label, 80))
    .map((item) => ({ id: identifier(item.id), label: text(item.label, 80) }));
  const categoryIds = new Set(
    (categories.length ? categories : defaultSiteContent.categories).map(
      (item) => item.id,
    ),
  );
  const stories = list(input.stories)
    .slice(0, 100)
    .filter(
      (item) =>
        item?.published === true &&
        identifier(item.id) &&
        identifier(item.slug) &&
        categoryIds.has(item.category),
    )
    .map((item) => {
      const images = list(item.images)
        .slice(0, 100)
        .filter((img) => img?.approved === true && safeUrl(img.src, true))
        .map((img) => ({
          src: safeUrl(img.src, true),
          alt: text(img.alt, 240) || "Team Alpha wedding photograph",
          ...(safeSrcSet(img.srcSet) ? { srcSet: safeSrcSet(img.srcSet) } : {}),
          width:
            Number.isInteger(img.width) && img.width > 0 && img.width <= 20000
              ? img.width
              : undefined,
          height:
            Number.isInteger(img.height) &&
            img.height > 0 &&
            img.height <= 20000
              ? img.height
              : undefined,
        }));
      return {
        id: identifier(item.id),
        slug: identifier(item.slug),
        title: text(item.title, 140),
        category: item.category,
        featured: item.featured !== false,
        cover: images.some((img) => img.src === safeUrl(item.cover, true))
          ? safeUrl(item.cover, true)
          : images[0]?.src || "",
        images,
        intro: text(item.intro, 2000),
        ...(item.locationApproved === true && text(item.location, 200)
          ? { location: text(item.location, 200) }
          : {}),
        ...(safeUrl(item.film) ? { film: safeUrl(item.film) } : {}),
      };
    })
    .filter((item) => item.title && item.cover && item.images.length);
  const films = list(input.films)
    .slice(0, 50)
    .filter(
      (item) =>
        item?.published === true &&
        identifier(item.id) &&
        safeUrl(item.url) &&
        safeUrl(item.poster, true),
    )
    .map((item) => ({
      id: identifier(item.id),
      title: text(item.title, 140),
      poster: safeUrl(item.poster, true),
      url: safeUrl(item.url),
    }))
    .filter((item) => item.title);
  const sections = { ...defaultSiteContent.sections };
  for (const key of Object.keys(sections))
    if (typeof input.sections?.[key] === "boolean")
      sections[key] = input.sections[key];
  const selectedOrder = [
    ...new Set(
      list(input.sectionOrder).filter((key) => Object.hasOwn(sections, key)),
    ),
  ];
  return {
    site,
    categories: categories.length ? categories : defaultSiteContent.categories,
    stories,
    films,
    sections,
    sectionOrder: [
      ...selectedOrder,
      ...Object.keys(sections).filter((key) => !selectedOrder.includes(key)),
    ],
  };
}
