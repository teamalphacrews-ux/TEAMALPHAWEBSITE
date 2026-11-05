import { createElement, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Camera, Check, CheckCheck, Circle, Clapperboard, FileText, Link2, MessageCircle, UserRound, UsersRound, Wallet } from 'lucide-react';
import './productAudience.css';

const audiences = [
  {
    id: 'solo', label: 'Just me', caption: 'Independent photographer', icon: UserRound,
    title: 'You make the photographs.\nGive the rest a home.',
    copy: 'You are the photographer, the sales team and the person chasing payments. Keep the business organised without needing a studio manager.',
    cases: [
      { title: 'Never lose the next conversation.', pain: 'Enquiries buried in chats and notes.', benefit: 'Keep the brief, quote and next follow-up together, so you know who needs a reply.', type: 'enquiries', tag: 'YOUR NEXT STEP, IN VIEW', outcome: 'Pick up where you left off — even after a full day behind the camera.' },
      { title: 'Know what is still owed.', pain: 'Invoices in one place. Payments in another.', benefit: 'See issued invoices, scheduled milestones and recorded receipts with the project.', type: 'money', tag: 'LESS RECONCILING. MORE CLARITY.', outcome: 'See the outstanding amount before you send the next payment reminder.' },
      { title: 'Give every client a clear update.', pain: 'The same “any update?” message, again.', benefit: 'One private smart link holds their accepted quote, invoice, payment schedule and delivery progress.', type: 'delivery', tag: 'A PERSONAL CLIENT EXPERIENCE', outcome: 'Keep clients informed while you concentrate on making their photographs.' },
    ],
  },
  {
    id: 'team', label: 'My growing team', caption: 'You + a trusted crew', icon: UsersRound,
    title: 'Great people.\nA shared way of working.',
    copy: 'Bring your photographers, filmmakers and editors into the same project. Less repeating the brief. Clearer responsibilities from shoot to delivery.',
    cases: [
      { title: 'Put names against the work.', pain: 'Assignments scattered across group chats.', benefit: 'Assign crew to the project and keep the event date, venue and responsibilities together.', type: 'crew', tag: 'THE RIGHT PEOPLE, ON THE PROJECT', outcome: 'Your crew can see the project context, with each person’s role clearly recorded.' },
      { title: 'Make the handover clear.', pain: 'The shoot is finished. Who takes it next?', benefit: 'Track each deliverable through post-production, with an assigned person and a visible stage.', type: 'pipeline', tag: 'FROM CAMERA TO FINAL CUT', outcome: 'Know who is working on the photographs, film or album before a deadline slips.' },
      { title: 'Keep one version of the plan.', pain: 'Different people giving different updates.', benefit: 'Keep quotes, invoices and project progress together; share approved information through the client link.', type: 'delivery', tag: 'ONE PROJECT. A SHARED PICTURE.', outcome: 'Your team has the context. Your client has a considered place to follow the work.' },
    ],
  },
  {
    id: 'studio', label: 'A bigger studio', caption: 'Several crews. Many projects.', icon: Camera,
    title: 'More projects.\nThe same clear picture.',
    copy: 'When several weddings and deliveries overlap, memory is not a workflow. Give your team a shared place to see ownership, progress and outstanding work.',
    cases: [
      { title: 'See who is doing what.', pain: 'Multiple projects. Unclear ownership.', benefit: 'Keep crew assignments and event details with each project, alongside your studio calendar.', type: 'crew', tag: 'PROJECTS WITH CLEAR OWNERSHIP', outcome: 'Review your teams and upcoming events together before you plan the next assignment.' },
      { title: 'Find the work that needs attention.', pain: 'An album or edit disappears between teams.', benefit: 'Use project stages and assigned deliverables to follow photos, films and albums through production.', type: 'pipeline', tag: 'EVERY DELIVERY HAS A NEXT STEP', outcome: 'Focus the next team conversation on the work that is waiting, rather than collecting updates.' },
      { title: 'Keep the business in focus.', pain: 'More bookings do not always mean more cash.', benefit: 'Review payment milestones, overdue balances and recorded expenses across the studio.', type: 'money', tag: 'A CLEARER VIEW OF YOUR BUSINESS', outcome: 'Separate what is booked, what has been received and what still needs collecting.' },
    ],
  },
];

