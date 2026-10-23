import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDown } from "lucide-react";
import { MotionConfig } from "framer-motion";
import Hero from "../components/Hero";
import Portfolio from "./Portfolio";
import Films from "./Films";
import Reviews from "./Reviews";
import { useSiteContent } from "./content";
import {
  Experience,
  CollectionPreview,
  EnquiryInvitation,
} from "./StudioPages";

function Introduction() {
  return (
    <section className="lux-section lux-intro" id="about">
      <div className="lux-shell lux-intro-grid">
        <div className="lux-intro-copy">
          <span className="lux-kicker">01 / THE ART OF REMEMBERING</span>
          <h2 className="lux-display">
            Some moments
            <br />
            deserve to be
            <br />
            <em>remembered forever.</em>
          </h2>
          <p>
            Not just how it looked.
            <br />
            How it felt to be there.
          </p>
          <p>
            We’re Team Alpha, wedding photographers and filmmakers based in
            Bengaluru. Drawn to the quiet glances, the glorious chaos, and all
            the little things that make a celebration yours.
          </p>
          <Link className="lux-text-link" to="/studio">
            Meet the wedding artists <ArrowUpRight size={16} />
          </Link>
        </div>
        <figure className="lux-intro-photo">
          <img
            src="/assets/editorial/studio-wedding-1280.webp"
            srcSet="/assets/editorial/studio-wedding-640.webp 640w, /assets/editorial/studio-wedding-1280.webp 1280w"
            sizes="(max-width: 760px) 86vw, 40vw"
            alt="A couple sharing a quiet moment on the steps during their wedding celebration"
            width="1400"
            height="2099"
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            <span>THE BEAUTY IS IN THE IN-BETWEEN.</span>
            <span>TEAM ALPHA</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export default function LuxuryHome() {
  const { content } = useSiteContent();
  const sections = {
    intro: <Introduction />,
    portfolio: <Portfolio featured />,
    films: <Films compact />,
    experience: <Experience />,
    reviews: <Reviews />,
    collections: <CollectionPreview />,
    enquiry: <EnquiryInvitation />,
  };
  const defaultOrder = [
    "intro",
    "portfolio",
    "films",
    "experience",
    "reviews",
    "collections",
    "enquiry",
  ];
  const configured = Array.isArray(content.sectionOrder)
    ? content.sectionOrder
    : defaultOrder;
  const order = [...new Set(configured)].filter(
    (key) => Object.hasOwn(sections, key) && content.sections?.[key] !== false,
  );
  const nextSection = order[0];
  return (
    <main id="public-main" tabIndex={-1}>
      <MotionConfig reducedMotion="user">
        <Hero />
      </MotionConfig>
      <div className="lux-banner-footnote">
        <span>PHOTOGRAPHY & FILMS · BENGALURU, INDIA</span>
        <Link
          to={nextSection ? `#homepage-${nextSection}` : "/enquire"}
          aria-label={nextSection ? "Discover Team Alpha" : "Begin your story"}
        >
          A story begins <ArrowDown size={13} />
        </Link>
      </div>
      {order.map((key) => (
        <div className="lux-home-section" id={`homepage-${key}`} key={key}>
          {sections[key]}
        </div>
      ))}
    </main>
  );
}
