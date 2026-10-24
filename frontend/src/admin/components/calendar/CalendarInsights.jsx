import { useState } from "react";
import { calendarMonthLoad } from "./calendarData";
import "../operations/studioInsights.css";

export default function CalendarInsights({
  events,
  month,
  selected,
  onSelect,
  loading,
  timezone,
}) {
  const {
    days,
    events: monthEvents,
    activeDays,
    peak,
  } = calendarMonthLoad(events, month, timezone);
  const [hovered, setHovered] = useState(null);
  const selectedIndex = Math.max(
    0,
    days.findIndex((day) => day.key === selected),
  );
  const active = days[hovered ?? selectedIndex] || days[0];
  const focusDay = (event, index) => {
    const directions = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: days.length - 1,
    };
    if (!Object.hasOwn(directions, event.key)) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(days.length - 1, directions[event.key]));
    onSelect(days[next].key);
    event.currentTarget.parentElement
      .querySelector(`[data-load-day="${next}"]`)
      ?.focus();
  };
  return (
    <section
      className="studio-card studio-calendar-insight"
      aria-label="Daily calendar workload"
    >
      <div className="studio-insight-heading">
        <div>
          <h2>Month at a glance</h2>
          <p>
            {loading
              ? "Loading schedule…"
              : `${monthEvents.length} ${monthEvents.length === 1 ? "event" : "events"} · ${activeDays} active days · current calendar filters`}
          </p>
        </div>
        <div className="studio-calendar-load-controls">
          <select
            aria-label="Inspect calendar day"
            value={days[selectedIndex].key}
            disabled={loading}
            onChange={(event) => {
              setHovered(null);
              onSelect(event.target.value);
            }}
          >
            {days.map((day) => (
              <option key={day.key} value={day.key}>
                {day.label}
              </option>
            ))}
          </select>
          <div className="studio-calendar-load-value" aria-live="polite">
            <strong>{active.label}</strong>
            <span>
              {loading ? "—" : active.count}{" "}
              {active.count === 1 ? "event" : "events"}
            </span>
          </div>
        </div>
      </div>
      <div
        className="studio-calendar-load"
        role="group"
        aria-label="Events per day. Use arrow keys to inspect dates."
      >
        {days.map((day, index) => (
          <button
            type="button"
            data-load-day={index}
            key={day.key}
            tabIndex={index === selectedIndex ? 0 : -1}
            aria-pressed={day.key === selected}
            aria-label={`${day.label}: ${day.count} ${day.count === 1 ? "event" : "events"}`}
            title={`${day.label}: ${day.count} events`}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            onPointerEnter={() => setHovered(index)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => onSelect(day.key)}
            onKeyDown={(event) => focusDay(event, index)}
          >
            <span
              className={
                "studio-calendar-load-bar" + (!day.count ? " empty" : "")
              }
              style={{
                height:
                  day.count && peak ? `${(day.count / peak) * 100}%` : "2px",
              }}
            />
            <small>
              {index === 0 || (index + 1) % 5 === 0 || index === days.length - 1
                ? day.day
                : ""}
            </small>
          </button>
        ))}
      </div>
      <p className="studio-insight-note">
        Events per day. Multi-day events appear on each day they cover.
      </p>
    </section>
  );
}
