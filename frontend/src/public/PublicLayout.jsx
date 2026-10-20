import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { SiteContentProvider, useSiteContent } from "./content";
import "./luxury.css";

const navigation = [
  ["Portfolio", "/portfolio"],
  ["Films", "/films"],
  ["The studio", "/studio"],
  ["Kind words", "/#reviews"],
  ["Studio login", "/auth"],
];

function PublicSeo() {
  const { pathname, hash } = useLocation();
  const { content } = useSiteContent();
  const path = pathname.replace(/\/+$/, "") || "/";
  const storyPath = /^\/stories\/([^/]+)$/.exec(path);
  let storySlug = storyPath?.[1] || "";
  try {
    storySlug = decodeURIComponent(storySlug);
  } catch {
    storySlug = "";
  }
  const story = content.stories?.find((entry) => entry.slug === storySlug);
  const storyTitle = story?.title || "";
  const storyIntro = story?.intro || "";
  const storyCover = story?.cover || "";

  useEffect(() => {
    const pages = {
      "/": [
        "Wedding Photography & Cinematography in Bengaluru",
        "Team Alpha · The Wedding Artist. Thoughtful wedding photography and cinematography, based in Bengaluru. Explore our work and begin your story.",
      ],
      "/portfolio": [
        "Selected Wedding Photography",
        "Explore Team Alpha’s published wedding, pre-wedding and engagement photography. Discover considered images, meaningful moments and stories worth returning to.",
      ],
      "/films": [
        "Wedding Films",
        "Discover Team Alpha wedding cinematography: the voices, movement and emotion of a celebration, thoughtfully brought together in film.",
      ],
      "/studio": [
        "The Studio",
        "Meet Team Alpha, wedding photographers and filmmakers based in Bengaluru. Discover our artists, our approach and the care behind every celebration.",
      ],
      "/collections": [
        "Signature Collections",
        "Explore Team Alpha wedding photography, cinematography, pre-wedding sessions, destination coverage and albums. Collections thoughtfully tailored to your celebration.",
      ],
      "/enquire": [
        "Begin Your Story",
        "Tell Team Alpha about your wedding date, venue, photography and film plans. Enquire about coverage and a personal proposal for your celebration.",
      ],
      "/privacy": [
        "Your Privacy",
        "Learn how Team Alpha handles wedding enquiries, contact details, published photography and external services, and how to contact the studio about your information.",
      ],
      "/terms": [
        "Website Terms",
        "Read Team Alpha’s website terms for enquiries, photography, films and external services. Booking terms and availability are agreed separately with the studio.",
      ],
      "/locations/bengaluru": [
        "Wedding Photography in Bengaluru",
        "Plan your Bengaluru wedding photography with Team Alpha. Thoughtful coverage of your ceremonies, portraits and celebrations, shaped around the people and places that matter.",
      ],
    };
    const known = Boolean(storyTitle || pages[path]);
    const page = storyTitle
      ? [
          storyTitle,
          storyIntro.replace(/\s+/g, " ").trim().slice(0, 180) ||
            `Explore ${storyTitle}, a published photography story by Team Alpha · The Wedding Artist.`,
        ]
      : pages[path] || [
          "Page not found",
          "This Team Alpha page is not available. Explore the published photography and film collections, or contact our Bengaluru studio.",
        ];
    const title = `${page[0]} · Team Alpha — The Wedding Artist`;
    const description = page[1];
    let origin = window.location.origin;
    try {
      const configured = new URL(import.meta.env.VITE_SITE_ORIGIN || "");
      if (
        configured.protocol === "https:" &&
        !configured.username &&
        !configured.password
      )
        origin = configured.origin;
    } catch {
      /* Local preview and invalid configuration use the current origin. */
    }
    const canonicalPath = storyTitle
      ? `/stories/${encodeURIComponent(storySlug)}`
      : path;
    const canonicalUrl = new URL(origin);
    canonicalUrl.pathname = canonicalPath;
    const pageUrl = canonicalUrl.href;
    let imageUrl = new URL("/team-alpha-logo.png", origin).href;
    if (storyCover) {
      try {
        const image = new URL(storyCover, origin);
        if (
          (image.protocol === "https:" ||
            (image.protocol === "http:" &&
              image.origin === window.location.origin)) &&
          !image.username &&
          !image.password
        )
          imageUrl = image.href;
      } catch {
        /* Keep the existing studio logo when an image URL is invalid. */
      }
    }
    const previousTitle = document.title;
    const restore = [];
    document.title = title;
    const setMeta = (attribute, name, value) => {
      let meta = document.head.querySelector(`meta[${attribute}="${name}"]`);
      const existing = Boolean(meta);
      const previous = meta?.getAttribute("content");
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attribute, name);
        document.head.append(meta);
      }
      meta.setAttribute("content", value);
      restore.push(() => {
        if (!existing) meta.remove();
        else if (previous === null) meta.removeAttribute("content");
        else meta.setAttribute("content", previous);
      });
    };
    setMeta("name", "description", description);
    setMeta(
      "name",
      "robots",
      known ? "index, follow, max-image-preview:large" : "noindex, follow",
    );
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", storyTitle ? "article" : "website");
    setMeta("property", "og:url", pageUrl);
    setMeta("property", "og:image", imageUrl);
    setMeta(
      "property",
      "og:image:alt",
      storyTitle || "Team Alpha · The Wedding Artist logo",
    );
    setMeta("property", "og:site_name", "Team Alpha · The Wedding Artist");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const existingCanonical = Boolean(canonical);
    const previousCanonical = canonical?.getAttribute("href");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = pageUrl;
    restore.push(() => {
      if (!existingCanonical) canonical.remove();
      else if (previousCanonical === null) canonical.removeAttribute("href");
      else canonical.setAttribute("href", previousCanonical);
    });
    const schema = document.createElement("script");
    if (known) {
      schema.type = "application/ld+json";
      schema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        name: "Team Alpha · The Wedding Artist",
        url: origin,
        description:
          "Wedding photography and cinematography in Bengaluru, India.",
        telephone: content.site?.phone,
        email: content.site?.email,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Bengaluru",
          addressCountry: "IN",
        },
        sameAs: [content.site?.instagram].filter(Boolean),
      });
      document.head.append(schema);
    }
    return () => {
      restore.forEach((undo) => undo());
      schema.remove();
      document.title = previousTitle;
    };
  }, [
    path,
    storySlug,
    storyTitle,
    storyIntro,
    storyCover,
    content.site?.phone,
    content.site?.email,
    content.site?.instagram,
  ]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) {
        let anchor = hash.slice(1);
        try {
          anchor = decodeURIComponent(anchor);
        } catch {
          /* Keep malformed fragments harmless. */
        }
        document.getElementById(anchor)?.scrollIntoView({ block: "start" });
      } else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

