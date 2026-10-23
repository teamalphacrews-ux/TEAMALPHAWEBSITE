import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowRight, Play, X } from "lucide-react";
import { useSiteContent } from "./content";
import "./portfolio.css";

function playableSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let id;
    if (hostname === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    if (hostname === "youtube.com" || hostname === "youtube-nocookie.com")
      id =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
      return {
        type: "embed",
        url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
      };
    if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
      const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/|$)/);
      if (match)
        return {
          type: "embed",
          url: `https://player.vimeo.com/video/${match[1]}?autoplay=1&dnt=1`,
        };
    }
    if (/\.(mp4|webm|m4v)$/i.test(url.pathname))
      return { type: "video", url: url.href };
  } catch {
    /* Missing and unapproved video sources stay unpublished. */
  }
  return null;
}

function FilmPlayer({ film, source, onClose }) {
  const dialog = useRef(null);
  const headingId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="lux-viewer lux-viewer--film"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="lux-viewer__surface">
        <header className="lux-viewer__header">
          <div>
            <span className="lux-viewer__eyebrow">A Team Alpha film</span>
            <h2 id={headingId}>{film.title}</h2>
          </div>
          <button
            type="button"
            className="lux-viewer__icon"
            onClick={onClose}
            aria-label="Close film"
            autoFocus
          >
            <X size={23} strokeWidth={1.4} />
          </button>
        </header>
        <div className="lux-films__player">
          {source.type === "video" ? (
            <video
              src={source.url}
              poster={film.poster || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
            >
              Your browser cannot play this film.
            </video>
          ) : (
            <iframe
              src={source.url}
              title={film.title || "Team Alpha wedding film"}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <footer className="lux-viewer__footer">
          <p className="lux-viewer__caption">
            For the moments you wish you could live again.
          </p>
          <span className="lux-viewer__eyebrow">
            Team Alpha · The Wedding Artist
          </span>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}

export default function Films({ compact = false, items }) {
  const { content, loading } = useSiteContent();
  const [selected, setSelected] = useState(null);
  const headingId = useId();
  const films = (items || content?.films || [])
    .map((film) => ({ ...film, source: playableSource(film.url) }))
    .filter((film) => film.source);
  const Heading = compact ? "h2" : "h1";
  return (
    <section
      className={`lux-films${compact ? " lux-films--compact" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="lux-films__heading">
        <div>
          <p className="lux-portfolio__eyebrow">
            Wedding films · Stories in motion
          </p>
          <Heading id={headingId}>
            For the feeling of <em>being there.</em>
          </Heading>
        </div>
        <p>
          The voices, the movement, the in-between. Wedding cinema that brings
          you back to how it felt.
        </p>
      </div>
      {loading && !films.length ? (
        <p className="lux-films__loading" role="status">
          Preparing the film collection…
        </p>
      ) : films.length > 0 ? (
        <div className="lux-films__grid">
          {films.map((film, index) => (
            <article key={film.id || film.url} className="lux-films__card">
              <button
                type="button"
                className="lux-films__poster"
                onClick={() => setSelected(film)}
                aria-label={`Play ${film.title}`}
              >
                {film.poster ? (
                  <img
                    src={film.poster}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 700px) 90vw, 47vw"
                  />
                ) : (
                  <span className="lux-films__poster-fallback">
                    Team Alpha
                    <br />
                    <em>The Wedding Artist</em>
                  </span>
                )}
                <span className="lux-films__play">
                  <Play size={23} strokeWidth={1} aria-hidden="true" />
                </span>
                <span className="lux-films__watch">Watch the film</span>
              </button>
              <div className="lux-films__caption">
                <span>
                  {String(index + 1).padStart(2, "0")} — Wedding cinema
                </span>
                <h2>{film.title}</h2>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="lux-films__empty">
          <span className="lux-films__empty-mark" aria-hidden="true">
            TA
          </span>
          <p className="lux-portfolio__eyebrow">
            A personal introduction to our cinema
          </p>
          <h2>
            Your story. <em>In motion.</em>
          </h2>
          <p>
            Ask our studio for a selection of wedding films and tell us what you
            imagine for your own celebration.
          </p>
          <Link
            className="lux-portfolio__text-link"
            to="/enquire?interest=cinematography"
          >
            Explore cinematography with us <ArrowRight size={18} />
          </Link>
        </div>
      )}
      {compact && !items && films.length > 0 && (
        <Link className="lux-portfolio__text-link lux-films__all" to="/films">
          The film collection <ArrowRight size={18} />
        </Link>
      )}
      {selected && (
        <FilmPlayer
          film={selected}
          source={selected.source}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
