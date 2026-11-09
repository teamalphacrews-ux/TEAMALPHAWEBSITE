import { createElement, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCheck, FolderOpen, ShieldCheck, SlidersHorizontal, UsersRound } from 'lucide-react';
import { ProductScreenImage } from './ProductScreens';
import './productWorkbench.css';

const mediaQuery = '(max-width: 850px), (max-height: 760px), (prefers-reduced-motion: reduce)';
const capabilities = [
  { name: 'People', icon: UsersRound, title: 'People, in the right place.', copy: 'Contacts, team invitations and owner, administrator and staff roles. Give each person their own access to your studio workspace.', label: 'YOUR STUDIO · YOUR TEAM' },
  { name: 'Your view', icon: SlidersHorizontal, title: 'A view that feels like you.', copy: 'Arrange your overview, hide cards you don’t need and bring them back later. Move between daylight and dark modes with considered motion.', label: 'PERSONAL, BY DESIGN' },
  { name: 'Your brand', icon: Camera, title: 'Your name on the experience.', copy: 'Studio profile, logo, business details and document templates. Present quotes, invoices and client updates with your studio’s identity.', label: 'A CONSIDERED CLIENT EXPERIENCE' },
  { name: 'Your studio', icon: ShieldCheck, title: 'Space for your own business.', copy: 'Separate studio workspaces keep business records together. Invite your team as you grow, with a plan based on the seats you need.', label: 'ROOM TO GROW' },
];
const clamp = value => Math.max(0, Math.min(1, value));

function CapabilityArt({ index }) {
  return <div className={'sos-feature-art art-' + index} aria-hidden="true">
    {index === 0 && <div className="sos-art-team"><div><span>YOUR PEOPLE</span><UsersRound size={18}/></div>{[['SY','Studio owner','Owner'],['AK','Photographer','Staff'],['SJ','Studio manager','Admin']].map(([initials,name,role])=><p key={initials}><i>{initials}</i><strong>{name}</strong><small>{role}</small></p>)}</div>}
    {index === 1 && <ProductScreenImage dark decorative phoneSource={false} className="sos-workbench-screen" sizes="(max-width: 600px) 92vw, 650px" />}
    {index === 2 && <div className="sos-art-document"><div><Camera size={22}/><span>YOUR STUDIO</span></div><h4>A beautiful beginning.</h4><p>Photography & cinematography</p><div className="sos-art-doc-line"/><div className="sos-art-doc-line"/><div className="sos-art-doc-line short"/><strong>Made personal, by you.<CheckCheck size={17}/></strong></div>}
    {index === 3 && <div className="sos-art-workspaces"><span><ShieldCheck size={28}/></span><p><Camera size={22}/>Your studio<i>PRIVATE</i></p><p><UsersRound size={22}/>Your people<i>CONNECTED</i></p><p><FolderOpen size={22}/>Your work<i>TOGETHER</i></p></div>}
  </div>;
}

