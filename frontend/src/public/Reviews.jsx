import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useSiteContent } from "./content";
import "./reviews.css";

function Stars({ rating }) {
  return (
    <span className="lux-review-stars" aria-label={`${rating} out of 5 stars`}>
      <span aria-hidden="true">
        {"★".repeat(Math.round(rating))}
        {"☆".repeat(5 - Math.round(rating))}
      </span>
    </span>
  );
}

export default function Reviews() {
  const { content } = useSiteContent();
  const section = useRef(null);
  const rail = useRef(null);
  const [state, setState] = useState({ loading: true, data: null });
  useEffect(() => {
    const controller = new AbortController();
    let requested = false;
    const load = () => {
      if (requested) return;
      requested = true;
      fetch("/api/website/reviews", {
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Reviews unavailable");
          return response.json();
        })
        .then((data) => setState({ loading: false, data }))
        .catch(() => {
          if (!controller.signal.aborted)
            setState({ loading: false, data: null });
        });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                load();
                observer.disconnect();
              }
            },
            { rootMargin: "0px" },
          );
    if (observer && section.current) observer.observe(section.current);
    else load();
    return () => {
      controller.abort();
      observer?.disconnect();
    };
  }, []);

  const data = state.data;
  const reviews =
    data?.configured && Array.isArray(data.reviews) ? data.reviews : [];
  const profile = data?.googleMapsUri || content.site.googleMapsUrl;
  const move = (direction) =>
    rail.current?.scrollBy({
      left: direction * rail.current.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  return (
    <section
      ref={section}
      className="lux-reviews lux-section"
      id="reviews"
      aria-labelledby="lux-reviews-title"
    >
      <div className="lux-reviews-heading">
        <div>
          <p className="lux-eyebrow">Kind words, lasting connections</p>
          <h2 id="lux-reviews-title">
            The words we
            <br />
            <em>value most.</em>
          </h2>
        </div>
        <div className="lux-reviews-aside">
          {reviews.length > 0 && data.rating !== null ? (
            <div className="lux-reviews-rating">
              <strong>{Number(data.rating).toFixed(1)}</strong>
              <div>
                <Stars rating={data.rating} />
                {data.reviewCount !== null && (
                  <p>
                    {Number(data.reviewCount).toLocaleString("en-IN")} Google
                    reviews
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p>
              The photographs tell one part of the story. Hear the rest from the
              people who were there.
            </p>
          )}
          <a
            className="lux-text-link"
            href={profile}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read reviews on Google <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
      {state.loading ? (
        <div className="lux-review-loading" role="status">
          <span />
          Loading words from our clients…
        </div>
      ) : reviews.length > 0 ? (
        <>
          <p className="lux-review-ordering">
            A selection of up to five reviews, ordered by relevance by Google.
            Only reviews with text, a rating and author details are shown.
          </p>
          <div
            className="lux-review-rail"
            ref={rail}
            tabIndex={0}
            aria-label="Customer reviews. Scroll horizontally to read more."
          >
            {reviews.map((review, index) => (
              <article className="lux-review-card" key={review.id || index}>
                <Stars rating={review.rating} />
                <blockquote lang={review.languageCode || undefined}>
                  <p>{review.text}</p>
                </blockquote>
                {review.originalText && review.originalText !== review.text && (
                  <span className="lux-review-translated">
                    Translated by Google
                  </span>
                )}
                <div className="lux-review-author">
                  {review.authorAttribution.photoUri && (
                    <img
                      src={review.authorAttribution.photoUri}
                      alt=""
                      width="40"
                      height="40"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div>
                    {review.authorAttribution.uri ? (
                      <a
                        href={review.authorAttribution.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {review.authorAttribution.displayName}
                      </a>
                    ) : (
                      <strong>{review.authorAttribution.displayName}</strong>
                    )}
                    <span>{review.relativePublishTimeDescription}</span>
                  </div>
                </div>
                {review.googleMapsUri && (
                  <a
                    className="lux-review-source"
                    href={review.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View this review on Google Maps{" "}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                )}
              </article>
            ))}
          </div>
          <div className="lux-reviews-bottom">
            <div className="lux-google-attribution">
              Reviews from{" "}
              <a
                className="lux-google-logo"
                href={profile}
                target="_blank"
                rel="noopener noreferrer"
                translate="no"
              >
                <img
                  src="/assets/google-maps-attribution.svg"
                  alt="Google Maps"
                  width="98"
                  height="18"
                />
              </a>
              {data.attributions?.map((item, index) =>
                item.providerUri ? (
                  <a
                    key={index}
                    href={item.providerUri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.provider}
                  </a>
                ) : (
                  <span key={index}>{item.provider}</span>
                ),
              )}
            </div>
            {reviews.length > 1 && (
              <div className="lux-review-controls">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="Previous reviews"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Next reviews"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
          <p className="lux-review-legal">
            <a
              href="https://www.google.com/intl/en/policies/terms/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google terms
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google privacy
            </a>
          </p>
        </>
      ) : (
        <div className="lux-review-fallback">
          <span className="lux-review-quote" aria-hidden="true">
            “
          </span>
          <p>
            Every story is personal.
            <br />
            <em>So is the experience.</em>
          </p>
          <a href={profile} target="_blank" rel="noopener noreferrer">
            Discover our clients’ experiences on Google{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  );
}
