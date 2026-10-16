import { useEffect, useRef } from "react";

/** Manage keyboard access and return focus for the topmost portalled dialog. */
export default function useStudioDialog(onClose, { enabled = true, canClose = true } = {}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  useEffect(() => { closeRef.current = onClose; canCloseRef.current = canClose; }, [onClose, canClose]);
  useEffect(() => {
    if (!enabled || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter((node) => node.getClientRects().length);
    (dialog.querySelector("[data-autofocus]") || focusables()[0] || dialog).focus();
    const keydown = (event) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") { event.preventDefault(); if (canCloseRef.current) closeRef.current?.(); }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [enabled]);
  return dialogRef;
}
