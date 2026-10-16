import { RefreshCw, Search } from "lucide-react";
import { OperationsModal } from "./OperationsUI";
import "../../pages/studioOperations.css";
import "../../workspace.css";
export function WorkspaceHeader({ eyebrow, title, description, children }) {
  return (
    <div className="studio-page-heading">
      <div>
        <span className="studio-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="studio-heading-actions">{children}</div>
    </div>
  );
}
export function WorkspaceMetrics({ items, loading }) {
  return (
    <div className="studio-metric-grid">
      {items.map((item) => (
        <div className="studio-metric" key={item.label}>
          <span className="workspace-metric-label">{item.label}</span>
          <strong className="workspace-metric-value">
            {loading ? "—" : item.value}
          </strong>
          <small className="studio-muted">{item.note}</small>
        </div>
      ))}
    </div>
  );
}
export function WorkspaceError({ error, retry }) {
  return error ? (
    <div role="alert" className="studio-error">
      <span>{error}</span>
      {retry && (
        <button className="studio-button small" onClick={retry}>
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  ) : null;
}
export function WorkspaceSearch({
  value,
  onChange,
  placeholder = "Search records…",
}) {
  return (
    <label className="studio-search">
      <Search size={15} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function WorkspaceEmpty({
  loading,
  title = "No records yet",
  description = "Add the first record to get started.",
}) {
  return (
    <div className="studio-empty" role="status">
      {loading ? (
        <>
          <span className="studio-loader" /> Loading your workspace…
        </>
      ) : (
        <>
          <h3>{title}</h3>
          <p>{description}</p>
        </>
      )}
    </div>
  );
}
export function WorkspaceDialog({
  title,
  onClose,
  onSubmit,
  children,
  busy,
  error,
  submitLabel = "Save changes",
  footer,
}) {
  return (
    <OperationsModal
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        footer || (
          <>
            <button className="studio-button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              className="studio-button primary"
              form="workspace-record-form"
              disabled={busy}
            >
              {busy ? "Saving…" : submitLabel}
            </button>
          </>
        )
      }
    >
      <WorkspaceError error={error} />
      <form
        id="workspace-record-form"
        onSubmit={onSubmit}
        className="workspace-form"
      >
        {children}
      </form>
    </OperationsModal>
  );
}
export function WorkspaceField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  options,
  wide = false,
  help,
  min,
  max,
  step,
}) {
  return (
    <label className={"studio-field" + (wide ? " workspace-wide" : "")}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {type === "textarea" ? (
        <textarea
          className="studio-input"
          value={value ?? ""}
          onChange={(event) => onChange(name, event.target.value)}
          required={required}
        />
      ) : options ? (
        <select
          className="studio-input"
          value={value ?? ""}
          onChange={(event) => onChange(name, event.target.value)}
          required={required}
        >
          {options.map((option) => (
            <option
              key={typeof option === "string" ? option : option.value}
              value={typeof option === "string" ? option : option.value}
            >
              {typeof option === "string" ? option : option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="studio-input"
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(name, event.target.value)}
          required={required}
          min={min}
          max={max}
          step={step}
        />
      )}{" "}
      {help && <small>{help}</small>}
    </label>
  );
}
