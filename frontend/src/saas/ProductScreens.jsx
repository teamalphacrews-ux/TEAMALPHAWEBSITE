import { createElement, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, Clapperboard, Layers3, Moon, RefreshCw, Sun, Wallet } from 'lucide-react';
import './productScreens.css';
import './productScreenTransition.css';

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
  const [{ view, dark }, setSelection] = useState({ view: 'overview', dark: false });
  const [loading, setLoading] = useState('');
  const [loadError, setLoadError] = useState('');
  const transition = useRef(null), version = useRef({ value: 0 });
  const requested = useRef({ view: 'overview', dark: false });
  const imageRequest = useRef(null);
  const retryButton = useRef(null), panel = useRef(null);
  const screen = screens.find(item => item.id === view);

  const selectScreen = async (next, retry = false) => {
    if (!retry && next.view === requested.current.view && next.dark === requested.current.dark) return;
    requested.current = next;
    const request = ++version.current.value;
    imageRequest.current?.();
    transition.current?.skipTransition();
    const name = screens.find(item => item.id === next.view).name;
    if (retry && document.activeElement === retryButton.current) panel.current?.focus({ preventScroll: true });
    setLoading(`Opening ${name} in ${next.dark ? 'dark' : 'daylight'} mode…`);
    setLoadError('');
    const image = new Image();
    const prefix = assetRoot + next.view + (next.dark ? '-dark-' : '-light-');
    const phone = window.matchMedia('(max-width: 600px)').matches;
    let stop;
    try {
      await new Promise((resolve, reject) => {
        let complete = false;
        const finish = error => {
          if (complete) return;
          complete = true;
          window.clearTimeout(timeout);
          image.onload = null;
          image.onerror = null;
          if (imageRequest.current === stop) imageRequest.current = null;
          if (error) reject(error); else resolve();
        };
        stop = () => finish(new Error('cancelled'));
        imageRequest.current = stop;
        const timeout = window.setTimeout(() => finish(new Error('timeout')), 15000);
        image.onload = () => {
          // Decode before starting the shutter so the new frame is ready to read.
          if (image.decode) image.decode().then(() => finish(), () => finish(new Error('decode')));
          else finish();
        };
        image.onerror = () => finish(new Error('image'));
        if (!phone) {
          image.sizes = '(max-width: 1200px) calc(100vw - 80px), 1130px';
          image.srcset = prefix + 'desktop.webp 1440w, ' + prefix + 'desktop@2x.webp 2880w';
        }
        image.src = prefix + (phone ? 'mobile@2x.webp' : 'desktop.webp');
      });
      if (request !== version.current.value) return;
      const update = () => {
        if (request !== version.current.value) return;
        flushSync(() => { setSelection(next); setLoading(''); });
      };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof document.startViewTransition !== 'function' || document.hidden) {
        update();
        return;
      }
      transition.current = document.startViewTransition(update);
      transition.current.ready.catch(() => {});
      transition.current.finished.catch(() => {});
    } catch {
      if (request !== version.current.value) return;
      setLoading('');
      setLoadError(`The ${name} preview couldn’t load. Your current view is still here.`);
    }
  };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const requests = version.current;
    const stopTransition = () => { if (preference.matches || document.hidden) transition.current?.skipTransition(); };
    preference.addEventListener('change', stopTransition);
    document.addEventListener('visibilitychange', stopTransition);
    return () => {
      requests.value++;
      imageRequest.current?.();
      transition.current?.skipTransition();
      preference.removeEventListener('change', stopTransition);
      document.removeEventListener('visibilitychange', stopTransition);
    };
  }, []);

  const chooseWithKeyboard = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = screens.findIndex(item => item.id === requested.current.view);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : screens.length - 1)) % screens.length;
    selectScreen({ ...requested.current, view: screens[next].id });
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className={'sos-demo sos-product-preview sos-screen-preview' + (dark ? ' is-dark' : '')}>
    <div className="sos-preview-tools">
      <div role="tablist" aria-label="Product demo screens" onKeyDown={chooseWithKeyboard}>
        {screens.map(item => <button key={item.id} type="button" role="tab" id={'sos-demo-tab-' + item.id} aria-selected={view === item.id} aria-controls="sos-demo-content" tabIndex={view === item.id ? 0 : -1} onClick={() => selectScreen({ ...requested.current, view: item.id })}>{createElement(item.icon, { size: 16 })}{item.name}</button>)}
      </div>
      <span className="sos-screen-tools-note">Inside Studio X OS</span>
      <button type="button" className="sos-preview-theme" onClick={() => selectScreen({ ...requested.current, dark: !requested.current.dark })} aria-label={dark ? 'Show daylight preview' : 'Show dark preview'}>{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? 'Daylight' : 'Dark mode'}</span></button>
    </div>
    <div className="sos-screen-feedback" role="status" aria-live="polite" aria-atomic="true">{loading || loadError || `${screen.name} · ${dark ? 'Dark' : 'Daylight'} preview`}{loadError && <button ref={retryButton} type="button" onClick={() => selectScreen(requested.current, true)}>Try again<RefreshCw size={14}/></button>}</div>
    <div ref={panel} className="sos-screen-panel" id="sos-demo-content" role="tabpanel" tabIndex={0} aria-labelledby={'sos-demo-tab-' + view} aria-busy={Boolean(loading)}>
      <ProductScreenImage view={view} dark={dark} />
      <div className="sos-screen-caption"><div><p>{screen.description}</p><span>Product screen capture · Sample studio</span></div><a className="sos-screen-expand desktop" href={assetRoot + view + (dark ? '-dark-' : '-light-') + 'desktop@2x.webp'} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={16} /></a><a className="sos-screen-expand mobile" href={assetRoot + view + (dark ? '-dark-' : '-light-') + 'mobile@2x.webp'} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={16} /></a></div>
    </div>
  </div>;
}
