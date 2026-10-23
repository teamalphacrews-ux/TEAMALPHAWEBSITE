import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowUpRight, Plus, Minus } from "lucide-react";
import { useSiteContent } from "./content";

const collections = [
  [
    "Wedding photography",
    "For the day that means everything.",
    "Honest portraits, considered compositions, and the fleeting moments you may have missed. Photography that holds the atmosphere of your celebration.",
    "wedding",
  ],
  [
    "Wedding cinematography",
    "Your people. Your voices. Your story.",
    "Films shaped around real moments, meaningful sound and the character of your wedding. We discuss your story and film deliverables together before creating a proposal.",
    "films",
  ],
  [
    "Pre-wedding & engagements",
    "A little time, just for the two of you.",
    "Unhurried sessions with space to be yourselves. A chance to connect with your photographers and celebrate the chapter before your wedding.",
    "pre-wedding",
  ],
  [
    "Destination celebrations",
    "A sense of place. A sense of you.",
    "Coverage thoughtfully planned around your destination, travel and the rhythm of your celebrations. Share the location and dates so we can discuss the details.",
    "destination",
  ],
  [
    "Albums & keepsakes",
    "Made to be held. Kept to be shared.",
    "Printed photographs and considered album design, created around the images that mean the most. Formats, finishes and selections are agreed with your studio.",
    "albums",
  ],
];

