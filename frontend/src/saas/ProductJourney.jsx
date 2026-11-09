import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Camera, Check, CheckCheck, Clapperboard, FileText, Link2, MapPin, MessageCircle, ShieldCheck, UsersRound, Wallet } from 'lucide-react';
import './productJourney.css';
import './productProjectTable.css';

const chapters = [
  { id:'enquiry', label:'Enquire', icon:MessageCircle, eyebrow:'START WITH THE PERSON', title:'Enquiries, managed.\nOpportunities, in view.', copy:'A name, a date, a story waiting to happen. Keep the brief and next follow-up with the enquiry, so a promising conversation does not disappear between messages.', outcome:'From first hello to a considered proposal.', detail:'Brief · Event details · Follow-up' },
  { id:'quote', label:'Quote', icon:FileText, eyebrow:'MAKE THE YES FEEL SIMPLE', title:'A beautiful proposal.\nReady for a decision.', copy:'Build from your studio’s templates, refine the collection and set an expiry. Your client reviews and accepts through a private link — with the agreed scope kept with the project.', outcome:'The proposal becomes part of the project story.', detail:'Collection · Terms · Online acceptance' },
  { id:'plan', label:'Plan', icon:UsersRound, eyebrow:'PUT THE RIGHT PEOPLE IN THE PICTURE', title:'One shared plan.\nEveryone in place.', copy:'Dates, venues, crew and responsibilities belong together. Give the people behind the photographs the project context they need before the shoot begins.', outcome:'Less repeating the brief. Clearer ownership.', detail:'Calendar · Crew · Responsibilities' },
  { id:'collect', label:'Collect', icon:Wallet, eyebrow:'KEEP THE BUSINESS IN FOCUS', title:'Know what’s received.\nAnd what comes next.', copy:'An accepted quote can become a draft invoice for your studio to review and issue. Share the payment schedule and bank or UPI instructions; record and verify receipts as they arrive.', outcome:'A clear payment plan for you and your client.', detail:'Issued invoice · Milestones · Recorded payments' },
  { id:'deliver', label:'Deliver', icon:Clapperboard, eyebrow:'THE EXPERIENCE CONTINUES AFTER THE SHOOT', title:'From the final edit.\nTo their forever keepsakes.', copy:'Track the photographs, films and album through post-production. Show the assigned people, progress and approved delivery links through the same client smart link.', outcome:'One link, from the first proposal to the final frame.', detail:'Editing · Review · Approved delivery links' },
];

