import { useEffect, useRef } from "react";
import { AlertCircle, ArrowUpRight, Loader2, X } from "lucide-react";

export function OperationsModal({ title, description, onClose, children, footer, busy = false }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.querySelector("input, select, textarea, button")?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="studio-ops studio-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="studio-modal ops-modal" role="dialog" aria-modal="true" aria-labelledby="operations-modal-title" ref={panelRef}>
        <div className="studio-modal-header">
          <div><h2 id="operations-modal-title">{title}</h2>{description && <p className="studio-muted">{description}</p>}</div>
          <button type="button" className="ops-icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>
        <div className="ops-modal-body">{children}</div>
        {footer && <div className="studio-modal-footer">{footer}</div>}
      </section>
    </div>
  );
}
export function OperationsError({ children, onRetry }) {
  return <div className="studio-error ops-error" role="alert"><AlertCircle size={17} /><span>{children}</span>{onRetry && <button type="button" onClick={onRetry}>Try again <ArrowUpRight size={14} /></button>}</div>;
}
export function OperationsLoading({ label }) {
  return <div className="studio-empty ops-loading" role="status"><Loader2 size={23} className="ops-spin" /><span>{label}</span></div>;
}
