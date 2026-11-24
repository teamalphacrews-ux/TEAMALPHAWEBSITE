import { Expand } from 'lucide-react';
import { PRODUCT_SCREENSHOTS } from './productScreenshotCatalog';
import './productWorkspaceCapture.css';

export default function ProductWorkspaceCapture({ view, caption, className = '', theme = 'dark', phoneSource = true }) {
  const screen = PRODUCT_SCREENSHOTS[view];
  const files = screen[theme];
  const mobile = phoneSource && files.mobile2x;
  const fullSize = (href, className) => (
    <a href={href} className={className} target="_blank" rel="noreferrer" aria-label={'Open full-size screenshot of ' + screen.title}>
      <Expand size={14} aria-hidden="true" />Full size
    </a>
  );
  return (
    <figure className={'sos-workspace-capture ' + className} data-screen={view}>
      <picture>
        {mobile && <source media="(max-width: 600px)" srcSet={mobile} width={screen.mobileWidth} height={screen.mobileHeight} />}
        <img src={files.desktop} srcSet={files.desktop + ' 1440w, ' + files.desktop2x + ' 2880w'}
          sizes="(max-width: 850px) 92vw, (max-width: 1440px) 48vw, 650px" width={screen.width} height={screen.height}
          alt={screen.alt} loading="lazy" decoding="async" />
      </picture>
      <figcaption>
        <span>{caption || screen.title}</span>
        {fullSize(files.desktop2x, mobile ? 'sos-capture-desktop-link' : undefined)}
        {mobile && fullSize(mobile, 'sos-capture-phone-link')}
      </figcaption>
    </figure>
  );
}
