import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useSiteContent } from "./content";
import GalleryViewer from "./GalleryViewer";
import Films from "./Films";
import "./portfolio.css";

const defaults = [
  { id: "all", label: "All stories" },
  { id: "wedding", label: "Wedding Stories" },
  { id: "pre-wedding", label: "Pre-Wedding" },
  { id: "engagement", label: "Engagements" },
  { id: "intimate", label: "Intimate Weddings" },
  { id: "destination", label: "Destination Weddings" },
  { id: "films", label: "Wedding Films" },
];

function categoryKey(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (normalized.includes("prewedding")) return "pre-wedding";
  if (normalized.includes("engagement")) return "engagement";
  if (normalized.includes("intimate")) return "intimate";
  if (normalized.includes("destination")) return "destination";
  if (normalized.includes("film")) return "films";
  if (normalized.includes("wedding")) return "wedding";
  return normalized;
}

function storyImages(story) {
  const images = Array.isArray(story.images)
    ? story.images.filter((image) => image?.src)
    : [];
  if (!images.length && story.cover)
    return [{ src: story.cover, alt: story.title }];
  if (story.cover && images[0]?.src !== story.cover)
    return [{ src: story.cover, alt: story.title }, ...images];
  return images;
}

export default function Portfolio({ featured = false }) {
  const { content, loading } = useSiteContent();
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(null);
  const rail = useRef(null);
  const scope = useId().replace(/:/g, "");
  const stories = Array.isArray(content?.stories) ? content.stories : [];
  const managedCategories = Array.isArray(content?.categories)
    ? content.categories
    : [];
  const categories = defaults.map((item) => {
    const managed = managedCategories.find(
      (entry) => categoryKey(entry.id || entry.label || entry) === item.id,
    );
    return {
      ...item,
      label:
        typeof managed === "string" ? managed : managed?.label || item.label,
    };
  });
  managedCategories.forEach((entry) => {
    const id = categoryKey(entry.id || entry.label || entry);
    if (id && !categories.some((item) => item.id === id)) {
      categories.push({
        id,
        label: typeof entry === "string" ? entry : entry.label,
      });
    }
  });
  const shown = (
    featured ? stories.filter((story) => story.featured !== false) : stories
  ).filter((story) => {
    const storyCategories = Array.isArray(story.categories)
      ? story.categories
      : [story.category];
    return (
      category === "all" ||
      storyCategories.some((entry) => categoryKey(entry) === category)
    );
  });
  const galleryId = `lux-portfolio-rail-${scope}`;
  const Heading = featured ? "h2" : "h1";

  function open(story, index) {
    const update = () =>
      setSelected({ story, index, images: storyImages(story) });
    if (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.startViewTransition
    )
      document.startViewTransition(() => flushSync(update));
    else update();
  }

  function scroll(direction) {
    rail.current?.scrollBy({
      left: direction * Math.max(280, rail.current.clientWidth * 0.72),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <section
      className={`lux-portfolio${featured ? " lux-portfolio--featured" : ""}`}
      aria-labelledby={`lux-portfolio-heading-${scope}`}
    >
      <div className="lux-portfolio__heading">
        <div>
          <p className="lux-portfolio__eyebrow">
            {featured
              ? "Selected work · A living collection"
              : "The portfolio · Team Alpha"}
          </p>
          <Heading
            id={`lux-portfolio-heading-${scope}`}
            className="lux-portfolio__title"
          >
            {featured ? (
              <>
                Stories that <em>stay.</em>
              </>
            ) : (
              <>
                Love, in every <em>frame.</em>
              </>
            )}
          </Heading>
        </div>
        <div className="lux-portfolio__introduction">
          <ArrowDownRight aria-hidden="true" size={35} strokeWidth={1} />
          <p>
            A collection of real moments, quiet connections and celebrations
            worth returning to.
          </p>
          {featured && (
            <Link className="lux-portfolio__text-link" to="/portfolio">
              Explore the portfolio <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </div>
      <div className="lux-portfolio__toolbar">
        <div
          className="lux-portfolio__categories"
          role="group"
          aria-label="Filter wedding portfolio"
        >
          {categories.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={category === item.id}
              onClick={() => {
                setCategory(item.id);
                rail.current?.scrollTo({ left: 0 });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {category !== "films" && shown.length > 0 && (
          <div className="lux-portfolio__controls">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Scroll portfolio left"
              aria-controls={galleryId}
            >
              <ArrowLeft size={20} strokeWidth={1.4} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Scroll portfolio right"
              aria-controls={galleryId}
            >
              <ArrowRight size={20} strokeWidth={1.4} />
            </button>
          </div>
        )}
      </div>
      {category === "films" ? (
        <Films compact />
      ) : loading && !shown.length ? (
        <div className="lux-portfolio__loading" aria-busy="true" role="status">
          <span />
          <span />
          <span />
          <p>Preparing the collection…</p>
        </div>
      ) : shown.length ? (
        <>
          <div
            ref={rail}
            id={galleryId}
            className="lux-portfolio__rail"
            tabIndex={0}
            aria-label={`${categories.find((item) => item.id === category)?.label} photography. Scroll horizontally to explore.`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                scroll(event.key === "ArrowRight" ? 1 : -1);
              }
            }}
          >
            {shown.map((story, index) => {
              const id = String(story.id || story.slug || index).replace(
                /[^a-zA-Z0-9-]/g,
                "",
              );
              const images = storyImages(story);
              const cover = story.cover || images[0]?.src;
              const transitionPrefix = `lux-portfolio-${scope}-${id}`;
              return (
                <article
                  className={`lux-portfolio__card lux-portfolio__card--${index % 3}`}
                  key={story.id || story.slug || index}
                >
                  <button
                    type="button"
                    className="lux-portfolio__photograph"
                    onClick={() => open(story, 0)}
                    disabled={!images.length}
                    aria-label={`Open ${story.title} photograph gallery`}
                  >
                    {cover && (
                      <img
                        src={cover}
                        srcSet={
                          images.find((image) => image.src === cover)?.srcSet ||
                          story.coverSrcSet ||
                          undefined
                        }
                        alt={story.title || "Wedding story"}
                        loading="lazy"
                        decoding="async"
                        sizes="(max-width: 700px) 84vw, (max-width: 1100px) 65vw, 56vw"
                        style={{
                          viewTransitionName:
                            selected?.story === story
                              ? "none"
                              : `${transitionPrefix}-0`,
                        }}
                      />
                    )}
                    <span className="lux-portfolio__image-label">
                      View gallery <Plus size={18} strokeWidth={1.2} />
                    </span>
                  </button>
                  <div className="lux-portfolio__caption">
                    <div>
                      <span className="lux-portfolio__number">
                        {String(index + 1).padStart(2, "0")} <span>—</span>{" "}
                        {story.location ||
                          categories.find((item) => item.id === category)
                            ?.label}
                      </span>
                      <h2>
                        {story.slug ? (
                          <Link
                            to={`/stories/${encodeURIComponent(story.slug)}`}
                          >
                            {story.title}
                          </Link>
                        ) : (
                          story.title
                        )}
                      </h2>
                    </div>
                    {story.slug && (
                      <Link
                        className="lux-portfolio__story-link"
                        to={`/stories/${encodeURIComponent(story.slug)}`}
                        aria-label={`Read ${story.title} wedding story`}
                      >
                        <ArrowRight size={23} strokeWidth={1.1} />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="lux-portfolio__footnote">
            <span>Scroll to discover</span>
            <span>
              {String(shown.length).padStart(2, "0")}{" "}
              {shown.length === 1 ? "story" : "stories"} in this collection
            </span>
          </div>
        </>
      ) : (
        <div className="lux-portfolio__empty">
          <span className="lux-portfolio__eyebrow">
            A considered collection
          </span>
          <h2>
            More stories, <em>soon.</em>
          </h2>
          <p>
            We publish each story with care. Explore another collection, or tell
            us about the celebration you are planning.
          </p>
          <Link className="lux-portfolio__text-link" to="/enquire">
            Begin your story <ArrowRight size={17} />
          </Link>
        </div>
      )}
      {selected && (
        <GalleryViewer
          images={selected.images}
          initialIndex={selected.index}
          title={selected.story.title}
          transitionPrefix={`lux-portfolio-${scope}-${String(selected.story.id || selected.story.slug || shown.indexOf(selected.story)).replace(/[^a-zA-Z0-9-]/g, "")}`}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
