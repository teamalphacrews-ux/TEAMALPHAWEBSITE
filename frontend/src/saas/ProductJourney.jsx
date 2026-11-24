import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, CheckCheck, Clapperboard, FileText, MessageCircle, UsersRound, Wallet } from 'lucide-react';
import './productJourney.css';
import './productProjectTable.css';
import ProductWorkspaceCapture from './ProductWorkspaceCapture';

const chapters = [
  { id:'enquiry', label:'Enquire', icon:MessageCircle, eyebrow:'START WITH THE PERSON', title:'Enquiries, managed.\nOpportunities, in view.', copy:'A name, a date, a story waiting to happen. Keep the brief and next follow-up with the enquiry, so a promising conversation does not disappear between messages.', outcome:'From first hello to a considered proposal.', detail:'Brief · Event details · Follow-up' },
  { id:'quote', label:'Quote', icon:FileText, eyebrow:'MAKE THE YES FEEL SIMPLE', title:'A beautiful proposal.\nReady for a decision.', copy:'Build from your studio’s templates, refine the collection and set an expiry. Your client reviews and accepts through a private link — with the agreed scope kept with the project.', outcome:'The proposal becomes part of the project story.', detail:'Collection · Terms · Online acceptance' },
  { id:'plan', label:'Plan', icon:UsersRound, eyebrow:'PUT THE RIGHT PEOPLE IN THE PICTURE', title:'One shared plan.\nEveryone in place.', copy:'Dates, venues, crew and responsibilities belong together. Give the people behind the photographs the project context they need before the shoot begins.', outcome:'Less repeating the brief. Clearer ownership.', detail:'Calendar · Crew · Responsibilities' },
  { id:'collect', label:'Collect', icon:Wallet, eyebrow:'KEEP THE BUSINESS IN FOCUS', title:'Know what’s received.\nAnd what comes next.', copy:'An accepted quote can become a draft invoice for your studio to review and issue. Share the payment schedule and bank or UPI instructions; record and verify receipts as they arrive.', outcome:'A clear payment plan for you and your client.', detail:'Issued invoice · Milestones · Recorded payments' },
  { id:'deliver', label:'Deliver', icon:Clapperboard, eyebrow:'THE EXPERIENCE CONTINUES AFTER THE SHOOT', title:'From the final edit.\nTo their forever keepsakes.', copy:'Track the photographs, films and album through post-production. Show the assigned people, progress and approved delivery links through the same client smart link.', outcome:'One link, from the first proposal to the final frame.', detail:'Editing · Review · Approved delivery links' },
];

const journeyScreens = ['enquiries', 'client-smart-link-quote', 'project-detail', 'client-smart-link-payments', 'project-delivery'];

export function JourneyCapture({ active }) {
  return <ProductWorkspaceCapture view={journeyScreens[active]} className="sos-capture-journey" phoneSource={false} />;
}

const compactQuery = '(max-width: 850px), (max-height: 760px), (prefers-reduced-motion: reduce)';
const bounded = value => Math.max(0, Math.min(1, value));