function JourneyPreview({ active, focusable = true }) {
  const chapter = chapters[active];
  return <div className={'sos-journey-preview preview-'+chapter.id} role="region" tabIndex={focusable ? 0 : -1} aria-label={chapter.label+' sample project preview'}>
    <header className="sos-journey-screenbar"><div><Camera size={16}/><span>YOUR STUDIO<span>STUDIO X OS</span></span></div><span><i/>SAMPLE PROJECT</span></header>
    <div className="sos-journey-project"><span className="sos-journey-monogram">AR</span><div><strong>Anika & Rohan</strong><span>Wedding · Bengaluru · 08 November</span></div><Link2 size={17}/></div>
    <div className="sos-journey-content" key={chapter.id} tabIndex={focusable ? 0 : -1} role="group" aria-label={chapter.label+' sample project details'}>
      {active === 0 && <div className="sos-journey-enquiry">
        <div className="sos-journey-message"><span><MessageCircle size={14}/> NEW ENQUIRY</span><p>“We’re getting married this November. We’d love to have you tell our story.”</p><small>Photography + cinematography · Two events</small></div>
        <div className="sos-journey-details"><div><CalendarDays size={15}/><span>Wedding date<strong>08 November</strong></span></div><div><MapPin size={15}/><span>Event city<strong>Bengaluru</strong></span></div></div>
        <div className="sos-journey-followup"><div><span><CalendarDays size={19}/></span><p>Next follow-up<strong>Discuss the collection</strong></p><ArrowUpRight size={19}/></div><p>Coverage preferences, venue and the next conversation — all in view.</p></div>
        <div className="sos-journey-connected"><CheckCheck size={16}/><span>Ready to prepare their quotation.</span></div>
      </div>}
      {active === 1 && <div className="sos-journey-quote">
        <div className="sos-journey-paper"><header><Camera size={23}/><span>YOUR STUDIO<small>Photography & cinematography</small></span><span>QUOTE<br/>DEMO-001</span></header><h4>A story worth remembering.</h4><p>Prepared for Anika & Rohan</p><div className="sos-journey-paper-row"><span>Wedding photography<small>Two events · Candid & traditional</small></span><span>Included</span></div><div className="sos-journey-paper-row"><span>Cinematic wedding film<small>Story, sound & the moments between</small></span><span>Included</span></div><div className="sos-journey-paper-total"><span>Your collection</span><strong>₹1,80,000</strong></div></div>
        <div className="sos-journey-accepted"><span><Check size={18}/></span><div><strong>Proposal accepted</strong><small>The agreed collection stays with the project.</small></div></div>
      </div>}
      {active === 2 && <div className="sos-journey-planning">
        <div className="sos-journey-event"><span><small>NOV</small>08</span><div><h4>The wedding day</h4><p><MapPin size={12}/>Bengaluru · Ceremony coverage</p><span>09:00 AM IST</span></div></div>
        <div className="sos-journey-mini-heading"><UsersRound size={15}/><span>THE PEOPLE BEHIND THE WORK</span></div>
        <div className="sos-journey-crew-grid">{[['AK','Arun','Photography','Candid moments'],['SJ','Sara','Cinematography','Ceremony & story'],['KR','Kiran','Photography','Traditional coverage'],['NR','Nisha','Post-production','Album design']].map(([initials,name,role,job])=><div key={name}><span>{initials}</span><strong>{name}<small>{role}</small></strong><p>{job}</p></div>)}</div>
        <div className="sos-journey-connected"><FileText size={15}/><span>The event brief stays with their assignments.</span></div>
      </div>}
      {active === 3 && <div className="sos-journey-collect">
        <div className="sos-journey-invoice-top"><span>INVOICE DEMO-001<small>Reviewed & issued by your studio</small></span><span><Check size={11}/>Issued</span></div><div className="sos-journey-invoice-value"><span>Project total</span><strong>₹1,80,000</strong><div><i/><i/><i/></div></div>
        <div className="sos-journey-payment-list">{[['01','Booking payment','Receipt recorded','₹45,000'],['02','Before the wedding','Next milestone','₹90,000'],['03','Final delivery','Scheduled','₹45,000']].map(([number,title,state,value],index)=><div key={title}><span>{index===0?<Check size={15}/>:number}</span><p><strong>{title}</strong><small>{state}</small></p><b>{value}</b></div>)}</div>
        <div className="sos-journey-payment-note"><ShieldCheck size={14}/><p>Your studio records and verifies payments.<br/>Bank transfers are not automatically confirmed.</p></div>
      </div>}
      {active === 4 && <div className="sos-journey-deliver">
        <div className="sos-journey-delivery-heading"><span>THE FINAL CHAPTER</span><h4>Every detail, moving forward.</h4><p>Project progress, shared through their smart link.</p></div>
        <div className="sos-journey-deliveries">{[[Camera,'Photographs','Arun · Photo editor','Delivery link ready',100],[Clapperboard,'Cinematic film','Sara · Film editor','Story & sound',68],[FileText,'Wedding album','Nisha · Designer','Client design review',85]].map(([Icon,title,person,state,progress])=><div key={title}><span>{createElement(Icon,{size:19})}</span><div><strong>{title}<small>{state}</small></strong><p>{person}</p><i><span style={{width:progress+'%'}}/></i></div></div>)}</div>
        <div className="sos-journey-connected"><Link2 size={16}/><span>One private link. Their whole project story.</span></div>
      </div>}
    </div>
    <footer><span>{createElement(chapter.icon,{size:14})}{chapter.label}</span><span>0{active+1}<em>/</em>05</span></footer>
  </div>;
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
          <header className="sos-project-identity"><span className="sos-project-avatar">AR</span><div><strong>Anika & Rohan</strong><span>Wedding · Bengaluru · 08 November</span></div><div className="sos-project-sample"><span>Sample project</span><strong>0{active + 1}<em>/</em>05</strong></div></header>
          <div ref={navigation} className="sos-journey-navigation" role="group" aria-label="Jump to a project workflow stage" onKeyDown={keyNavigation}>{chapters.map((chapter, index) => <button type="button" key={chapter.id} aria-pressed={active === index} aria-controls={'sos-chapter-' + chapter.id} onClick={() => choose(index)}><span>0{index + 1}</span>{createElement(chapter.icon, { size: 16 })}<strong>{chapter.label}</strong><ArrowRight size={14}/></button>)}</div>
          <div className="sos-project-composition">
            <div className="sos-project-copy">{chapters.map((chapter, index) => <article key={chapter.id} id={'sos-chapter-' + chapter.id} className={'sos-journey-chapter' + (active === index ? ' is-active' : '')} hidden={active !== index} aria-hidden={active !== index}>
              <h3>{chapter.title.split('\n').map((line, lineIndex) => <span key={line}>{lineIndex > 0 && <br/>}{line}</span>)}</h3><p>{chapter.copy}</p><div className="sos-journey-outcome"><CheckCheck size={17}/><span>{chapter.outcome}</span></div><span className="sos-journey-chapter-detail">{chapter.detail}</span>
            </article>)}<div className="sos-project-scroll-note"><ArrowDown size={14}/><span>{compact ? 'Choose a stage to follow the project.' : 'Scroll to follow the project. Or choose a stage above.'}</span></div></div>
            <div className="sos-project-deck">{chapters.map((chapter, index) => <div key={chapter.id} ref={node => { plateRefs.current[index] = node; }} className="sos-project-plate" data-active={active === index} inert={active !== index} aria-hidden={active !== index}>
              <JourneyPreview active={index} focusable={active === index}/><span className="sos-project-plate-caption">{chapter.label} · Sample data</span>
            </div>)}</div>
          </div>
          <div className="sos-project-timeline" aria-hidden="true"><i/></div>
        </div>
      </div>
    </div>
  </section>;
}
