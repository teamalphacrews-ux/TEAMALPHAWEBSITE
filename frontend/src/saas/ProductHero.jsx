import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Camera, Link2, Pause, Play, UsersRound } from 'lucide-react';
import { PRODUCT_BRAND } from './productBrandAssets';
import PrismaticField from './PrismaticField';
import HeroLightning from './HeroLightning';
import './prismaticHero.css';

const bounded = value => Math.max(0, Math.min(1, value));
const interval = (value, start, end) => { const point = bounded((value - start) / (end - start)); return point * point * (3 - 2 * point); };

export default function ProductHero({ children }) {
  const launch = useRef(null);
  const chamber = useRef(null);
  const heroRunway = useRef(null);
  const heroPin = useRef(null);
  const showcase = useRef(null);
  const pointerFrame = useRef(0);
  const pointerPosition = useRef(null);
  const [paused, setPaused] = useState(false);

  useLayoutEffect(() => {
    const surface = launch.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const finishArrival = () => { surface.dataset.heroIntro = reducedMotion.matches ? 'skipped' : 'complete'; };
    const sync = () => {
      surface.dataset.heroMotion = reducedMotion.matches ? 'reduced' : 'full';
      surface.dataset.heroRunning = String(visible && !document.hidden && !reducedMotion.matches && surface.dataset.heroPaused !== 'true');
      if (reducedMotion.matches) surface.dataset.heroIntro = 'skipped';
      else if (document.hidden || surface.dataset.heroPaused === 'true' || surface.dataset.heroIntro === 'skipped') finishArrival();
    };
    const focusChanged = event => { if (event.target.matches?.(':focus-visible')) finishArrival(); };
    const keyboardEntered = event => { if (event.key === 'Tab' && !reducedMotion.matches) finishArrival(); };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      sync();
    }, { threshold: 0.01 }) : null;
    observer?.observe(chamber.current);
    const timer = window.setTimeout(() => { if (!reducedMotion.matches) finishArrival(); }, 1800);
    sync();
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('keydown', keyboardEntered, true);
    reducedMotion.addEventListener('change', sync);
    surface.addEventListener('sos:hero-motion', sync);
    surface.addEventListener('focusin', focusChanged);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('keydown', keyboardEntered, true);
      reducedMotion.removeEventListener('change', sync);
      surface.removeEventListener('sos:hero-motion', sync);
      surface.removeEventListener('focusin', focusChanged);
    };
  }, []);

  useEffect(() => {
    launch.current.dispatchEvent(new CustomEvent('sos:hero-motion'));
  }, [paused]);

  useEffect(() => {
    const stage = showcase.current;
    const surface = launch.current;
    const runway = heroRunway.current;
    const pin = heroPin.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 851px) and (pointer: fine)');
    const shortViewport = window.matchMedia('(max-height: 699px)');
    const header = surface.closest('.sos-product')?.querySelector('.sos-header');
    let frame = 0;
    let stickyTop = 82;
    let geometryDirty = true;
    let previousHeroProgress = -1;
    let previousHeroMode = '';
    let renderedHeroProgress = 0;
    let previousHeroTime = 0;
    let heroInitialized = false;
    let heroSettled = true;
    let previousProgress = -1;
    let previousDirection = 0;
    let previousDepth = null;

    function updateHero(timestamp) {
      const remeasured = geometryDirty;
      if (geometryDirty) {
        stickyTop = header?.getBoundingClientRect().height || (window.innerWidth <= 600 ? 72 : 82);
        surface.style.setProperty('--hero-sticky-top', `${stickyTop}px`);
        geometryDirty = false;
      }
      // The runway never transforms. The header-sized preamble also keeps
      // a direct #sos-main visit at zero instead of starting mid-spin.
      const bounds = runway.getBoundingClientRect();
      const canPin = !reducedMotion.matches && !shortViewport.matches;
      const pausedMotion = surface.dataset.heroPaused === 'true';
      const focus = document.activeElement;
      const keyboardFocus = pin.contains(focus) && focus?.matches?.(':focus-visible');
      const mode = reducedMotion.matches ? 'reduced' : shortViewport.matches ? 'compact' : pausedMotion ? 'paused' : keyboardFocus ? 'focus' : 'pinned';
      const travel = Math.max(1, bounds.height - pin.offsetHeight - stickyTop);
      const target = canPin && !pausedMotion && !keyboardFocus ? bounded(-bounds.top / travel) : 0;
      const inView = bounds.bottom > stickyTop && bounds.top < window.innerHeight;
      const now = typeof timestamp === 'number' ? timestamp : performance.now();
      const immediate = !heroInitialized || mode !== 'pinned' || !inView || document.hidden;
      if (immediate) renderedHeroProgress = target;
      else {
        const elapsed = previousHeroTime ? Math.max(0, now - previousHeroTime) : 1000 / 60;
        renderedHeroProgress += (target - renderedHeroProgress) * (1 - Math.exp(-elapsed / 85));
      }
      heroSettled = Math.abs(target - renderedHeroProgress) <= .0001;
      if (heroSettled) renderedHeroProgress = target;
      previousHeroTime = heroSettled ? 0 : now;
      heroInitialized = true;
      const progress = renderedHeroProgress;
      surface.style.setProperty('--hero-scroll-target', target.toFixed(5));
      surface.dataset.heroScrollSettled = String(heroSettled);
      if (target > .003 && surface.dataset.heroIntro === 'arriving') surface.dataset.heroIntro = 'complete';
      if (progress === previousHeroProgress && mode === previousHeroMode && !remeasured) return !heroSettled;
      previousHeroProgress = progress;
      previousHeroMode = mode;
      const spin = bounded(progress / .52);
      const returnIn = interval(progress, .48, .84);
      const initialOut = interval(progress, .02, .20);
      const titleOpacity = Math.max(1 - initialOut, returnIn);
      const sideTravel = progress < .20 ? initialOut * .10 : (1 - returnIn) * .72;
      const apertureVisible = progress < .56;
      surface.dataset.heroScrubMode = mode;
      surface.dataset.heroPin = String(canPin);
      surface.dataset.heroScrubVisible = String(apertureVisible);
      surface.style.setProperty('--hero-scroll-progress', progress.toFixed(5));
      surface.style.setProperty('--hero-scroll-travel', `${travel}px`);
      surface.style.setProperty('--hero-logo-spin', `${spin * 540}deg`);
      surface.style.setProperty('--hero-logo-scale', String(1 - spin * .22));
      surface.style.setProperty('--hero-logo-opacity', String(1 - interval(progress, .32, .54)));
      surface.style.setProperty('--hero-aperture-scale', String(1 + interval(progress, .04, .56) * 1.9));
      surface.style.setProperty('--hero-aperture-opacity', String(1 - interval(progress, .16, .56)));
      surface.style.setProperty('--hero-title-opacity', String(titleOpacity));
      surface.style.setProperty('--hero-title-left-x', `${-window.innerWidth * sideTravel}px`);
      surface.style.setProperty('--hero-title-right-x', `${window.innerWidth * sideTravel}px`);
      surface.style.setProperty('--hero-title-blur', `${(1 - titleOpacity) * 4}px`);
      surface.style.setProperty('--hero-cue-opacity', String(1 - interval(progress, .04, .23)));
      surface.dispatchEvent(new CustomEvent('sos:hero-scroll', { detail: { progress } }));
      return !heroSettled;
    }

    // One scheduler measures both stationary stages, never their moving art.
    function updateReveal(timestamp) {
      frame = 0;
      if (document.hidden) return;
      if (updateHero(timestamp)) scheduleReveal();
      let progress = 1;
      let direction = 1;
      const depth = desktop.matches && !reducedMotion.matches;
      if (!reducedMotion.matches && !stage.contains(document.activeElement)) {
        const { top, bottom, height } = stage.getBoundingClientRect();
        const viewport = window.innerHeight;
        const travel = Math.max(1, Math.min(height, viewport) * 0.6);
        const visible = Math.max(0, Math.min(1, (viewport - top) / travel, bottom / travel));
        progress = visible * visible * (3 - 2 * visible);
        direction = viewport - top < bottom ? 1 : -1;
      }
      if (progress === previousProgress && direction === previousDirection && depth === previousDepth) return;
      previousProgress = progress;
      previousDirection = direction;
      previousDepth = depth;
      stage.style.setProperty('--showcase-progress', progress.toFixed(4));
      stage.style.setProperty('--showcase-origin', direction === 1 ? '0%' : '100%');
      stage.style.setProperty('--showcase-lift', `${depth ? (1 - progress) * 92 * direction : 0}px`);
      stage.style.setProperty('--showcase-tilt', `${depth ? (1 - progress) * 13 * direction : 0}deg`);
      stage.style.setProperty('--showcase-scale', String(depth ? 0.92 + progress * 0.08 : 1));
      stage.style.setProperty('--showcase-opacity', String(depth ? 0.42 + progress * 0.58 : 1));
    }
    function scheduleReveal() {
      if (!frame && !document.hidden) frame = window.requestAnimationFrame(updateReveal);
    }
    function resized() { geometryDirty = true; scheduleReveal(); }
    function visibilityChanged() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      previousHeroTime = 0;
      if (document.hidden) updateHero(performance.now());
      else scheduleReveal();
    }

    updateReveal();
    window.addEventListener('scroll', scheduleReveal, { passive: true });
    window.addEventListener('resize', resized);
    document.addEventListener('visibilitychange', visibilityChanged);
    reducedMotion.addEventListener('change', scheduleReveal);
    desktop.addEventListener('change', scheduleReveal);
    shortViewport.addEventListener('change', resized);
    surface.addEventListener('focusin', scheduleReveal);
    surface.addEventListener('focusout', scheduleReveal);
    surface.addEventListener('sos:hero-motion', scheduleReveal);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resized) : null;
    resizeObserver?.observe(stage);
    resizeObserver?.observe(runway);
    resizeObserver?.observe(pin);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(pointerFrame.current);
      window.removeEventListener('scroll', scheduleReveal);
      window.removeEventListener('resize', resized);
      document.removeEventListener('visibilitychange', visibilityChanged);
      reducedMotion.removeEventListener('change', scheduleReveal);
      desktop.removeEventListener('change', scheduleReveal);
      shortViewport.removeEventListener('change', resized);
      surface.removeEventListener('focusin', scheduleReveal);
      surface.removeEventListener('focusout', scheduleReveal);
      surface.removeEventListener('sos:hero-motion', scheduleReveal);
      resizeObserver?.disconnect();
      ['--hero-sticky-top','--hero-scroll-progress','--hero-scroll-target','--hero-scroll-travel','--hero-logo-spin','--hero-logo-scale','--hero-logo-opacity','--hero-aperture-scale','--hero-aperture-opacity','--hero-title-opacity','--hero-title-left-x','--hero-title-right-x','--hero-title-blur','--hero-cue-opacity'].forEach(name => surface.style.removeProperty(name));
      delete surface.dataset.heroScrollSettled;
    };
  }, []);

  function moveLight(event) {
    if (event.pointerType !== 'mouse' || showcase.current?.contains(document.activeElement) || !window.matchMedia('(min-width: 851px) and (prefers-reduced-motion: no-preference)').matches) return;
    pointerPosition.current = { target: event.currentTarget, x: event.clientX, y: event.clientY };
    if (pointerFrame.current) return;
    pointerFrame.current = window.requestAnimationFrame(() => {
      pointerFrame.current = 0;
      const point = pointerPosition.current;
      if (!point) return;
      const rect = point.target.getBoundingClientRect();
      const x = (point.x - rect.left) / rect.width;
      const y = (point.y - rect.top) / rect.height;
      point.target.style.setProperty('--light-x', `${x * 100}%`);
      point.target.style.setProperty('--light-y', `${y * 100}%`);
      point.target.style.setProperty('--scene-x', `${(0.5 - y) * 1.3}deg`);
      point.target.style.setProperty('--scene-y', `${(x - 0.5) * 1.3}deg`);
    });
  }

  function resetLight(event) {
    window.cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = 0;
    pointerPosition.current = null;
    event.currentTarget.style.setProperty('--scene-x', '0deg');
    event.currentTarget.style.setProperty('--scene-y', '0deg');
  }

  return <section ref={launch} className="sos-launch sos-prismatic-launch sos-reactor-launch" id="workspace" data-hero-intro="arriving" data-hero-running="true" data-hero-paused={String(paused)}>
    <div ref={heroRunway} className="sos-hero-runway">
    <div ref={heroPin} className="sos-hero-pin">
    <div ref={chamber} className="sos-optical-chamber" aria-hidden="true">
      <PrismaticField />
      <div className="sos-prism-emblem">
        <div className="sos-emblem-scroll">
        <div className="sos-emblem-turntable">
          <div className="sos-emblem-sculpture">
            <img className="sos-emblem-solid" src={PRODUCT_BRAND.symbol} width="768" height="768" alt="" fetchPriority="high" decoding="async" />
            <div className="sos-emblem-assembly">{[0, 1, 2, 3].map(index => <i key={index} className={'sos-emblem-fragment fragment-' + index}><img src={PRODUCT_BRAND.symbol} width="768" height="768" alt="" decoding="async" /></i>)}</div>
            <span className="sos-emblem-sheen" style={{ maskImage: `url(${PRODUCT_BRAND.symbol})`, WebkitMaskImage: `url(${PRODUCT_BRAND.symbol})` }}><i/></span>
          </div>
        </div>
        </div>
      </div>
    </div>
    <button type="button" className="sos-hero-motion-toggle" aria-label={paused ? 'Resume motion' : 'Pause motion'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={15}/> : <Pause size={15}/>}<span>{paused ? 'Resume motion' : 'Pause motion'}</span></button>
    <div className="sos-container">
      <div className="sos-launch-intro">
        <div className="sos-launch-headline">
          <HeroLightning />
          <h1><span className="sos-headline-line line-first"><span className="sos-headline-word word-supercharge"><span>Supercharge</span></span>{' '}<span className="sos-headline-word word-your"><span>your</span></span></span>{' '}<span className="sos-headline-line line-second"><span className="sos-headline-word word-photography"><span>photography</span></span>{' '}<span className="sos-headline-word word-business"><span>business.</span></span></span></h1>
        </div>
        <div className="sos-launch-pitch">
          <p><span>One photographer. Or an entire studio.</span><br/>Bring your clients, crew, money and delivery into one connected workspace.</p>
          <div className="sos-launch-actions">
            <a href="#plans" className="sos-button dark">Explore plans<ArrowUpRight size={17}/></a>
            <a href="#product-demo" className="sos-launch-tour"><Play size={13} fill="currentColor"/>Experience the workspace</a>
          </div>
        </div>
      </div>
    </div>
    <div className="sos-hero-scrub-cue" aria-hidden="true"><span>Scroll to supercharge</span><ArrowDown size={15}/></div>
    </div>
    </div>
    <div className="sos-container">
      <div className="sos-launch-audiences">
        <a href="#for-photographers"><Camera size={17}/><span>Working solo?<strong>Run your business with clarity.</strong></span><ArrowUpRight size={16}/></a>
        <a href="#for-photographers"><UsersRound size={18}/><span>Leading a team?<strong>Keep every hand-off connected.</strong></span><ArrowUpRight size={16}/></a>
        <a href="#on-the-go" className="sos-launch-mobile">Create. Quote. Invoice. Collect.<span>Wherever the work takes you.<ArrowDown size={15}/></span></a>
      </div>
      <div className="sos-showcase-stage" ref={showcase}>
        <div className="sos-showcase-scroll-cue" aria-hidden="true"><span>Your next chapter, in view</span><ArrowDown size={16}/></div>
        <div className="sos-showcase-frame" onPointerMove={moveLight} onPointerLeave={resetLight}>
          <div className="sos-showcase-label"><span><i/>A workspace that works with you</span><a href="#smart-link">Explore the client side<Link2 size={14}/><ArrowUpRight size={13}/></a></div>
          {children}
          <div className="sos-showcase-caption"><span>Your new Overview. Explore daylight and dark mode.</span><span>Product preview · Sample data</span></div>
        </div>
      </div>
    </div>
  </section>;
}
