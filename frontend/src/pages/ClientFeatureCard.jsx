import { ArrowUpRight, LockKeyhole } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function ClientFeatureCard({ id, label, icon: Icon, tone, value, status, detail, footnote, onClick, open, disabled = false, progress = null }) {
  const CardIcon = Icon;
  const card = useRef(null);
  const [motionActive, setMotionActive] = useState(false);
  useEffect(() => {
    let onscreen = false;
    const update = () => setMotionActive(onscreen && !document.hidden);
    const observer = new IntersectionObserver(entries => { onscreen = entries[0].isIntersecting; update(); }, { threshold: 0.05 });
    observer.observe(card.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <button ref={card} type="button" className={'cp-feature-card tone-' + tone} data-motion-active={motionActive} onClick={onClick} disabled={disabled} aria-expanded={disabled ? undefined : open} aria-controls={disabled ? undefined : 'project-' + id + '-panel'}>
    <span className={'cp-feature-fluid cp-motion-' + tone} aria-hidden="true">
      {tone === 'quote' && <><i /><i /><i /></>}
      {tone === 'invoice' && <><i /><i /><i /><span className="cp-invoice-grid">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</span></>}
      {tone === 'payments' && <><i /><svg viewBox="0 0 600 180" preserveAspectRatio="none"><path d="M0 85 C100 5 200 155 300 85 C400 15 500 155 600 85 V180 H0Z" /><path d="M0 110 C110 35 210 165 300 110 C390 45 510 175 600 110 V180 H0Z" /><path d="M0 135 C90 75 220 180 300 135 C390 85 510 180 600 135 V180 H0Z" /></svg></>}
      {tone === 'production' && <><i /><i /><i /><span /></>}
    </span>
    <span className="cp-feature-top"><span className="cp-feature-icon"><CardIcon size={19} strokeWidth={1.6} aria-hidden="true" /></span><span>{label}</span>{disabled && <LockKeyhole size={13} aria-hidden="true" />}</span>
    <span className="cp-feature-status">{status}</span>
    <strong className="cp-feature-value">{value}</strong>
    <span className="cp-feature-detail">{detail}</span>
    {progress !== null && <span className="cp-feature-progress" aria-hidden="true"><i style={{ width: progress + '%' }} /></span>}
    <span className="cp-feature-footer"><span>{footnote}</span>{!disabled && <ArrowUpRight size={17} aria-hidden="true" />}</span>
  </button>;
}
