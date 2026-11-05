import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Banknote, CalendarDays, Check, CheckCheck, ChevronLeft, CreditCard, FileText, FolderPlus, Link2, MapPin, MoreHorizontal, Plus, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import './productMobile.css';

const mobileStages = [
  {
    id: 'create', label: 'Create a project', icon: FolderPlus,
    title: 'A new enquiry. A clear next step.',
    copy: 'Capture the client, date and venue while the details are fresh. Your next follow-up stays with the project, even when you are between shoots.',
    moment: 'After a client call', detail: 'Client details → one project',
  },
  {
    id: 'quote', label: 'Build a quote', icon: FileText,
    title: 'Send a considered proposal, wherever you are.',
    copy: 'Start with your saved collection, adjust the scope and share a quote link. Your client can review and accept it from their own phone.',
    moment: 'Between locations', detail: 'Saved collection → shareable quote',
  },
  {
    id: 'invoice', label: 'Issue an invoice', icon: CreditCard,
    title: 'Keep the booking moving after the yes.',
    copy: 'An accepted quote can create a draft invoice. Review the amount and payment schedule, then issue it to the same client smart link.',
    moment: 'After the quote is accepted', detail: 'Studio review → issued invoice',
  },
  {
    id: 'collect', label: 'Collect payments', icon: Wallet,
    title: 'Make it easy to take the next payment.',
    copy: 'Share your configured bank or UPI details through the client link. Check the transfer and record the receipt to keep the balance up to date.',
    moment: 'Before the next event', detail: 'Payment instructions → confirmed receipt',
  },
];

function PhoneProject() {
  return <div className="sos-mobile-screen-content">
    <div className="sos-mobile-app-heading"><span>NEW PROJECT</span><h4>A beautiful<br/>beginning.</h4></div>
    <div className="sos-mobile-form-fields">
      <div><span>CLIENT</span><strong>Anika & Rohan</strong></div>
      <div className="sos-mobile-field-pair"><div><span>DATE</span><strong><CalendarDays size={13}/>08 Nov 2026</strong></div><div><span>CITY</span><strong><MapPin size={13}/>Bengaluru</strong></div></div>
      <div><span>NEXT FOLLOW-UP</span><strong>Discuss the collection<small>Tomorrow · 10:00 AM</small></strong></div>
    </div>
    <div className="sos-mobile-preview-action"><Plus size={16}/>Create project</div>
    <p className="sos-mobile-screen-note">The details, ready when you need them.</p>
  </div>;
}

function PhoneQuote() {
  return <div className="sos-mobile-screen-content">
    <div className="sos-mobile-document-top"><span>YOUR STUDIO</span><span>QUOTE · DRAFT</span></div>
    <div className="sos-mobile-app-heading"><h4>The wedding<br/>collection.</h4><p>Prepared for Anika & Rohan</p></div>
    <div className="sos-mobile-collection"><span><FileText size={14}/>SAVED COLLECTION</span><strong>Wedding essentials</strong><small>Photography & cinematography</small></div>
    <div className="sos-mobile-document-lines"><div><span>Wedding coverage<small>Two events</small></span><strong>₹1,60,000</strong></div><div><span>Album collection<small>One signature album</small></span><strong>₹30,000</strong></div><div className="sos-mobile-discount"><span>Collection discount</span><strong>− ₹10,000</strong></div></div>
    <div className="sos-mobile-total"><span>Total</span><strong>₹1,80,000</strong></div>
    <div className="sos-mobile-preview-action"><Link2 size={15}/>Share quote link<ArrowUpRight size={14}/></div>
    <p className="sos-mobile-screen-note">Your client reviews and accepts online.</p>
  </div>;
}

function PhoneInvoice() {
  return <div className="sos-mobile-screen-content">
    <div className="sos-mobile-acceptance"><CheckCheck size={15}/>Quote accepted<span>Next: your review</span></div>
    <div className="sos-mobile-app-heading"><span>INVOICE #DEMO-001</span><h4>One final<br/>review.</h4><p>Anika & Rohan · Draft invoice</p></div>
    <div className="sos-mobile-invoice-total"><span>PROJECT TOTAL</span><strong>₹1,80,000</strong><small>Photography, films & album</small></div>
    <div className="sos-mobile-milestones"><span>PAYMENT SCHEDULE</span>{[['01','On booking','₹45,000'],['02','Before the wedding','₹90,000'],['03','On final delivery','₹45,000']].map(([number,label,amount])=><div key={number}><i>{number}</i><span>{label}</span><strong>{amount}</strong></div>)}</div>
    <div className="sos-mobile-preview-action"><Check size={15}/>Review & issue invoice</div>
    <p className="sos-mobile-screen-note">Visible to the client only after you issue it.</p>
  </div>;
}