export default function ProductJourney() {
  const [active, setActive] = useState(0);
  const [compact, setCompact] = useState(true);
  const section = useRef(null), runway = useRef(null), pin = useRef(null), navigation = useRef(null);
  const plateRefs = useRef([]);
  const activeRef = useRef(0), manual = useRef(null);
  const geometry = useRef({ start: 0, travel: 1, top: 88 });
  const requestFrame = useRef(null);

  const activate = useCallback(index => {
    if (activeRef.current === index) return;
    activeRef.current = index;
    setActive(index);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(compactQuery);
    const update = () => setCompact(media.matches || typeof IntersectionObserver !== 'function');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const track = runway.current, stage = pin.current, surface = section.current;
    if (compact || !track || !stage || !surface) return undefined;
    const plates = plateRefs.current.slice();
    let frame = 0, nearby = true, resized = true, disposed = false;
    let stageHeight = 0, stickyTop = 88, step = window.innerWidth * 0.46;
    const header = surface.closest('.sos-product')?.querySelector('.sos-header');

    function update() {
      frame = 0;
      if (disposed) return;
      // Measure the stationary runway, never the moving preview plates.
      const rect = track.getBoundingClientRect();
      if (resized) {
        stickyTop = Math.ceil(header?.getBoundingClientRect().height || 76) + 12;
        stageHeight = stage.getBoundingClientRect().height;
        step = window.innerWidth * 0.46;
        resized = false;
      }
      const travel = Math.max(1, rect.height - stageHeight);
      geometry.current = { start: window.scrollY + rect.top - stickyTop, travel, top: stickyTop };
      const progress = bounded((stickyTop - rect.top) / travel);
      const focused = document.activeElement;
      const keyboardFocus = surface.contains(focused) && focused?.matches?.(':focus-visible')
        && (navigation.current?.contains(focused) || focused.closest('.sos-project-plate'));
      const pending = manual.current;
      if (pending && (Math.abs(window.scrollY - pending.target) < 2 || performance.now() > pending.until)) manual.current = null;
      const next = manual.current ? manual.current.index : keyboardFocus ? activeRef.current : progress * (chapters.length - 1);
      const nearest = Math.max(0, Math.min(chapters.length - 1, Math.round(next)));

      surface.style.setProperty('--project-top', `${stickyTop}px`);
      surface.style.setProperty('--project-progress', String(next / (chapters.length - 1)));
      surface.dataset.projectFocus = String(Boolean(keyboardFocus));
      plates.forEach((plate, index) => {
        if (!plate) return;
        const distance = index - next, depth = Math.min(2, Math.abs(distance));
        plate.style.setProperty('--plate-x', `${distance * step}px`);
        plate.style.setProperty('--plate-y', `${depth * 32}px`);
        plate.style.setProperty('--plate-depth', `${depth * -170}px`);
        plate.style.setProperty('--plate-turn', `${Math.max(-1, Math.min(1, distance)) * -9}deg`);
        plate.style.setProperty('--plate-scale', String(Math.max(0.82, 1 - depth * 0.085)));
        plate.style.setProperty('--plate-opacity', String(Math.max(0.24, 1 - depth * 0.65)));
        plate.style.setProperty('--plate-layer', String(100 - Math.round(depth * 20)));
      });
      activate(nearest);
    }

    function schedule(force = false) {
      if (disposed || frame || document.hidden || (!nearby && !force)) return;
      frame = window.requestAnimationFrame(update);
    }
    function onScroll() { schedule(); }
    function resize() { resized = true; schedule(true); }
    function focusChanged() { schedule(true); }
    function visibilityChanged() {
      if (document.hidden) { window.cancelAnimationFrame(frame); frame = 0; }
      else resize();
    }
    requestFrame.current = () => schedule(true);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      nearby = entries.some(entry => entry.isIntersecting);
      schedule(true);
    }, { rootMargin: '20% 0px' }) : null;
    observer?.observe(track);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(track);
    resizeObserver?.observe(stage);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    surface.addEventListener('focusin', focusChanged);
    surface.addEventListener('focusout', focusChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    update();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      surface.removeEventListener('focusin', focusChanged);
      surface.removeEventListener('focusout', focusChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
      surface.style.removeProperty('--project-top');
      surface.style.removeProperty('--project-progress');
      delete surface.dataset.projectFocus;
      plates.forEach(plate => {
        if (!plate) return;
        ['--plate-x', '--plate-y', '--plate-depth', '--plate-turn', '--plate-scale', '--plate-opacity', '--plate-layer'].forEach(name => plate.style.removeProperty(name));
      });
      requestFrame.current = null;
      manual.current = null;
    };
  }, [compact, activate]);

  const choose = useCallback(index => {
    activate(index);
    if (compact || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { start, travel } = geometry.current;
    const target = Math.max(0, start + travel * index / (chapters.length - 1));
    manual.current = { index, target, until: performance.now() + 2400 };
    window.scrollTo({ top: target, behavior: 'smooth' });
    requestFrame.current?.();
  }, [compact, activate]);

  useEffect(() => {
    const followAnchor = () => {
      const index = chapters.findIndex(chapter => window.location.hash === '#sos-chapter-' + chapter.id);
      if (index >= 0) choose(index);
    };
    window.addEventListener('hashchange', followAnchor);
    followAnchor();
    return () => window.removeEventListener('hashchange', followAnchor);
  }, [choose]);

  const keyNavigation = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1
      : (activeRef.current + (event.key === 'ArrowRight' ? 1 : chapters.length - 1)) % chapters.length;
    choose(next);
    event.currentTarget.querySelectorAll('button')[next]?.focus({ preventScroll: true });
  };

  return <section ref={section} className="sos-journey sos-project-table" id="workflow" data-project-mode={compact ? 'compact' : 'pinned'}>
    <div className="sos-container sos-journey-heading"><div><h2>A first hello.<br/><span>A lifetime of memories.</span></h2></div><p>Follow one wedding through the work behind it.<br/>Every stage keeps the context of the one before.</p></div>
    <div ref={runway} className="sos-project-runway">
      <div ref={pin} className="sos-project-pin">
        <div className="sos-container sos-project-stage">
          <header className="sos-project-identity"><span className="sos-project-avatar">AR</span><div><strong>Anika & Rohan</strong><span>Wedding · Bengaluru</span></div><div className="sos-project-sample"><span>Sample project</span><strong>0{active + 1}<em>/</em>05</strong></div></header>
          <div ref={navigation} className="sos-journey-navigation" role="group" aria-label="Jump to a project workflow stage" onKeyDown={keyNavigation}>{chapters.map((chapter, index) => <button type="button" key={chapter.id} aria-pressed={active === index} aria-controls={'sos-chapter-' + chapter.id} onClick={() => choose(index)}><span>0{index + 1}</span>{createElement(chapter.icon, { size: 16 })}<strong>{chapter.label}</strong><ArrowRight size={14}/></button>)}</div>
          <div className="sos-project-composition">
            <div className="sos-project-copy">{chapters.map((chapter, index) => <article key={chapter.id} id={'sos-chapter-' + chapter.id} className={'sos-journey-chapter' + (active === index ? ' is-active' : '')} hidden={active !== index} aria-hidden={active !== index}>
              <h3>{chapter.title.split('\n').map((line, lineIndex) => <span key={line}>{lineIndex > 0 && <br/>}{line}</span>)}</h3><p>{chapter.copy}</p><div className="sos-journey-outcome"><CheckCheck size={17}/><span>{chapter.outcome}</span></div><span className="sos-journey-chapter-detail">{chapter.detail}</span>
            </article>)}<div className="sos-project-scroll-note"><ArrowDown size={14}/><span>{compact ? 'Choose a stage to follow the project.' : 'Scroll to follow the project. Or choose a stage above.'}</span></div></div>
            <div className="sos-project-deck">{chapters.map((chapter, index) => <div key={chapter.id} ref={node => { plateRefs.current[index] = node; }} className="sos-project-plate" data-active={active === index} inert={active !== index} aria-hidden={active !== index}>
              <JourneyCapture active={index}/>
            </div>)}</div>
          </div>
          <div className="sos-project-timeline" aria-hidden="true"><i/></div>
        </div>
      </div>
    </div>
  </section>;
}
