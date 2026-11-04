import { STUDIO_X_MARK, STUDIO_X_LOGO_LIGHT, STUDIO_X_LOGO_DARK } from '../utils/branding';
import './studioProductBrand.css';

/** Product identity only. Studio-owned logos on documents stay independent. */
export default function StudioProductBrand({ className = '', tone = 'auto', compact = false }) {
  return <span className={`studio-x-brand-art ${compact ? 'is-mark' : 'is-lockup'} tone-${tone} ${className}`} role="img" aria-label="Studio X OS">
    <img className="studio-x-brand-symbol" src={STUDIO_X_MARK} alt="" width="192" height="192" decoding="async" />
    {!compact && <>
      <img className="studio-x-brand-lockup is-light" src={STUDIO_X_LOGO_LIGHT} alt="" width="2048" height="683" decoding="async" />
      <img className="studio-x-brand-lockup is-dark" src={STUDIO_X_LOGO_DARK} alt="" width="2048" height="683" decoding="async" />
    </>}
  </span>;
}
