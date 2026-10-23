import { createElement } from 'react';

const tones = new Set(['blue', 'indigo', 'violet', 'rose', 'amber', 'green', 'cyan', 'slate']);

export default function StudioAppIcon({ icon, tone = 'blue', size = 40, className = '' }) {
  return <span className={`studio-app-icon tone-${tones.has(tone) ? tone : 'blue'} ${className}`} style={{ '--app-icon-size': `${size}px` }} aria-hidden="true">
    {createElement(icon, { strokeWidth: 1.8 })}
  </span>;
}
