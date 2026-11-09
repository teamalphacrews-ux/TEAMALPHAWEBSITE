import { createElement, useState } from 'react';
import { ArrowUpRight, Clapperboard, Layers3, Moon, Sun, Wallet } from 'lucide-react';
import './productScreens.css';

const assetRoot = '/assets/studio-x-os/screens/20261109/';
const screens = [
  { id: 'overview', name: 'Overview', icon: Layers3, description: 'Your projects, schedule and studio activity, together.', alt: 'Studio X OS Overview with project activity, a studio calendar and work summaries.' },
  { id: 'finance', name: 'Finance', icon: Wallet, description: 'A clear view of invoices, receipts and business records.', alt: 'Studio X OS Finance workspace with financial summaries, sample invoices and balances due.' },
  { id: 'production', name: 'Production', icon: Clapperboard, description: 'Keep the next edit, review and delivery in view.', alt: 'Studio X OS Production workspace with sample deliverables, progress and production tasks.' },
];

export function ProductScreenImage({ view = 'overview', dark = false, decorative = false, phoneSource = true, className = '', sizes = '(max-width: 1200px) calc(100vw - 80px), 1130px' }) {
  const screen = screens.find(item => item.id === view) || screens[0];
  const prefix = assetRoot + screen.id + (dark ? '-dark-' : '-light-');
  return <picture className={'sos-product-screen-image ' + (phoneSource ? 'has-phone-source ' : '') + className}>
    {phoneSource && <source media="(max-width: 600px)" srcSet={prefix + 'mobile@2x.webp'} width="780" height="1688" />}
    <img src={prefix + 'desktop.webp'} srcSet={prefix + 'desktop.webp 1440w, ' + prefix + 'desktop@2x.webp 2880w'} sizes={sizes} width="2880" height="1920" loading="lazy" decoding="async" alt={decorative ? '' : screen.alt + (dark ? ' Dark mode.' : ' Daylight mode.') + ' All records are sample data.'} />
  </picture>;
}

export default function ProductScreens() {
  const [view, setView] = useState('overview');
  const [dark, setDark] = useState(false);
  const screen = screens.find(item => item.id === view);
  const chooseWithKeyboard = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = screens.findIndex(item => item.id === view);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : screens.length - 1)) % screens.length;
    setView(screens[next].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className={'sos-demo sos-product-preview sos-screen-preview' + (dark ? ' is-dark' : '')} id="product-demo">
    <div className="sos-preview-tools">
      <div role="tablist" aria-label="Product demo screens" onKeyDown={chooseWithKeyboard}>
        {screens.map(item => <button key={item.id} type="button" role="tab" id={'sos-demo-tab-' + item.id} aria-selected={view === item.id} aria-controls="sos-demo-content" tabIndex={view === item.id ? 0 : -1} onClick={() => setView(item.id)}>{createElement(item.icon, { size: 16 })}{item.name}</button>)}
      </div>
      <span className="sos-screen-tools-note">Inside Studio X OS</span>
      <button type="button" className="sos-preview-theme" onClick={() => setDark(value => !value)} aria-label={dark ? 'Show daylight preview' : 'Show dark preview'}>{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? 'Daylight' : 'Dark mode'}</span></button>
    </div>
    <div className="sos-screen-panel" id="sos-demo-content" role="tabpanel" tabIndex={0} aria-labelledby={'sos-demo-tab-' + view}>
      <ProductScreenImage view={view} dark={dark} />
      <div className="sos-screen-caption"><div><p>{screen.description}</p><span>Product screen capture · Sample studio</span></div><a className="sos-screen-expand desktop" href={assetRoot + view + (dark ? '-dark-' : '-light-') + 'desktop@2x.webp'} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={16} /></a><a className="sos-screen-expand mobile" href={assetRoot + view + (dark ? '-dark-' : '-light-') + 'mobile@2x.webp'} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={16} /></a></div>
    </div>
  </div>;
}
