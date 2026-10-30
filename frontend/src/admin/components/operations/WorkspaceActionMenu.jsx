import StudioButton from '../common/StudioButton';
import { Children, Fragment, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import useStudioDialog from "../studio/useStudioDialog";

const menuItems = children => Children.map(children, child => {
  if (!isValidElement(child)) return child;
  if (child.type === Fragment) return cloneElement(child, {}, menuItems(child.props.children));
  return ["button", "a"].includes(child.type) ? cloneElement(child, { role: "menuitem", tabIndex: -1 }) : child;
});

// One keyboard and dismissal pattern for document and client action menus.
export function WorkspaceActionMenu({ label = "Actions", ariaLabel, children, className = "reference-more", menuClassName = "reference-dropdown", primary = false, hideChevron = false, disabled = false, open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {const media=window.matchMedia("(max-width: 768px)");const update=()=>setPhone(media.matches);media.addEventListener("change",update);return()=>media.removeEventListener("change",update);}, []);
  const open = controlledOpen ?? localOpen;
  const id = useId();
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const lastItem = useRef(false);
  const setOpen = onOpenChange || setLocalOpen;
  const dialog = useStudioDialog(() => setOpen(false), { enabled: open && phone });

  useEffect(() => {
    if (!open) return;
    const buttons = () => [...menu.current.querySelectorAll('button:not([disabled]), a[href]')];
    const items = buttons();
    (lastItem.current ? items.at(-1) : items[0])?.focus();
    const dismiss = event => {
      if (!wrapper.current?.contains(event.target) && !menu.current?.contains(event.target) && !dialog.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, setOpen, phone, dialog]);

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
    <StudioButton ref={trigger} type="button" variant={primary ? "primary" : "ghost"} trailingIcon={hideChevron ? undefined : ChevronDown} className={primary ? "reference-button" : undefined} aria-label={ariaLabel || (typeof label==="string"?label:"Add new record")} aria-expanded={open} aria-controls={open ? (phone ? id+"-sheet" : id) : undefined} aria-haspopup={phone ? "dialog" : "menu"} disabled={disabled} onClick={() => { lastItem.current = false; setOpen(!open); }} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); lastItem.current = event.key === "ArrowUp"; setOpen(true); }
    }}>{label}</StudioButton>
    {open && (phone ? createPortal(<div className="studio-app studio-personal-workspace studio-action-sheet-overlay" onClick={event=>{if(event.target===event.currentTarget)close(true);}}>
      <section ref={dialog} id={id+'-sheet'} role="dialog" aria-modal="true" aria-labelledby={id+'-title'} className="studio-action-sheet">
        <header><h2 id={id+'-title'}>{ariaLabel || (typeof label==="string"?label:"Create a record")}</h2><StudioButton type="button" variant="icon" label="Close actions" icon={X} onClick={()=>close(true)} /></header>
        <div id={id} role="menu" aria-label={ariaLabel || (typeof label==="string"?label:"Create a record")} className="studio-action-sheet-items" ref={menu} onKeyDown={navigate} onClick={event=>{const item=event.target.closest("button,a");if(item&&!item.disabled)close();}}>{menuItems(children)}</div>
      </section>
    </div>,document.body) : <div id={id} className={menuClassName} role="menu" aria-label={typeof label==="string"?label:"Create a record"} ref={menu} onKeyDown={navigate} onClick={event => {
      const item = event.target.closest("button, a");
      if (item && !item.disabled) close();
    }}>{menuItems(children)}</div>)}
  </div>;
}
