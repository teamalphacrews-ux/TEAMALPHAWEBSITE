import StudioButton from '../common/StudioButton';
import { Children, Fragment, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import useStudioDialog from "../studio/useStudioDialog";
import StudioPortalSurface from '../common/StudioPortalSurface';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import useWorkspaceMotionPresence from '../common/useWorkspaceMotionPresence';
import './studioCommercialMenus.css';

const menuItems = (children, sequential = false) => Children.map(children, child => {
  if (!isValidElement(child)) return child;
  if (child.type === Fragment) return cloneElement(child, {}, menuItems(child.props.children, sequential));
  return ["button", "a"].includes(child.type) ? cloneElement(child, { role: "menuitem", tabIndex: sequential ? 0 : -1, ...(child.type === 'button' ? { type: child.props.type ?? 'button' } : {}) }) : child;
});

// One keyboard and dismissal pattern for document and client action menus.
export function WorkspaceActionMenu({ label = "Actions", ariaLabel, children, className = "reference-more", menuClassName = "reference-dropdown", primary = false, hideChevron = false, disabled = false, open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {const media=window.matchMedia("(max-width: 768px)");const update=()=>setPhone(media.matches);media.addEventListener("change",update);return()=>media.removeEventListener("change",update);}, []);
  const open = controlledOpen ?? localOpen;
  const { present, leaving } = useWorkspaceMotionPresence(open, phone ? 320 : 150, IS_COMMERCIAL_DEPLOYMENT);
  const id = useId();
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const lastItem = useRef(false);
  const [position, setPosition] = useState({ top: 12, left: 12, width: 240, maxHeight: 480, side: 'below' });
  const setOpen = onOpenChange || setLocalOpen;
  const dialog = useStudioDialog(() => setOpen(false), { enabled: open && phone });

  // Commercial menus escape clipping cards and the animated route region.
  // The anchor is remeasured rather than relying on a transformed ancestor.
  useLayoutEffect(() => {
    if (!IS_COMMERCIAL_DEPLOYMENT || !open || phone) return undefined;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor || !menu.current) return;
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      const width = Math.min(Math.max(anchor.width, 232), Math.max(0, viewportWidth - 24));
      const height = Math.min(menu.current.scrollHeight, Math.max(0, viewportHeight - 24));
      const below = y + viewportHeight - anchor.bottom - 12;
      const above = anchor.top - y - 12;
      const side = height > below && above > below ? 'above' : 'below';
      const maxHeight = Math.max(0, side === 'above' ? above - 8 : below - 8);
      const top = side === 'above' ? Math.max(y + 12, anchor.top - Math.min(height, maxHeight) - 8) : Math.max(y + 12, anchor.bottom + 8);
      const left = Math.max(x + 12, Math.min(anchor.right - width, x + viewportWidth - width - 12));
      setPosition({ top, left, width, maxHeight, side });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, phone]);

  useEffect(() => {
    if (!open) return;
    const buttons = () => [...(menu.current?.querySelectorAll('button:not([disabled]), a[href]') || [])];
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
    if (event.key === "Tab") {
      if (IS_COMMERCIAL_DEPLOYMENT) {
        // Move native Tab/Shift+Tab from the trigger's position in the page,
        // rather than the body portal's position at the end of the document.
        // Phone sheets keep their modal focus owner and remain open.
        if (!phone) close(true);
      } else close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...(menu.current?.querySelectorAll('button:not([disabled]), a[href]') || [])];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  const desktopMenu = <div id={id} className={menuClassName + (IS_COMMERCIAL_DEPLOYMENT ? ' studio-action-popover-menu' : '')} role="menu" aria-label={ariaLabel || (typeof label==="string"?label:"Create a record")} ref={menu} onKeyDown={navigate} onClick={event => {
    const item = event.target.closest("button, a");
    if (item && !item.disabled) close(item.getAttribute('aria-haspopup') === 'dialog');
  }}>{menuItems(children)}</div>;

  return <div className={className} ref={wrapper}>
    <StudioButton ref={trigger} type="button" variant={primary ? "primary" : "ghost"} trailingIcon={hideChevron ? undefined : ChevronDown} className={primary ? "reference-button" : undefined} aria-label={ariaLabel || (typeof label==="string"?label:"Add new record")} aria-expanded={open} aria-controls={open ? (phone ? id+"-sheet" : id) : undefined} aria-haspopup={phone ? "dialog" : "menu"} disabled={disabled} onClick={() => { lastItem.current = false; setOpen(!open); }} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); lastItem.current = event.key === "ArrowUp"; setOpen(true); }
    }}>{label}</StudioButton>
    {present && (phone ? createPortal(<StudioPortalSurface className="studio-action-sheet-overlay" data-leaving={leaving || undefined} inert={leaving} aria-hidden={leaving || undefined} onClick={event=>{if(event.target===event.currentTarget)close(true);}}>
      <section ref={dialog} id={id+'-sheet'} role="dialog" aria-modal={leaving ? undefined : true} aria-labelledby={id+'-title'} className="studio-action-sheet">
        <header><h2 id={id+'-title'}>{ariaLabel || (typeof label==="string"?label:"Create a record")}</h2><StudioButton type="button" variant="icon" label="Close actions" icon={X} onClick={()=>close(true)} /></header>
        <div id={id} role="menu" aria-label={ariaLabel || (typeof label==="string"?label:"Create a record")} className="studio-action-sheet-items" ref={menu} onKeyDown={navigate} onClick={event=>{const item=event.target.closest("button,a");if(item&&!item.disabled)close();}}>{menuItems(children, IS_COMMERCIAL_DEPLOYMENT)}</div>
      </section>
    </StudioPortalSurface>,document.body) : IS_COMMERCIAL_DEPLOYMENT ? createPortal(<StudioPortalSurface className="studio-action-popover" data-leaving={leaving || undefined} inert={leaving} aria-hidden={leaving || undefined} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }} data-placement={position.side}>{desktopMenu}</StudioPortalSurface>, document.body) : desktopMenu)}
  </div>;
}