export default function ProductWorkbench() {
  const root = useRef(null), runway = useRef(null), pin = useRef(null), viewport = useRef(null), rail = useRef(null), panels = useRef([]);
  const [compact, setCompact] = useState(() => typeof window === 'undefined' || window.matchMedia(mediaQuery).matches);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0), navigation = useRef(null);
  useEffect(() => {
    const media = window.matchMedia(mediaQuery);
    const update = () => setCompact(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const element = root.current;
    element.dataset.workbench = compact ? 'linear' : 'pinned';
    if (compact) return () => element.removeAttribute('data-workbench');
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = runway.current.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(pin.current).top) || 0;
      const stageHeight = pin.current.offsetHeight;
      const width = viewport.current.clientWidth;
      const distance = Math.max(0, rail.current.scrollWidth - width);
      const progress = clamp((top - bounds.top) / Math.max(1, bounds.height - stageHeight));
      const focusedPanel = panels.current.findIndex(node => node?.contains(document.activeElement));
      const locked = focusedPanel >= 0 && document.activeElement?.matches(':focus-visible');
      const position = locked ? focusedPanel / 3 : progress;
      const pending = navigation.current;
      if (pending && !pending.until) pending.until = performance.now() + 1800;
      const next = pending && performance.now() < pending.until ? pending.index : Math.round(position * 3);
      if (pending && (Math.abs(progress - pending.index / 3) < .008 || performance.now() >= pending.until)) navigation.current = null;
      element.style.setProperty('--workbench-shift', `${-position * distance}px`);
      element.style.setProperty('--workbench-progress', position.toFixed(4));
      if (next !== activeRef.current) { activeRef.current = next; setActive(next); }
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    resize?.observe(runway.current); resize?.observe(viewport.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    element.addEventListener('focusin', schedule); element.addEventListener('focusout', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame); resize?.disconnect();
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      element.removeEventListener('focusin', schedule); element.removeEventListener('focusout', schedule);
      element.removeAttribute('data-workbench');
      element.style.removeProperty('--workbench-shift'); element.style.removeProperty('--workbench-progress');
    };
  }, [compact]);
  const choose = index => {
    const next = Math.max(0, Math.min(3, index));
    activeRef.current = next; setActive(next);
    if (compact) {
      panels.current[next]?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      return;
    }
    const bounds = runway.current.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(pin.current).top) || 0;
    navigation.current = { index: next, until: 0 };
    window.scrollTo({ top: window.scrollY + bounds.top - top + next / 3 * (bounds.height - pin.current.offsetHeight), behavior: 'smooth' });
  };
  const keys = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (active + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
    choose(next);
    event.currentTarget.querySelectorAll('button')[next]?.focus({ preventScroll: true });
  };
  return <section ref={root} className="sos-workbench sos-container" id="features">
    <div className="sos-section-heading"><h2>Built for<br/>the whole picture.</h2><p>From a photographer’s first independent studio<br/>to a team with several projects in motion.</p></div>
    <div className="sos-workbench-runway" ref={runway}>
      <div className="sos-workbench-pin" ref={pin}>
        <div className="sos-workbench-controls">
          <div className="sos-workbench-tabs" role={compact ? 'group' : 'tablist'} aria-label="Explore studio capabilities" onKeyDown={keys}>
            {capabilities.map((item,index) => <button key={item.name} type="button" role={compact ? undefined : 'tab'} id={'workbench-tab-'+index} aria-selected={compact ? undefined : active===index} aria-controls={'workbench-panel-'+index} tabIndex={compact || active===index ? 0 : -1} onClick={()=>choose(index)}>{item.name}</button>)}
          </div>
          <div className="sos-workbench-arrows"><button type="button" aria-label="Previous capability" disabled={active===0} onClick={()=>choose(active-1)}><ArrowLeft size={18}/></button><button type="button" aria-label="Next capability" disabled={active===3} onClick={()=>choose(active+1)}><ArrowRight size={18}/></button></div>
        </div>
        <div className="sos-workbench-viewport" ref={viewport}>
          <div className="sos-workbench-rail" ref={rail}>
            {capabilities.map((item,index) => <article key={item.name} ref={node=>{panels.current[index]=node;}} className={'sos-workbench-plate plate-'+index} id={'workbench-panel-'+index} role={compact ? 'region' : 'tabpanel'} aria-labelledby={'workbench-tab-'+index} aria-hidden={!compact && active!==index ? true : undefined} inert={!compact && active!==index} tabIndex={compact || active===index ? 0 : -1}>
              <div className="sos-workbench-copy"><span className="sos-workbench-symbol">{createElement(item.icon,{size:27,strokeWidth:1.4})}</span><h3>{item.title}</h3><p>{item.copy}</p><span className="sos-workbench-label">{item.label}</span></div><CapabilityArt index={index}/>
            </article>)}
          </div>
        </div>
        <div className="sos-workbench-bottom"><span>One connected studio. A view of your own.</span><span>Product illustrations · Sample data</span></div>
      </div>
    </div>
  </section>;
}
