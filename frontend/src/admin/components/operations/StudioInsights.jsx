import { Link } from "react-router-dom";
import "./studioInsights.css";

export function ProgressRing({
  value,
  total,
  label,
  emptyLabel = "No data",
  tone = "blue",
}) {
  const percent =
    total > 0
      ? Math.max(0, Math.min(100, Math.round((value / total) * 100)))
      : 0;
  return (
    <div
      className={`studio-insight-ring ${tone}`}
      role="img"
      aria-label={total > 0 ? `${label}: ${percent}%` : emptyLabel}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle
          className="studio-ring-track"
          cx="60"
          cy="60"
          r="48"
          pathLength="100"
        />
        <circle
          className="studio-ring-fill"
          cx="60"
          cy="60"
          r="48"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
          strokeOpacity={percent > 0 ? 1 : 0}
          style={{ "--ring-fill": `${percent} 100` }}
        />
      </svg>
      <div>
        <strong>{total > 0 ? `${percent}%` : "—"}</strong>
        <span>{total > 0 ? label : emptyLabel}</span>
      </div>
    </div>
  );
}
const stages = [
  "New",
  "Follow-up",
  "Meeting",
  "Negotiation",
  "Converted",
  "Archived",
];
export function PipelineInsight({ pipeline = [], loading = false }) {
  const total = pipeline.reduce(
    (sum, item) => sum + Math.max(0, Number(item.count) || 0),
    0,
  );
  return (
    <div
      className="studio-insight-pipeline"
      aria-label="Enquiry stage distribution"
    >
      {stages.map((stage) => {
        const count = Math.max(
            0,
            Number(pipeline.find((item) => item.status === stage)?.count) || 0,
          ),
          percent = total ? (count / total) * 100 : 0;
        return (
          <Link
            to={`/admin/crm?stage=${encodeURIComponent(stage)}`}
            key={stage}
            className={
              "studio-insight-stage" + (stage === "Converted" ? " booked" : "")
            }
            aria-label={`${stage === "Converted" ? "Booked" : stage}: ${loading ? "loading" : `${count} enquiries, ${Math.round(percent)}%`} `}
          >
            <span>{stage === "Converted" ? "Booked" : stage}</span>
            <div className="studio-insight-track" aria-hidden="true">
              <i style={{ width: `${percent}%` }} />
            </div>
            <strong>{loading ? "—" : count}</strong>
            <small>{loading ? "—" : `${Math.round(percent)}%`}</small>
          </Link>
        );
      })}
    </div>
  );
}
export function TaskLoadInsight({ pending = 0, overdue = 0 }) {
  const due = Math.min(pending, overdue),
    percent = pending > 0 ? (due / pending) * 100 : 0;
  return (
    <div className="studio-task-load">
      <div>
        <span>{pending} pending</span>
        <span className={due ? "has-overdue" : ""}>{due} overdue</span>
      </div>
      <div
        className="studio-insight-track"
        role="img"
        aria-label={`${due} of ${pending} pending tasks are overdue`}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