export function PublicHeader() {
  const location = useLocation();
  const { content } = useSiteContent();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 40);
  const dialog = useRef(null),
    launcher = useRef(null),
    closer = useRef(null);
  const links = navigation.filter(
    ([, to]) => to !== "/#reviews" || content.sections?.reviews !== false,
  );
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    const panel = dialog.current;
    const opener = launcher.current;
    if (!open || !panel) return undefined;
    const previous = document.body.style.overflow;
    if (!panel.open) panel.showModal();
    closer.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      if (panel.open) panel.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  const close = () => setOpen(false);
  const solid = location.pathname !== "/" || scrolled;
  return (
    <>
      <a className="lux-skip" href="#public-main">
        Skip to content
      </a>
      <header className={`lux-nav ${solid ? "is-solid" : "is-transparent"}`}>
        <Link className="lux-brand" to="/" aria-label="Team Alpha home">
          <img src="/team-alpha-logo.png" alt="" width="43" height="43" />
          <span>
            TEAM ALPHA<small>THE WEDDING ARTIST</small>
          </span>
        </Link>
        <nav className="lux-desktop-nav" aria-label="Main navigation">
          {links.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              aria-current={
                (
                  to.includes("#")
                    ? location.pathname + location.hash === to
                    : location.pathname === to
                )
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="lux-nav-actions">
          <Link className="lux-nav-enquire" to="/enquire">
            Begin your story <ArrowUpRight size={13} />
          </Link>
          <button
            className="lux-menu-button"
            type="button"
            ref={launcher}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="lux-navigation-dialog"
            onClick={() => setOpen(true)}
          >
            <Menu size={24} strokeWidth={1.3} />
          </button>
        </div>
      </header>
      <dialog
        ref={dialog}
        id="lux-navigation-dialog"
        className="lux-menu-dialog"
        aria-labelledby="lux-menu-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
      >
        <div className="lux-menu-top">
          <span id="lux-menu-title">TEAM ALPHA · THE WEDDING ARTIST</span>
          <button
            type="button"
            ref={closer}
            aria-label="Close menu"
            onClick={close}
          >
            <X size={26} strokeWidth={1.2} />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {links.map(([label, to], index) => (
            <Link key={to} to={to} onClick={close}>
              <small>0{index + 1}</small>
              {label}
              <ArrowUpRight size={24} strokeWidth={1} />
            </Link>
          ))}
          <Link to="/enquire" onClick={close}>
            <small>{String(links.length + 1).padStart(2, "0")}</small>Begin your
            story
            <ArrowUpRight size={24} strokeWidth={1} />
          </Link>
        </nav>
        <div className="lux-menu-bottom">
          <span>
            BENGALURU, INDIA
            <br />
            AVAILABLE FOR CELEBRATIONS NEAR & FAR
          </span>
          <a
            href={`mailto:${content.site?.email || "Teamalphacrews@gmail.com"}`}
          >
            {content.site?.email || "Teamalphacrews@gmail.com"}
          </a>
        </div>
      </dialog>
    </>
  );
}

export function PublicFooter() {
  const { content } = useSiteContent();
  const site = content.site || {};
  return (
    <footer className="lux-footer">
      <div className="lux-shell lux-footer-grid">
        <div>
          <Link to="/" className="lux-footer-wordmark">
            Team Alpha<span>The Wedding Artist</span>
          </Link>
          <p>
            Wedding photography & cinematography.
            <br />
            Bengaluru, India. Stories everywhere.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <span>EXPLORE</span>
          <Link to="/portfolio">Our work</Link>
          <Link to="/films">Wedding films</Link>
          <Link to="/studio">The studio</Link>
          <Link to="/collections">Collections</Link>
          <Link to="/locations/bengaluru">Bengaluru weddings</Link>
          <Link to="/auth">Studio login</Link>
        </nav>
        <div className="lux-footer-contact">
          <span>LET’S MAKE SOMETHING TIMELESS</span>
          <a href={`mailto:${site.email || "Teamalphacrews@gmail.com"}`}>
            {site.email || "Teamalphacrews@gmail.com"}{" "}
            <ArrowUpRight size={15} />
          </a>
          <a href={`tel:${site.phone || "+919110603953"}`}>
            {site.phone || "+91 91106 03953"}
          </a>
          {site.instagram && (
            <a href={site.instagram} target="_blank" rel="noreferrer">
              Instagram <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>
      <div className="lux-shell lux-footer-bottom">
        <span>© {new Date().getFullYear()} Team Alpha</span>
        <span>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </span>
        <span>WITH CARE. WITH INTENTION.</span>
      </div>
    </footer>
  );
}

function Layout() {
  const location = useLocation();
  return (
    <div className="luxury-site">
      <PublicSeo />
      <PublicHeader />
      <div
        className={
          location.pathname === "/" ? "lux-home-content" : "lux-route-content"
        }
      >
        <Outlet />
      </div>
      <PublicFooter />
    </div>
  );
}
export default function PublicLayout() {
  return (
    <SiteContentProvider>
      <Layout />
    </SiteContentProvider>
  );
}