export function Experience() {
  return (
    <section className="lux-experience lux-section" id="experience">
      <div className="lux-shell">
        <div className="lux-experience-heading">
          <span className="lux-kicker">THE TEAM ALPHA EXPERIENCE</span>
          <h2 className="lux-display">
            Present in the moment.
            <br />
            <em>Considered in every frame.</em>
          </h2>
          <p>
            A calm presence on a day full of feeling. An observant eye. And a
            shared belief that the best photographs begin with trust.
          </p>
        </div>
        <div className="lux-principles">
          {[
            [
              "01",
              "First, we listen.",
              "Your people, your traditions, the moments you’re most looking forward to. This is where our understanding of your story begins.",
            ],
            [
              "02",
              "Space to be yourselves.",
              "Gentle direction when you need it. Room for the unexpected when you don’t. We look for connection, not a performance.",
            ],
            [
              "03",
              "A thoughtful finish.",
              "Careful selections, considered colour and a story that feels like you. Your agreed deliverables, shaped with care.",
            ],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CollectionPreview() {
  return (
    <section className="lux-section lux-collections" id="services">
      <div className="lux-shell">
        <div className="lux-heading-row">
          <div>
            <span className="lux-kicker">THOUGHTFULLY TAILORED</span>
            <h2 className="lux-display">
              Different celebrations.
              <br />
              <em>The same devotion.</em>
            </h2>
          </div>
          <Link className="lux-text-link" to="/collections">
            Explore our collections <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="lux-collection-lines">
          {collections.map(([title, subtitle], index) => (
            <Link to={`/collections#collection-${index}`} key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <small>{subtitle}</small>
              <ArrowUpRight size={22} strokeWidth={1} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EnquiryInvitation() {
  const { content } = useSiteContent();
  return (
    <section className="lux-invitation" id="contact">
      <div className="lux-shell">
        <span className="lux-kicker">THE NEXT CHAPTER STARTS HERE</span>
        <h2>
          Let’s create
          <br />
          <em>something timeless.</em>
        </h2>
        <p>
          Tell us about your celebration. The date, the place,
          <br />
          and the people you can’t imagine it without.
        </p>
        <Link className="lux-button lux-button-light" to="/enquire">
          Begin your story <ArrowUpRight size={17} />
        </Link>
        <span className="lux-invitation-location">
          BENGALURU, INDIA · CELEBRATIONS NEAR & FAR
        </span>
        {content.site?.email && (
          <a
            className="lux-invitation-email"
            href={`mailto:${content.site.email}`}
          >
            {content.site.email}
          </a>
        )}
      </div>
    </section>
  );
}

export function StudioPage() {
  return (
    <main id="public-main" tabIndex={-1}>
      <section className="lux-section lux-shell lux-studio-intro">
        <span className="lux-kicker">TEAM ALPHA · THE WEDDING ARTIST</span>
        <h1 className="lux-display">
          Artists behind the lens.
          <br />
          <em>People by your side.</em>
        </h1>
        <p>
          We are wedding photographers and cinematographers based in Bengaluru,
          with a shared love for genuine emotion and visual storytelling.
        </p>
        <p>
          Our work is built around the people in front of the camera. The
          relationships, the traditions, and the small, unscripted moments that
          make each celebration its own.
        </p>
      </section>
      <section className="lux-shell lux-team">
        <figure>
          <img
            src="/assets/editorial/yogesh.webp"
            alt="Yogesh Acharya, founder and director of photography at Team Alpha"
            loading="lazy"
            width="800"
            height="1000"
          />
          <figcaption>
            <h2>Yogesh Acharya</h2>
            <span>FOUNDER & DIRECTOR OF PHOTOGRAPHY</span>
          </figcaption>
        </figure>
        <figure>
          <img
            src="/assets/editorial/sachitha.webp"
            alt="Sachitha Kharvi, CEO of Team Alpha"
            loading="lazy"
            width="800"
            height="1000"
          />
          <figcaption>
            <h2>Sachitha Kharvi</h2>
            <span>CEO</span>
          </figcaption>
        </figure>
      </section>
      <Experience />
      <EnquiryInvitation />
    </main>
  );
}

export function CollectionsPage() {
  const { hash } = useLocation();
  const hashMatch = /^#collection-(\d+)$/.exec(hash);
  const hashIndex =
    hashMatch && Number(hashMatch[1]) < collections.length
      ? Number(hashMatch[1])
      : 0;
  const [selection, setSelection] = useState({ hash, index: hashIndex });
  const open = selection.hash === hash ? selection.index : hashIndex;
  return (
    <main id="public-main" tabIndex={-1}>
      <section className="lux-section lux-shell lux-page-intro">
        <span className="lux-kicker">SIGNATURE COLLECTIONS</span>
        <h1 className="lux-display">
          Made around
          <br />
          <em>your kind of celebration.</em>
        </h1>
        <p>
          Photography, films and keepsakes, thoughtfully brought together.
          Collections begin at ₹1,50,000; your final proposal reflects the
          coverage and deliverables you choose.
        </p>
      </section>
      <section className="lux-shell lux-collection-detail">
        {collections.map(([title, subtitle, copy, category], index) => (
          <article key={title} id={`collection-${index}`}>
            <h2>
              <button
                type="button"
                aria-expanded={open === index}
                aria-controls={`collection-copy-${index}`}
                onClick={() =>
                  setSelection({ hash, index: open === index ? null : index })
                }
              >
                <small>0{index + 1}</small>
                <span>{title}</span>
                {open === index ? <Minus size={20} /> : <Plus size={20} />}
              </button>
            </h2>
            <div id={`collection-copy-${index}`} hidden={open !== index}>
              <h3>{subtitle}</h3>
              <p>{copy}</p>
              <Link
                className="lux-text-link"
                to={`/enquire?collection=${category}`}
              >
                Tell us what you have in mind <ArrowUpRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </section>
      <EnquiryInvitation />
    </main>
  );
}

export function LocationPage() {
  const { slug } = useParams();
  if (slug !== "bengaluru")
    return (
      <main id="public-main" className="lux-shell lux-section" tabIndex={-1}>
        <span className="lux-kicker">CELEBRATIONS NEAR & FAR</span>
        <h1 className="lux-display">
          Where will your story
          <br />
          <em>take us?</em>
        </h1>
        <p>
          Tell us your destination and dates. We’ll discuss travel, coverage and
          the details of your celebration with you.
        </p>
        <Link to="/enquire" className="lux-button">
          Enquire about your destination <ArrowUpRight size={16} />
        </Link>
      </main>
    );
  return (
    <main id="public-main" tabIndex={-1}>
      <section className="lux-section lux-shell lux-page-intro">
        <span className="lux-kicker">WEDDING PHOTOGRAPHY · BENGALURU</span>
        <h1 className="lux-display">
          Your celebration.
          <br />
          <em>Our home city.</em>
        </h1>
        <p>
          From intimate gatherings to a full wedding weekend, we plan your
          photography around the people, places and traditions that matter to
          you.
        </p>
      </section>
      <section className="lux-shell lux-location-story">
        <img
          src="/assets/editorial/engagement-1280.webp"
          alt="A couple celebrating their engagement"
          width="1920"
          height="1280"
          loading="lazy"
        />
        <div>
          <h2>
            Room for the moments
            <br />
            between the moments.
          </h2>
          <p>
            When planning your Bengaluru celebration, share the locations and
            timings of each event with us. Moving between venues, making space
            for portraits, and allowing time with family all shape the coverage.
          </p>
          <h3>A few things to talk through</h3>
          <ul>
            <li>
              The ceremony and reception venues, including any photography
              permissions.
            </li>
            <li>The rituals and family photographs you want to prioritise.</li>
            <li>
              Travel between celebrations and a plan for changes in the weather.
            </li>
            <li>Your photography, film and album preferences.</li>
          </ul>
          <Link className="lux-text-link" to="/enquire?location=bengaluru">
            Enquire about your Bengaluru wedding <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
      <EnquiryInvitation />
    </main>
  );
}

export function LegalPage({ type }) {
  const { content } = useSiteContent();
  const privacy = type === "privacy";
  return (
    <main
      id="public-main"
      tabIndex={-1}
      className="lux-shell lux-section lux-legal"
    >
      <span className="lux-kicker">TEAM ALPHA</span>
      <h1 className="lux-display">
        {privacy ? "Your privacy." : "A thoughtful understanding."}
      </h1>
      {privacy ? (
        <>
          <h2>Information you share</h2>
          <p>
            When you enquire, the contact and celebration details you enter are
            sent to Team Alpha so the studio can respond, prepare a proposal,
            and follow up. The website also processes technical request
            information to help prevent spam and misuse.
          </p>
          <h2>Photography and external services</h2>
          <p>
            Published photography belongs to its respective rights holders.
            External links lead to services such as Instagram, WhatsApp and
            Google Maps. Films from third-party providers load only when you
            choose to play them; those providers apply their own privacy
            policies.
          </p>
          <h2>Google reviews</h2>
          <p>
            When enabled, reviews are supplied by Google Maps with author
            attribution. Google’s{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>{" "}
            applies to its services.
          </p>
          <h2>Questions and requests</h2>
          <p>
            For questions about information held by the studio, retention,
            corrections or deletion, contact{" "}
            <a href={`mailto:${content.site.email}`}>{content.site.email}</a>.
          </p>
        </>
      ) : (
        <>
          <h2>Enquiries and bookings</h2>
          <p>
            Sending an enquiry does not confirm a booking, price or
            availability. Coverage, payment terms, deliverables and permissions
            are agreed separately with the studio in your proposal and booking
            documents.
          </p>
          <h2>Our photographs and films</h2>
          <p>
            Public portfolio work is presented for viewing. Please obtain
            permission from Team Alpha and the relevant rights holders before
            copying, publishing or commercially using it.
          </p>
          <h2>Third-party content</h2>
          <p>
            External services have their own terms. Google Maps content, when
            enabled, is subject to the{" "}
            <a
              href="https://maps.google.com/help/terms_maps/"
              target="_blank"
              rel="noreferrer"
            >
              Google Maps Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google Privacy Policy
            </a>
            .
          </p>
          <h2>Speak to the studio</h2>
          <p>
            Contact{" "}
            <a href={`mailto:${content.site.email}`}>{content.site.email}</a>{" "}
            about this website or your celebration.
          </p>
        </>
      )}
    </main>
  );
}

export function PublicNotFound() {
  return (
    <main
      id="public-main"
      tabIndex={-1}
      className="lux-shell lux-section lux-not-found"
    >
      <span className="lux-kicker">A DIFFERENT CHAPTER</span>
      <h1 className="lux-display">
        This page
        <br />
        <em>isn’t in the story.</em>
      </h1>
      <p>Let’s take you back to something worth remembering.</p>
      <Link to="/" className="lux-button">
        Return home <ArrowUpRight size={15} />
      </Link>
    </main>
  );
}
