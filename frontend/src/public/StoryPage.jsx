import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useSiteContent } from "./content";
import GalleryViewer from "./GalleryViewer";
import Films from "./Films";
import "./portfolio.css";

export default function StoryPage() {
  const { slug } = useParams();
  const { content, loading } = useSiteContent();
  const [opened, setOpened] = useState(null);
  const scope = useId().replace(/:/g, "");
  const story = content?.stories?.find((entry) => entry.slug === slug);
  const images = (story?.images || []).filter((image) => image?.src);
  const related =
    content?.stories?.filter((entry) => entry.slug !== slug).slice(0, 2) || [];
  const films = story?.film
    ? [
        {
          id: `${story.id}-film`,
          title: `${story.title} · The film`,
          poster: story.cover,
          url: story.film,
        },
      ]
    : content?.films?.filter(
        (film) =>
          film.storySlug === slug || (story?.id && film.storyId === story.id),
      ) || [];
  const transitionPrefix = `lux-story-${scope}`;

  function open(index) {
    const update = () => setOpened(index);
    if (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.startViewTransition
    )
      document.startViewTransition(() => flushSync(update));
    else update();
  }

  if (loading && !story)
    return (
      <main
        className="lux-story lux-story--missing"
        id="public-main"
        tabIndex={-1}
      >
        <p className="lux-portfolio__eyebrow" role="status">
          Preparing the story…
        </p>
      </main>
    );
  if (!story)
    return (
      <main
        className="lux-story lux-story--missing"
        id="public-main"
        tabIndex={-1}
      >
        <p className="lux-portfolio__eyebrow">The wedding stories</p>
        <h1>This story is not available.</h1>
        <p>Discover the celebrations in our published collection.</p>
        <Link className="lux-portfolio__text-link" to="/portfolio">
          Return to the portfolio <ArrowRight size={17} />
        </Link>
      </main>
    );

  return (
    <main className="lux-story" id="public-main" tabIndex={-1}>
      <header className="lux-story__header">
        <Link className="lux-story__back" to="/portfolio">
          <ArrowLeft size={17} strokeWidth={1.2} /> All wedding stories
        </Link>
        <p className="lux-portfolio__eyebrow">
          {story.category || "Wedding story"}
          {story.location ? ` · ${story.location}` : ""}
        </p>
        <h1>{story.title}</h1>
        {story.intro && <p className="lux-story__intro">{story.intro}</p>}
      </header>
      {story.cover && (
        <div className="lux-story__cover">
          <img
            src={story.cover}
            srcSet={
              images.find((image) => image.src === story.cover)?.srcSet ||
              story.coverSrcSet ||
              undefined
            }
            sizes="100vw"
            alt={story.title}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      )}
      <section
        className="lux-story__collection"
        aria-label={`${story.title} photographs`}
      >
        <div className="lux-story__collection-heading">
          <span className="lux-portfolio__eyebrow">
            A story told in photographs
          </span>
          <span>{String(images.length).padStart(2, "0")} frames</span>
        </div>
        <div className="lux-story__grid">
          {images.map((image, index) => (
            <button
              type="button"
              key={`${image.src}-${index}`}
              className={`lux-story__image ${image.height > image.width ? "lux-story__image--portrait" : "lux-story__image--landscape"}`}
              onClick={() => open(index)}
              aria-label={`Enlarge photograph ${index + 1}: ${image.alt || story.title}`}
            >
              <img
                src={image.src}
                srcSet={image.srcSet || undefined}
                alt={image.alt || `${story.title}, photograph ${index + 1}`}
                width={image.width || undefined}
                height={image.height || undefined}
                loading="lazy"
                decoding="async"
                sizes={image.sizes || "(max-width: 700px) 90vw, 46vw"}
                style={{
                  viewTransitionName:
                    opened === null ? `${transitionPrefix}-${index}` : "none",
                }}
              />
              <span>
                <Plus size={22} strokeWidth={1.2} />
              </span>
            </button>
          ))}
        </div>
      </section>
      {films.length > 0 && <Films compact items={films} />}
      <section className="lux-story__enquiry">
        <p className="lux-portfolio__eyebrow">Your own, extraordinary story</p>
        <h2>
          Let’s make something <em>timeless.</em>
        </h2>
        <p>
          Tell us about the people, places and moments that will make your
          celebration yours.
        </p>
        <Link
          to={`/enquire?story=${encodeURIComponent(story.slug)}`}
          className="lux-portfolio__text-link"
        >
          Begin your story <ArrowRight size={19} strokeWidth={1.2} />
        </Link>
      </section>
      {related.length > 0 && (
        <section
          className="lux-story__related"
          aria-labelledby={`related-stories-${scope}`}
        >
          <div className="lux-story__related-heading">
            <h2 id={`related-stories-${scope}`}>
              Keep <em>discovering.</em>
            </h2>
            <Link className="lux-portfolio__text-link" to="/portfolio">
              All stories <ArrowRight size={17} />
            </Link>
          </div>
          <div className="lux-story__related-grid">
            {related.map((entry) => (
              <Link
                to={`/stories/${encodeURIComponent(entry.slug)}`}
                key={entry.id || entry.slug}
              >
                {entry.cover && (
                  <img
                    src={entry.cover}
                    alt={entry.title}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span>
                  {entry.title}
                  <ArrowRight size={20} strokeWidth={1.2} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {opened !== null && (
        <GalleryViewer
          key={`${story.id || slug}-${opened}`}
          images={images}
          initialIndex={opened}
          title={story.title}
          transitionPrefix={transitionPrefix}
          onClose={() => setOpened(null)}
        />
      )}
    </main>
  );
}
