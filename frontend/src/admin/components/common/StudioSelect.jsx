import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import useStudioDialog from '../studio/useStudioDialog';
import { selectOptions } from './selectOptions';
import './studioSelect.css';

/** Native form semantics on desktop; a bounded, searchable choice sheet on phones. */
export default function StudioSelect({ children, className = '', value, defaultValue, onChange, onInvalid, disabled, title, ...props }) {
  const native = useRef(null), trigger = useRef(null), list = useRef(null);
  const uid = useId();
  const options = selectOptions(children);
  const [localValue, setLocalValue] = useState(defaultValue ?? options[0]?.value ?? '');
  const selectedValue = String(value ?? localValue);
  const selected = options.find(option => option.value === selectedValue);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [heading, setHeading] = useState('');
  const close = () => setOpen(false);
  const dialog = useStudioDialog(close, { enabled: open });
  const show = () => {
    if (disabled) return;
    const label = trigger.current?.closest('label')?.querySelector(':scope > span')?.textContent;
    const external = props.id && document.querySelector('label[for="' + CSS.escape(props.id) + '"]')?.textContent;
    setHeading(title || props['aria-label'] || label || external || 'Choose an option');
    setQuery(''); setOpen(true);
  };
  const choose = option => {
    if (option.disabled) return;
    const select = native.current;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
  };
  const filtered = options.filter(option => !query || option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const navigate = event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const rows = [...list.current.querySelectorAll('[role="option"]:not([disabled])')];
    const current = rows.indexOf(document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    rows[index]?.focus();
  };
  return <span className={'studio-select ' + className}>
    <select {...props} ref={native} className={'studio-select-native ' + className} value={value} defaultValue={value === undefined ? defaultValue : undefined} disabled={disabled}
      onChange={event => { setLocalValue(event.target.value); onChange?.(event); }}
      onInvalid={event => { onInvalid?.(event); if (window.matchMedia('(max-width: 768px)').matches) { event.preventDefault(); show(); } }}>
      {children}
    </select>
    <button ref={trigger} type="button" className={'studio-select-trigger ' + className} disabled={disabled} role="combobox" aria-label={(props['aria-label'] || title) ? (props['aria-label'] || title) + ": " + (selected?.label || "") : undefined} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-invalid={props['aria-invalid']} aria-required={props.required || undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? uid : undefined} onClick={show} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); show(); } }}>
      <span className="studio-select-value">{selected?.label || options[0]?.label || 'Choose an option'}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && createPortal(<div className="studio-app studio-select-overlay" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className="studio-select-sheet" role="dialog" aria-modal="true" aria-labelledby={uid + '-title'} id={uid}>
        <div className="studio-select-sheet-header"><div><span>SELECT OPTION</span><h2 id={uid + '-title'}>{heading}</h2></div><button type="button" aria-label="Close options" onClick={close}><X size={19}/></button></div>
        {options.length > 8 && <label className="studio-select-search"><Search size={17}/><input type="search" placeholder="Search options" aria-label="Search options" value={query} onChange={event => setQuery(event.target.value)}/></label>}
        <div ref={list} className="studio-select-options" role="listbox" aria-label={heading} onKeyDown={navigate}>
          {filtered.map((option, index) => <button type="button" role="option" aria-selected={selectedValue === option.value} disabled={option.disabled} key={option.value + ':' + index} onClick={() => choose(option)}>
            <span>{option.group && <small>{option.group}</small>}{option.label}</span>{selectedValue === option.value && <Check size={18} aria-hidden="true"/>}
          </button>)}
          {!filtered.length && <p className="studio-select-no-results">No matching options.</p>}
        </div>
      </section>
    </div>, document.body)}
  </span>;
}
