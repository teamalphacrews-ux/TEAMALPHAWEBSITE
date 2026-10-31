import { useEffect, useId, useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';

export default function DocumentSettingsPanel({ children, title, description }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const id = useId();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <>
    <button type="button" className="studio-document-settings-toggle" aria-expanded={!phone || open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Settings2 size={19} aria-hidden="true" /><span>{title}<small>{description}</small></span><ChevronDown size={18} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
    </button>
    <div id={id} className="studio-document-settings-panel" hidden={phone && !open} onInvalidCapture={event => {
      if (!phone || open) return;
      event.preventDefault();
      const input = event.target;
      setOpen(true);
      requestAnimationFrame(() => { if (input.isConnected) input.focus(); });
    }}>{children}</div>
  </>;
}