function PhonePayment() {
  return <div className="sos-mobile-screen-content">
    <div className="sos-mobile-client-view"><Link2 size={13}/>CLIENT SMART LINK<span>Private project</span></div>
    <div className="sos-mobile-app-heading"><span>ANIKA & ROHAN</span><h4>Your next<br/>milestone.</h4></div>
    <div className="sos-mobile-payment-amount"><span>BOOKING PAYMENT</span><strong>₹45,000</strong><span>of ₹1,80,000 project total</span><div><i/></div></div>
    <div className="sos-mobile-payment-methods"><div><span><Wallet size={18}/></span><p>Pay by UPI<small>Your studio’s configured UPI details</small></p><ArrowUpRight size={15}/></div><div><span><Banknote size={18}/></span><p>Bank transfer<small>Your studio’s bank account details</small></p><ArrowUpRight size={15}/></div></div>
    <div className="sos-mobile-payment-note"><ShieldCheck size={16}/><p>Your studio confirms the receipt.<span>The balance updates after verification.</span></p></div>
  </div>;
}

const screens = { create: PhoneProject, quote: PhoneQuote, invoice: PhoneInvoice, collect: PhonePayment };

export default function ProductMobile() {
  const [active, setActive] = useState('create');
  const stage = mobileStages.find(item => item.id === active);
  const Screen = screens[active];

  function moveTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = mobileStages.findIndex(item => item.id === active);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? mobileStages.length - 1 : (current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : mobileStages.length - 1)) % mobileStages.length;
    setActive(mobileStages[next].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return <section className="sos-mobile-section" id="on-the-go" aria-labelledby="sos-mobile-title">
    <div className="sos-container sos-mobile-grid">
      <div className="sos-mobile-copy">
        <span className="sos-eyebrow"><Smartphone size={15}/>YOUR STUDIO GOES WITH YOU</span>
        <h2 id="sos-mobile-title">Create. Quote.<br/>Invoice. <span>Collect.</span><br/>On the go.</h2>
        <p>Your business doesn’t pause when you leave the desk. Move the next project forward from your mobile browser, whether you work solo or lead a crew.</p>
        <div className="sos-mobile-tabs" role="tablist" aria-label="Explore the mobile studio workflow" onKeyDown={moveTab}>
          {mobileStages.map((item, index) => <button type="button" key={item.id} role="tab" id={'sos-mobile-tab-' + item.id} tabIndex={active === item.id ? 0 : -1} aria-selected={active === item.id} aria-controls="sos-mobile-panel" onClick={() => setActive(item.id)}>
            <span className="sos-mobile-tab-icon"><item.icon size={17}/></span><span>{item.label}</span><small>0{index + 1}</small><ArrowRight size={16}/>
          </button>)}
        </div>
        <div className="sos-mobile-benefit" key={active}>
          <h3>{stage.title}</h3><p>{stage.copy}</p>
        </div>
        <a className="sos-text-link" href="#smart-link">See the client side<ArrowUpRight size={16}/></a>
      </div>
      <div className={'sos-mobile-stage stage-' + active} id="sos-mobile-panel" role="tabpanel" tabIndex={0} aria-labelledby={'sos-mobile-tab-' + active}>
        <div className="sos-mobile-aura" aria-hidden="true"><i/><i/></div>
        <div className="sos-mobile-context"><i/><span>{stage.moment}</span><Smartphone size={14}/></div>
        <div className="sos-mobile-phone">
          <div className="sos-mobile-status-bar" aria-hidden="true"><span>9:41</span><i/><svg width="43" height="11" viewBox="0 0 43 11" fill="none"><path d="M1 9V7M5 9V5M9 9V2" stroke="currentColor" strokeWidth="2"/><path d="M15 3Q20 -1 25 3M17 5Q20 2 23 5M19 7L20 8L21 7" stroke="currentColor" strokeWidth="1.5"/><rect x="29" y="2" width="11" height="7" rx="1.5" stroke="currentColor"/><path d="M41 4V7" stroke="currentColor"/><path d="M31 4H38V7H31Z" fill="currentColor"/></svg></div>
          <div className="sos-mobile-browser"><ShieldCheck size={10}/><span>Studio OS · Mobile workspace</span></div>
          <div className="sos-mobile-app-bar" aria-hidden="true"><ChevronLeft size={17}/><span>studio<span>os</span></span><MoreHorizontal size={18}/></div>
          <div className="sos-mobile-screen" key={active}><Screen/></div>
          <div className="sos-mobile-home-indicator" aria-hidden="true"/>
        </div>
        <div className="sos-mobile-stage-caption"><span>SAMPLE WORKFLOW</span><p>{stage.detail}</p><small>Interactive illustration · No live account or payment</small></div>
      </div>
    </div>
  </section>;
}
