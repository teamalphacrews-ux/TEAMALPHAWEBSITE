import StudioSelect from '../common/StudioSelect';
import { useState } from "react";
import { IS_COMMERCIAL_DEPLOYMENT } from "../../../saas/release";
import "../operations/studioInsights.css";

export default function CalendarInsights({
  monthLoad,
  selected,
  onSelect,
  loading,
  dayLabels,
}) {
  const {
    days,
    events: monthEvents,
    activeDays,
    peak,
  } = monthLoad;
  const [hovered, setHovered] = useState(null);
  const selectedIndex = Math.max(
    0,
    days.findIndex((day) => day.key === selected),
  );
  const active = days[hovered ?? selectedIndex] || days[0];
  const firstWeekday = (new Date(days[0].key + "T12:00:00Z").getUTCDay() + 6) % 7 + 1;
  const focusDay = (event, index) => {
    const directions = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: days.length - 1,
    };
    if (getComputedStyle(event.currentTarget.parentElement).gridAutoFlow === "row") {
      directions.ArrowUp = index - 7;
      directions.ArrowDown = index + 7;
    }
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
          <StudioSelect
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
                {dayLabels.get(day.key)}
              </option>
            ))}
          </StudioSelect>
          <div className="studio-calendar-load-value" aria-live="polite">
            <strong>{dayLabels.get(active.key)}</strong>
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
        style={IS_COMMERCIAL_DEPLOYMENT ? { "--load-first-weekday": firstWeekday } : undefined}
      >
        {IS_COMMERCIAL_DEPLOYMENT && ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(label =>
          <span key={label} className="calendar-load-weekday" aria-hidden="true">{label}</span>
        )}
        {days.map((day, index) => (
          <button
            type="button"
            data-load-day={index}
            key={day.key}
            tabIndex={index === selectedIndex ? 0 : -1}
            aria-pressed={day.key === selected}
            aria-label={`${dayLabels.get(day.key)}: ${day.count} ${day.count === 1 ? "event" : "events"}`}
            title={`${dayLabels.get(day.key)}: ${day.count} events`}
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
            <small>{index === 0 || index === days.length - 1 || ((index + 1) % 5 === 0 && index < days.length - 3)
              ? day.day : IS_COMMERCIAL_DEPLOYMENT && <span className="calendar-load-extra-date">{day.day}</span>}</small>
            {IS_COMMERCIAL_DEPLOYMENT && day.count > 0 && <span className="calendar-load-count" aria-hidden="true">{day.count}</span>}
          </button>
        ))}
      </div>
      <p className="studio-insight-note">
        Events per day. Multi-day events appear on each day they cover.
      </p>
    </section>
  );
}
