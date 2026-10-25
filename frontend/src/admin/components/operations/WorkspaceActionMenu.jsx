import { Children, Fragment, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const menuItems = children => Children.map(children, child => {
  if (!isValidElement(child)) return child;
  if (child.type === Fragment) return cloneElement(child, {}, menuItems(child.props.children));
  return ["button", "a"].includes(child.type) ? cloneElement(child, { role: "menuitem", tabIndex: -1 }) : child;
});

// One keyboard and dismissal pattern for document and client action menus.
export function WorkspaceActionMenu({ label = "Actions", children, className = "reference-more", menuClassName = "reference-dropdown", primary = false, disabled = false, open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const id = useId();
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const lastItem = useRef(false);
  const setOpen = onOpenChange || setLocalOpen;

  useEffect(() => {
    if (!open) return;
    const buttons = () => [...menu.current.querySelectorAll('button:not([disabled]), a[href]')];
    const items = buttons();
    (lastItem.current ? items.at(-1) : items[0])?.focus();
    const dismiss = event => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, setOpen]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  const navigate = event => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") { close(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...menu.current.querySelectorAll('button:not([disabled]), a[href]')];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  return <div className={className} ref={wrapper}>
    <button ref={trigger} type="button" className={primary ? "reference-button" : undefined} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="menu" disabled={disabled} onClick={() => { lastItem.current = false; setOpen(!open); }} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); lastItem.current = event.key === "ArrowUp"; setOpen(true); }
    }}>{label}<ChevronDown size={14} aria-hidden="true" /></button>
    {open && <div id={id} className={menuClassName} role="menu" aria-label={label} ref={menu} onKeyDown={navigate} onClick={event => {
      const item = event.target.closest("button, a");
      if (item && !item.disabled) close();
    }}>{menuItems(children)}</div>}
  </div>;
}
