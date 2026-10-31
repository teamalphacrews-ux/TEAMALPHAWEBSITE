import StudioIcon from './StudioIcon';

const tones = new Set(['blue', 'indigo', 'violet', 'rose', 'amber', 'green', 'cyan', 'slate']);

export default function StudioAppIcon({ icon, tone = 'blue', size = 40, className = '', name, status = 'idle', activityLevel = 0, motion = 'interaction' }) {
  return <span className={`studio-app-icon studio-symbol-tile studio-symbol-precision tone-${tones.has(tone) ? tone : 'blue'} ${className}`} style={{ '--app-icon-size': `${size}px` }} aria-hidden="true">
    <StudioIcon icon={icon} name={name} size={Math.max(16,Math.min(24,Math.round(size*.55)))} status={status} activityLevel={activityLevel} motion={motion} decorative />
  </span>;
}
