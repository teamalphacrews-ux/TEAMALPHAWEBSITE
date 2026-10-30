import StudioButton from '../common/StudioButton';
import { useEffect, useId, useRef } from "react";
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowUpRight, Loader2, X } from "lucide-react";
import { isolateDialogBackground, lockDialogScroll } from '../studio/studioDialogIsolation';

export function OperationsModal({ title, description, onClose, children, footer, busy = false }) {
  const dialogId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement;
    const restoreScroll = lockDialogScroll(document);
    const panel = panelRef.current;
    const restoreBackground = isolateDialogBackground(panel);
    const focusables = () => [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
    const initialFocus = window.matchMedia('(max-width: 768px)').matches ? panel : panel.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])') || focusables()[0] || panel;
    initialFocus.focus({ preventScroll: true });
    const handleKey = (event) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== panel) return;
      if (event.key === "Escape") { event.preventDefault(); if (!busyRef.current) closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = focusables();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      restoreBackground();
      restoreScroll();
      previous?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="studio-app studio-personal-workspace studio-ops studio-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="studio-modal ops-modal" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} aria-describedby={description ? `${dialogId}-description` : undefined} aria-busy={busy} tabIndex={-1} ref={panelRef}>
        <div className="studio-modal-header">
          <div><h2 id={`${dialogId}-title`}>{title}</h2>{description && <p id={`${dialogId}-description`} className="studio-muted">{description}</p>}</div>
          <StudioButton type="button" variant="icon" className="ops-icon-button" label="Close dialog" icon={X} onClick={onClose} disabled={busy} />
        </div>
        <div className="ops-modal-body">{children}</div>
        {footer && <div className="studio-modal-footer">{footer}</div>}
      </section>
    </div>, document.body
  );
}
export function OperationsError({ children, onRetry }) {
  return <div className="studio-error ops-error" role="alert"><AlertCircle size={17} /><span>{children}</span>{onRetry && <button type="button" onClick={onRetry}>Try again <ArrowUpRight size={14} /></button>}</div>;
}
export function OperationsLoading({ label }) {
  return <div className="studio-empty ops-loading" role="status"><Loader2 size={23} className="ops-spin" /><span>{label}</span></div>;
}
