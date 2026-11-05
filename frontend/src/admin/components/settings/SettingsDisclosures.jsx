import { createContext, useContext, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const DisclosureContext = createContext(null);

// Keep fields mounted so changing groups never drops edits or pending uploads.
export function SettingsDisclosures({ children }) {
  const [active, setActive] = useState(null);
  const pendingInvalid = useRef(false), reportingInvalid = useRef(false);
  const revealInvalid = event => {
    if (reportingInvalid.current) return;
    // reportValidity dispatches every invalid input. Reveal only the first one.
    event.preventDefault();
    if (pendingInvalid.current) return;
    pendingInvalid.current = true;
    const input = event.target;
    const group = input.closest('[data-settings-group]');
    if (group) setActive(group.dataset.settingsGroup);
    const template = input.closest('[data-settings-template][hidden]');
    if (template) template.dispatchEvent(new CustomEvent('studio-settings-reveal-template', { bubbles: true, detail: template.dataset.settingsTemplate }));
    for (let parent = input.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    requestAnimationFrame(() => {
      pendingInvalid.current = false;
      if (!input.isConnected) return;
      input.focus();
      reportingInvalid.current = true;
      input.reportValidity();
      reportingInvalid.current = false;
    });
  };
  return <DisclosureContext.Provider value={{ active, setActive }}><div className="settings-disclosures" onInvalidCapture={revealInvalid}>{children}</div></DisclosureContext.Provider>;
}

export function SettingsGroup({ title, description, children, defaultOpen = false, className = '' }) {
  const id = useId(), context = useContext(DisclosureContext);
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = context ? (context.active === null ? defaultOpen : context.active === id) : localOpen;
  const toggle = () => context ? context.setActive(open ? '' : id) : setLocalOpen(value => !value);
  return <section className={'settings-group settings-disclosure ' + className} data-settings-group={id}>
    <h3 className="settings-disclosure-heading"><button type="button" id={id + '-heading'} aria-expanded={open} aria-controls={id + '-content'} onClick={toggle}><span><strong>{title}</strong>{description && <small>{description}</small>}</span><ChevronDown size={18} className="settings-disclosure-chevron" aria-hidden="true" /></button></h3>
    <div className="settings-group-content" id={id + '-content'} role="region" aria-labelledby={id + '-heading'} hidden={!open}>{children}</div>
  </section>;
}