function StudioVisual({ type, audience }) {
  const large = audience === 'studio';
  return <div className={'sos-audience-screen screen-' + type}>
    <header className="sos-audience-screenbar"><span><Camera size={15} /> YOUR STUDIO</span><span><i /> Sample data</span></header>
    {type === 'enquiries' && <div className="sos-audience-enquiries">
      <div className="sos-audience-visual-title"><span>CLIENT RELATIONSHIPS</span><h4>A clear next step.</h4><p>Follow-ups, with the context that matters.</p></div>
      <div className="sos-audience-lead"><span className="sos-audience-avatar">AR</span><div><strong>Anika & Rohan</strong><small>08 Nov · Wedding · Bengaluru</small></div><span className="sos-audience-chip">Quote shared</span></div>
      <div className="sos-audience-thread"><div><CheckCheck size={15} /><span>Enquiry received<small>Brief & event details saved</small></span></div><div><FileText size={15} /><span>Collection shared<small>Quote ready for client review</small></span></div><div className="is-next"><CalendarDays size={15} /><span>Follow up today<small>Ask about their coverage preferences</small></span><ArrowUpRight size={17} /></div></div>
      <div className="sos-audience-note"><MessageCircle size={16} /><p>“Two events, candid photography and a cinematic film.”<small>The brief stays with the enquiry.</small></p></div>
    </div>}
    {type === 'money' && <div className="sos-audience-money">
      <div className="sos-audience-visual-title"><span>FINANCE OVERVIEW</span><h4>{large ? 'A healthier view of the books.' : 'Your work. Your payments.'}</h4><p>Recorded payments and balances, together.</p></div>
      <div className="sos-audience-finance-stats"><div><small>Recorded receipts</small><strong>₹1,20,000</strong></div><div><small>Outstanding</small><strong>₹60,000</strong></div></div>
      <div className="sos-audience-balance"><span /><span /></div>
      <div className="sos-audience-milestone"><span><Check size={16} /></span><div><strong>Booking payment</strong><small>Anika & Rohan · Receipt recorded</small></div><b>₹45,000</b></div>
      <div className="sos-audience-milestone"><span><CalendarDays size={16} /></span><div><strong>Final delivery payment</strong><small>Anika & Rohan · Payment due</small></div><b>₹60,000</b></div>
      <p className="sos-audience-footnote">Receipts are recorded and verified by your studio.</p>
    </div>}
    {type === 'crew' && <div className="sos-audience-crew">
      <div className="sos-audience-visual-title"><span>PROJECT ASSIGNMENTS</span><h4>{large ? 'Two events. Clear ownership.' : 'Your crew, on the same page.'}</h4><p>Dates, places and people stay connected.</p></div>
      <div className="sos-audience-shoot"><div><CalendarDays size={16} /><span>08 NOV · WEDDING</span></div><h5>Anika & Rohan</h5><p>Bengaluru · Ceremony coverage</p><div className="sos-audience-people"><span><i>AK</i><strong>Arun<small>Photography</small></strong></span><span><i>SJ</i><strong>Sara<small>Cinematography</small></strong></span></div></div>
      <div className="sos-audience-shoot secondary"><div><CalendarDays size={16} /><span>{large ? '08' : '12'} NOV · PRE-WEDDING</span></div><h5>Meera & Arjun</h5><div className="sos-audience-people"><span><i>NR</i><strong>Nisha<small>Photography</small></strong></span><span><i>KR</i><strong>Kiran<small>Film</small></strong></span></div></div>
    </div>}
    {type === 'pipeline' && <div className="sos-audience-pipeline">
      <div className="sos-audience-visual-title"><span>POST-PRODUCTION</span><h4>The next frame is in motion.</h4><p>Anika & Rohan · Assigned deliverables</p></div>
      {[['Photographs','Colour & retouching','Arun','68%'],['Cinematic film','Story & sound','Sara','43%'],['Wedding album','Design review','Nisha','82%']].map(([name,stage,person,progress],index)=><div className="sos-audience-production-row" key={name}><span className="sos-audience-delivery-icon">{index === 1 ? <Clapperboard size={19} /> : index === 0 ? <Camera size={19} /> : <FileText size={19} />}</span><div><strong>{name}<small>{person}</small></strong><p>{stage}</p><i><span style={{width: progress}} /></i></div></div>)}
      <div className="sos-audience-review"><Circle size={13} /><span>Next step: client review of the album design.</span></div>
    </div>}
    {type === 'delivery' && <div className="sos-audience-delivery">
      <div className="sos-audience-linkbar"><Link2 size={13} /><span>One private client smart link</span><Check size={13} /></div>
      <div className="sos-audience-visual-title"><span>ANIKA & ROHAN</span><h4>Your story, all together.</h4><p>A project space your clients can come back to.</p></div>
      <div className="sos-audience-client-tiles">{[[FileText,'Quotation','Accepted'],[Wallet,'Invoice','Issued'],[CalendarDays,'Payments','Scheduled'],[Clapperboard,'Delivery','In progress']].map(([Icon,title,status])=><div key={title}>{createElement(Icon,{size:20})}<strong>{title}</strong><small>{status}</small></div>)}</div>
      <div className="sos-audience-client-update"><span><CheckCheck size={18} /></span><div><strong>Your album is in design review.</strong><p>Progress, approved delivery links and support in one place.</p></div></div>
      <div className="sos-audience-no-login"><Check size={13} /> No client account needed.</div>
    </div>}
  </div>;
}

