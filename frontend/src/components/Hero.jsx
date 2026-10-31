import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import "./Hero.css";

const photographs = [
  {
    id: "dsc05646",
    orientation: "landscape",
    width: 7952,
    height: 5304,
    alt: "A bride and groom holding hands outdoors in warm wedding attire",
  },
  {
    id: "dsc05613",
    orientation: "portrait",
    width: 5304,
    height: 7952,
    alt: "A bride seated on a stone ledge beneath a golden veil",
  },
  {
    id: "dsc06184",
    orientation: "portrait",
    width: 5304,
    height: 7952,
    alt: "A smiling bride during a rice blessing ceremony",
  },
  {
    id: "dsc06203",
    orientation: "portrait",
    width: 5304,
    height: 7952,
    alt: "A bride smiling beneath falling rose petals",
  },
];
const srcSet = (id) =>
  [640, 1280, 1920]
    .map((width) => `/assets/banner/${id}-${width}.webp ${width}w`)
    .join(", ");
const imageSizes = (orientation) =>
  orientation === "portrait" ? "(max-width: 700px) 100vw, 60vw" : "100vw";

export default function Hero() {
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(null);
  const [loads, setLoads] = useState({ 0: 0 });
  const [ready, setReady] = useState([]);
  const [message, setMessage] = useState("");
  const requested = useRef(0);
  const touchStart = useRef(null);

  const select = (index) => {
    requested.current = index;
    setMessage("");
    if (ready.includes(index)) {
      setActive(index);
      setPending(null);
    } else {
      setPending(index);
      setLoads((current) => ({
        ...current,
        [index]: (current[index] || 0) + 1,
      }));
    }
  };
  const move = (direction) =>
    select(
      ((pending ?? active) + direction + photographs.length) %
        photographs.length,
    );
  const imageReady = (index) => {
    setReady((current) =>
      current.includes(index) ? current : [...current, index],
    );
    if (requested.current === index) {
      setActive(index);
      setPending(null);
    }
  };
  const imageFailed = (index) => {
    if (requested.current !== index) return;
    setPending(null);
    setMessage(
      "This photograph could not be loaded. Please try another image.",
    );
  };
  const keyboardNavigate = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") select(0);
    else if (event.key === "End") select(photographs.length - 1);
    else move(event.key === "ArrowRight" ? 1 : -1);
  };
  const endSwipe = (event) => {
    const start = touchStart.current;
    touchStart.current = null;
    const finish = event.changedTouches[0];
    if (!start || !finish) return;
    const distance = finish.clientX - start.x;
    const vertical = finish.clientY - start.y;
    if (
      Math.abs(distance) > 55 &&
      Math.abs(distance) > Math.abs(vertical) * 1.3
    )
      move(distance < 0 ? 1 : -1);
  };

  return (
    <section
      id="home"
      role="region"
      aria-roledescription="carousel"
      aria-label="Team Alpha wedding photography"
      className={`lux-hero lux-hero-${photographs[active].orientation} relative h-screen flex items-center justify-center overflow-hidden`}
      onKeyDown={keyboardNavigate}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={endSwipe}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      {photographs.map((photograph, index) => (
        <div
          key={photograph.id}
          id={`hero-photograph-${index + 1}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${photographs.length}`}
          aria-hidden={active !== index}
          className={`lux-hero-slide lux-hero-slide-${photograph.orientation}${active === index ? " is-active" : ""}`}
        >
          {loads[index] !== undefined && (
            <>
              {photograph.orientation === "portrait" && (
                <div
                  className="lux-hero-backdrop"
                  style={{
                    backgroundImage: `url('/assets/banner/${photograph.id}-640.webp')`,
                  }}
                  aria-hidden="true"
                />
              )}
              <img
                key={`${photograph.id}-${loads[index]}`}
                className="lux-hero-photograph"
                src={`/assets/banner/${photograph.id}-1280.webp`}
                srcSet={srcSet(photograph.id)}
                sizes={imageSizes(photograph.orientation)}
                width={photograph.width}
                height={photograph.height}
                alt={photograph.alt}
                fetchPriority={index === 0 ? "high" : "auto"}
                loading="eager"
                decoding="async"
                onLoad={() => imageReady(index)}
                onError={() => imageFailed(index)}
              />
            </>
          )}
        </div>
      ))}
      <div
        className="lux-hero-shade absolute inset-0 bg-black/40"
        aria-hidden="true"
      />
      <div className="lux-hero-caption relative z-10 text-center px-6">
        <div className="lux-hero-copy max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-serif mb-6 text-white leading-tight">
            Timeless Wedding Stories
          </h1>
          <p className="text-sm md:text-base text-white/90 tracking-[0.3em] font-sans uppercase font-light">
            Luxury photography capturing emotions and love
          </p>
        </div>
      </div>
      <div
        className="lux-hero-controls"
        aria-label="Banner photograph controls"
      >
        <span className="lux-hero-counter" aria-hidden="true">
          0{active + 1}
          <span />0{photographs.length}
        </span>
        <div
          className="lux-hero-dots"
          role="group"
          aria-label="Choose a banner photograph"
        >
          {photographs.map((photograph, index) => (
            <button
              key={photograph.id}
              type="button"
              aria-label={`Show photograph ${index + 1} of ${photographs.length}: ${photograph.alt}`}
              aria-pressed={active === index}
              aria-controls={`hero-photograph-${index + 1}`}
              className={active === index ? "is-active" : ""}
              onClick={() => select(index)}
            >
              <span />
            </button>
          ))}
        </div>
        <div className="lux-hero-arrows">
          <button
            type="button"
            aria-label="Previous banner photograph"
            onClick={() => move(-1)}
          >
            <ArrowLeft size={18} strokeWidth={1.2} />
          </button>
          <button
            type="button"
            aria-label="Next banner photograph"
            onClick={() => move(1)}
          >
            <ArrowRight size={18} strokeWidth={1.2} />
          </button>
        </div>
      </div>
      <p className="lux-hero-loading" role="status">
        {pending !== null ? "Preparing photograph…" : message}
      </p>
      <p className="lux-hero-sr" aria-live="polite" aria-atomic="true">
        Photograph {active + 1} of {photographs.length}.{" "}
        {photographs[active].alt}.
      </p>
    </section>
  );
}
