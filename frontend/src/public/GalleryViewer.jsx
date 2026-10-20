import { useEffect, useId, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import "./portfolio.css";

function updateView(update) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced && typeof document.startViewTransition === "function") {
    document.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

export default function GalleryViewer({
  images = [],
  initialIndex = 0,
  title = "Wedding photographs",
  onClose,
  transitionPrefix = "",
}) {
  const dialog = useRef(null);
  const pointer = useRef(null);
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );
  const [failed, setFailed] = useState({});
  const headingId = useId();
  const activeImage = images[index];

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

  function move(direction) {
    if (images.length < 2) return;
    setIndex(
      (current) => (current + direction + images.length) % images.length,
    );
  }

  function close() {
    updateView(onClose);
  }

  if (!activeImage) return null;

  return createPortal(
    <dialog
      ref={dialog}
      className="lux-viewer"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(1);
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="lux-viewer__surface">
        <header className="lux-viewer__header">
          <div>
            <span className="lux-viewer__eyebrow">
              Team Alpha · The Wedding Artist
            </span>
            <h2 id={headingId}>{title}</h2>
          </div>
          <button
            type="button"
            className="lux-viewer__icon"
            onClick={close}
            aria-label="Close gallery"
            autoFocus
          >
            <X size={22} strokeWidth={1.4} />
          </button>
        </header>
        <div
          className="lux-viewer__stage"
          onPointerDown={(event) => {
            if (event.pointerType === "touch")
              pointer.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            if (!pointer.current) return;
            const distanceX = event.clientX - pointer.current.x;
            const distanceY = event.clientY - pointer.current.y;
            pointer.current = null;
            if (
              Math.abs(distanceX) > 55 &&
              Math.abs(distanceX) > Math.abs(distanceY) * 1.5
            )
              move(distanceX < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            pointer.current = null;
          }}
        >
          {failed[index] ? (
            <p className="lux-viewer__error" role="status">
              This photograph could not load. Please try another image.
            </p>
          ) : (
            <img
              key={activeImage.src}
              src={activeImage.src}
              srcSet={activeImage.srcSet || undefined}
              sizes={activeImage.sizes || "100vw"}
              alt={activeImage.alt || `${title}, photograph ${index + 1}`}
              width={activeImage.width || undefined}
              height={activeImage.height || undefined}
              decoding="async"
              draggable="false"
              style={{
                viewTransitionName: transitionPrefix
                  ? `${transitionPrefix}-${index}`
                  : "none",
              }}
              onError={() =>
                setFailed((current) => ({ ...current, [index]: true }))
              }
            />
          )}
        </div>
        <footer className="lux-viewer__footer">
          <p className="lux-viewer__caption">
            {activeImage.alt || "A moment, remembered."}
          </p>
          <div className="lux-viewer__navigation">
            <button
              type="button"
              className="lux-viewer__icon"
              disabled={images.length < 2}
              onClick={() => move(-1)}
              aria-label="Previous photograph"
            >
              <ArrowLeft size={22} strokeWidth={1.4} />
            </button>
            <span
              className="lux-viewer__counter"
              aria-live="polite"
              aria-atomic="true"
            >
              {String(index + 1).padStart(2, "0")} <span>/</span>{" "}
              {String(images.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              className="lux-viewer__icon"
              disabled={images.length < 2}
              onClick={() => move(1)}
              aria-label="Next photograph"
            >
              <ArrowRight size={22} strokeWidth={1.4} />
            </button>
          </div>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