export default function ProductAudience() {
  const [active, setActive] = useState(0);
  const [selectedCase, setSelectedCase] = useState(0);
  const audience = audiences[active];
  const useCase = audience.cases[selectedCase];
  const selectAudience = index => { setActive(index); setSelectedCase(0); };
  const onTabKey = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? audiences.length - 1 : (active + (event.key === 'ArrowRight' ? 1 : audiences.length - 1)) % audiences.length;
    selectAudience(index);
    event.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();
  };
  return <section className="sos-audience sos-container" id="for-photographers">
    <div className="sos-audience-heading"><div><span className="sos-eyebrow">ONE CAMERA OR A WHOLE CREW</span><h2>Built for your ambition.<br /><span>At every team size.</span></h2></div><p>See what changes when the business behind your photography has a place of its own.</p></div>
    <div className="sos-audience-tabs" role="tablist" aria-label="Find your photography workflow" onKeyDown={onTabKey}>{audiences.map((item,index)=><button type="button" key={item.id} role="tab" id={'audience-tab-'+item.id} aria-selected={active === index} aria-controls="sos-audience-panel" tabIndex={active === index ? 0 : -1} onClick={()=>selectAudience(index)}><span className="sos-audience-tab-icon"><item.icon size={20}/></span><span><strong>{item.label}</strong><small>{item.caption}</small></span><ArrowUpRight size={18}/></button>)}</div>
    <div className={'sos-audience-panel audience-'+audience.id} id="sos-audience-panel" role="tabpanel" tabIndex={0} aria-labelledby={'audience-tab-'+audience.id}>
      <div className="sos-audience-story"><h3>{audience.title.split('\n').map((line,index)=><span key={line}>{index > 0 && <br />}{line}</span>)}</h3><p>{audience.copy}</p><div className="sos-audience-cases" aria-label="Explore the benefits">{audience.cases.map((item,index)=><button type="button" key={item.title} className={selectedCase === index ? 'is-active' : ''} aria-expanded={selectedCase === index} aria-controls={'audience-case-'+audience.id+'-'+index} onClick={()=>setSelectedCase(index)}><span className="sos-audience-case-number">0{index+1}</span><span><strong>{item.title}</strong><span className="sos-audience-case-details" id={'audience-case-'+audience.id+'-'+index} hidden={selectedCase !== index}><small>{item.pain}</small><ArrowDown size={12}/><span>{item.benefit}</span></span></span><ArrowRight size={17}/></button>)}</div></div>
      <div className="sos-audience-stage"><div className="sos-audience-stage-caption"><span><i/> EXPLORE THE SCENARIOS</span><span>INTERACTIVE PREVIEW</span></div><div key={audience.id+'-'+selectedCase} className="sos-audience-scene"><StudioVisual type={useCase.type} audience={audience.id}/><div className="sos-audience-outcome"><span>{useCase.tag}</span><p>{useCase.outcome}</p></div></div></div>
    </div>
  </section>;
}
