import StudioButton from '../common/StudioButton';
import StudioSelect from '../common/StudioSelect';
import { useId } from "react";
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
        <p className="studio-muted">{description}</p>
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
          <strong className={'workspace-metric-value' + (item.kind === 'label' ? ' is-label' : '')}>
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
  children,
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
          {children}
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
  const formId = useId();
  return (
    <OperationsModal
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        footer || (
          <>
            <StudioButton type="button" disabled={busy} onClick={onClose}>Cancel</StudioButton>
            <StudioButton variant="primary" type="submit" form={formId} loading={busy} loadingLabel="Saving changes">{submitLabel}</StudioButton>
          </>
        )
      }
    >
      <WorkspaceError error={error} />
      <form
        id={formId}
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
        <StudioSelect
          title={label}
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
        </StudioSelect>
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
