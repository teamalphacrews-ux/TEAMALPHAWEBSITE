import { createElement, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Camera, Check, CheckCheck, Clapperboard, FileText, Link2, MapPin, MessageCircle, ShieldCheck, UsersRound, Wallet } from 'lucide-react';
import './productJourney.css';

const chapters = [
  { id:'enquiry', label:'Enquire', icon:MessageCircle, eyebrow:'START WITH THE PERSON', title:'Enquiries, managed.\nOpportunities, in view.', copy:'A name, a date, a story waiting to happen. Keep the brief and next follow-up with the enquiry, so a promising conversation does not disappear between messages.', outcome:'From first hello to a considered proposal.', detail:'Brief · Event details · Follow-up' },
  { id:'quote', label:'Quote', icon:FileText, eyebrow:'MAKE THE YES FEEL SIMPLE', title:'A beautiful proposal.\nReady for a decision.', copy:'Build from your studio’s templates, refine the collection and set an expiry. Your client reviews and accepts through a private link — with the agreed scope kept with the project.', outcome:'The proposal becomes part of the project story.', detail:'Collection · Terms · Online acceptance' },
  { id:'plan', label:'Plan', icon:UsersRound, eyebrow:'PUT THE RIGHT PEOPLE IN THE PICTURE', title:'One shared plan.\nEveryone in place.', copy:'Dates, venues, crew and responsibilities belong together. Give the people behind the photographs the project context they need before the shoot begins.', outcome:'Less repeating the brief. Clearer ownership.', detail:'Calendar · Crew · Responsibilities' },
  { id:'collect', label:'Collect', icon:Wallet, eyebrow:'KEEP THE BUSINESS IN FOCUS', title:'Know what’s received.\nAnd what comes next.', copy:'An accepted quote can become a draft invoice for your studio to review and issue. Share the payment schedule and bank or UPI instructions; record and verify receipts as they arrive.', outcome:'A clear payment plan for you and your client.', detail:'Issued invoice · Milestones · Recorded payments' },
  { id:'deliver', label:'Deliver', icon:Clapperboard, eyebrow:'THE EXPERIENCE CONTINUES AFTER THE SHOOT', title:'From the final edit.\nTo their forever keepsakes.', copy:'Track the photographs, films and album through post-production. Show the assigned people, progress and approved delivery links through the same client smart link.', outcome:'One link, from the first proposal to the final frame.', detail:'Editing · Review · Approved delivery links' },
];

function JourneyPreview({ active }) {
  const chapter = chapters[active];
  return <div className={'sos-journey-preview preview-'+chapter.id} role="region" tabIndex={0} aria-label={chapter.label+' sample project preview'}>
    <header className="sos-journey-screenbar"><div><Camera size={16}/><span>YOUR STUDIO<span>STUDIO OS</span></span></div><span><i/>SAMPLE PROJECT</span></header>
    <div className="sos-journey-project"><span className="sos-journey-monogram">AR</span><div><strong>Anika & Rohan</strong><span>Wedding · Bengaluru · 08 November</span></div><Link2 size={17}/></div>
    <div className="sos-journey-content" key={chapter.id}>
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

export default function ProductJourney() {
  const [active,setActive] = useState(0);
  const [compact,setCompact] = useState(false);
  const chapterRefs = useRef([]);
  useEffect(()=>{
    const media = window.matchMedia('(max-width: 850px), (max-height: 640px)');
    const update = ()=>setCompact(media.matches);
    update();
    media.addEventListener('change',update);
    return ()=>media.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    if (compact || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries=>{
      if (!entries.some(entry=>entry.isIntersecting)) return;
      const center = window.innerHeight * .48;
      let nearest = 0, distance = Infinity;
      chapterRefs.current.forEach((node,index)=>{
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const delta = Math.abs(rect.top + rect.height/2 - center);
        if (delta < distance) { nearest=index; distance=delta; }
      });
      setActive(nearest);
    },{rootMargin:'-20% 0px -25% 0px',threshold:[0,.2,.5,.8,1]});
    chapterRefs.current.forEach(node=>{if(node)observer.observe(node);});
    return ()=>observer.disconnect();
  },[compact]);
  const choose = index => {
    setActive(index);
    if (!compact) chapterRefs.current[index]?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  };
  const keyNavigation = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key==='Home'?0:event.key==='End'?4:(active+(event.key==='ArrowRight'?1:4))%5;
    choose(next);
    event.currentTarget.querySelectorAll('button')[next]?.focus();
  };
  return <section className="sos-journey sos-container" id="workflow">
    <div className="sos-journey-heading"><div><span className="sos-eyebrow">EVERY STAGE. ONE CONNECTED STORY.</span><h2>A first hello.<br/><span>A lifetime of memories.</span></h2></div><p>Follow one wedding through the work behind it.<br/>Every stage keeps the context of the one before.</p></div>
    <div className="sos-journey-navigation" role="group" aria-label="Jump to a project workflow stage" onKeyDown={keyNavigation}>{chapters.map((chapter,index)=><button type="button" key={chapter.id} aria-pressed={active===index} aria-controls={'sos-chapter-'+chapter.id} onClick={()=>choose(index)}><span>0{index+1}</span>{createElement(chapter.icon,{size:16})}<strong>{chapter.label}</strong><ArrowRight size={14}/></button>)}</div>
    <div className="sos-journey-scroll-layout"><div className="sos-journey-chapters">{chapters.map((chapter,index)=><article key={chapter.id} id={'sos-chapter-'+chapter.id} ref={node=>{chapterRefs.current[index]=node;}} className={'sos-journey-chapter'+(active===index?' is-active':'')}><div className="sos-journey-chapter-number"><span>0{index+1}</span><i/></div><div><span className="sos-journey-eyebrow">{chapter.eyebrow}</span><h3>{chapter.title.split('\n').map((line,lineIndex)=><span key={line}>{lineIndex>0&&<br/>}{line}</span>)}</h3><p>{chapter.copy}</p><div className="sos-journey-outcome"><CheckCheck size={17}/><span>{chapter.outcome}</span></div><span className="sos-journey-chapter-detail">{chapter.detail}</span></div></article>)}</div><div className="sos-journey-sticky"><div className="sos-journey-preview-label"><span><i/>INTERACTIVE WORKFLOW</span><span>ILLUSTRATIVE DATA</span></div><JourneyPreview active={active}/><div className="sos-journey-scroll-hint"><ArrowDown size={13}/><span>Scroll to follow the project. Or choose a stage above.</span></div></div></div>
  </section>;
}
