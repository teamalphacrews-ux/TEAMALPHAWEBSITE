import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Camera, Check, CircleCheck, Clapperboard, FileCheck2, FileText, Link2, Menu, MessageCircle, Plus, ShieldCheck, Wallet, X } from 'lucide-react';
import './productHome.css';
import ProductScreens from "./ProductScreens";
import ProductHero from './ProductHero';
import ProductAudience from './ProductAudience';
import ProductMobile from './ProductMobile';
import ProductWorkbench from './ProductWorkbench';
import ProductReminders from './ProductReminders';
import ProductJourney from './ProductJourney';
import { PRODUCT_METADATA } from './releaseConfig';
import { PRODUCT_HELP_LINKS } from './productLinks';
import { signupHref } from './signupIntent';
import { PRODUCT_BRAND } from './productBrandAssets';
import ProductIntegrations from './ProductIntegrations';
import useProductMotion from './useProductMotion';
import './productExperience.css';
import './productAccessibility.css';
import './productLuxury.css';
import './productMotion.css';
import './productBold.css';
import './productReactor.css';

const clientViews = [
  { id:'quote', name:'Quotation', icon:FileCheck2, status:'Accepted', amount:'₹1,80,000', caption:'Your agreed collection', heading:'The beginning, beautifully clear.', copy:'The accepted quote stays with the project, so your client can revisit the scope and what is included.', rows:[['Photography + cinematography','Included'],['Two wedding events','Included'],['Proposal status','Accepted']] },
  { id:'invoice', name:'Invoice', icon:FileText, status:'Issued', amount:'₹1,80,000', caption:'Your project invoice', heading:'One link. Even after the yes.', copy:'Once your studio reviews and issues the invoice, the same client link shows it alongside the accepted quote.', rows:[['Invoice #DEMO-001','Issued'],['Studio branding & details','Included'],['Payment schedule','Ready to view']] },
  { id:'payments', name:'Payments', icon:Wallet, status:'Scheduled', amount:'₹45,000', caption:'Next payment milestone', heading:'Make the next payment feel simple.', copy:'Clients see their payment milestones and your configured bank or UPI details. Your team records and verifies receipts in Studio X OS.', rows:[['Booking payment','Recorded'],['Before the wedding','Next milestone'],['Final delivery','Scheduled']] },
  { id:'production', name:'Production', icon:Clapperboard, status:'In progress', amount:'3 / 4', caption:'Deliverables in progress', heading:'Fewer “any update?” messages.', copy:'Show clients where their photos, films and album stand, who is working on them, and where to find approved delivery links.', rows:[['Photographs','Editing'],['Cinematic film','In progress'],['Album','Design review']] },
];
const faqs = [
  ['Is Studio X OS ready for new studios?','The commercial version is currently in preview. Private workspaces, team roles, invitations and subscription screens are being developed and tested. Registration, provider connections and paid plans will open after launch checks are complete.'],
  ['Does my client need to create an account?','No. The client smart link gives access to that project without a client login. It is a private access link, so share it only with the intended client.'],
  ['What happens after a client accepts a quote?','An accepted quote can generate a draft invoice. Your studio reviews and issues it before the invoice and payment schedule become visible to the client. The original shared link stays with the project.'],
  ['Can I keep my existing WhatsApp Business number?','Yes. Manual sharing opens your existing WhatsApp app. It does not migrate your number or automatically sync conversations into Studio X OS.'],
  ['Are client payments and my Studio X OS subscription the same?','No. Your Studio X OS subscription pays for your studio workspace. Your clients pay your studio using the payment instructions you configure; those receipts must be confirmed by your team.'],
  ['Can my team work together privately?','Each SaaS studio is designed to have its own workspace and business data, with owner, administrator and staff roles. The Starter plan is designed for up to five members. The preview does not create real team accounts.'],
];
const navigation=[['Why Studio X OS','#for-photographers'],['On the go','#on-the-go'],['Client smart link','#smart-link'],['Plans','#plans']];
const productPlans=[
  { name:'Starter', seats:5, label:'For solo photographers and small teams', features:['Client enquiries & projects','Quotes, invoices & smart links','Calendar & post-production'] },
  { name:'Studio', seats:15, label:'For a studio finding its stride', features:['Everything in Starter','More room for your crew','One shared studio workspace'] },
  { name:'Scale', seats:50, label:'For more people, more possibilities', features:['Everything in Studio','Capacity for several teams','The same connected workflow'] },
];
function Brand(){return <a className="sos-brand" href="#sos-main" aria-label="Studio X OS home"><span className="sos-brand-lockup" style={{'--brand-mask':`url("${PRODUCT_BRAND.lockup}")`}}><img className="sos-signature" src={PRODUCT_BRAND.lockup} alt="" width="640" height="213" decoding="async" /><i aria-hidden="true"/></span></a>;}
function moveTab(event, items, active, choose) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const index = items.indexOf(active);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length;
  choose(items[next]);
  event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
}
function Sample(){return <span className="sos-sample">SAMPLE DATA</span>;}

function SmartLinkDemo(){
  const [active,setActive]=useState('quote'),[supportOpen,setSupportOpen]=useState(false),supportButton=useRef(null),supportPanel=useRef(null),clientPreview=useRef(null),view=clientViews.find(item=>item.id===active);
  const nextView=clientViews[(clientViews.findIndex(item=>item.id===active)+1)%clientViews.length];
  const transition = useRef(null), requestedView = useRef('quote'), requestVersion = useRef(0);
  const selectView = id => {
    if(id === requestedView.current) return;
    requestedView.current = id;
    const version = ++requestVersion.current;
    const update = () => {
      if (version !== requestVersion.current) return;
      const fromPanel = clientPreview.current?.querySelector('.sos-client-panel')?.contains(document.activeElement);
      flushSync(() => setActive(id));
      if (fromPanel) clientPreview.current?.querySelector('[role=tabpanel]')?.focus({ preventScroll: true });
    };
    transition.current?.skipTransition();
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof document.startViewTransition !== 'function') { update(); return; }
    transition.current = document.startViewTransition(update);
    transition.current.ready.catch(() => {});
    transition.current.finished.catch(() => {});
  };
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (preference.matches) transition.current?.skipTransition(); };
    const invalidate = () => { requestVersion.current++; transition.current?.skipTransition(); };
    preference.addEventListener('change', stop);
    return () => { preference.removeEventListener('change', stop); invalidate(); };
  }, []);
  useEffect(()=>{if(!supportOpen)return;supportPanel.current?.focus({preventScroll:true});supportPanel.current?.scrollIntoView({block:'nearest',behavior:'instant'});const close=event=>{if(event.key==='Escape'){setSupportOpen(false);supportButton.current?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[supportOpen]);
  return <section className="sos-smart-section sos-client-chapter" id="smart-link"><div className="sos-container sos-smart-grid"><div className="sos-smart-copy"><span className="sos-eyebrow"><Link2 size={15}/>THE CLIENT SMART LINK</span><h2>Elevate your<br/>client experience.<br/><span>Every step of the way.</span></h2><p className="sos-smart-subheading">One smart link. Their whole project.</p><p>A considered client experience, from the first proposal to the final frame. No scattered documents. No new client account.</p><div className="sos-smart-benefits">{['Accepted quote & issued invoice','Payment schedule & project progress','Delivery links & project support'].map(label=><span key={label}><Check size={15}/>{label}</span>)}</div><a className="sos-text-link" href="#start">Make it part of your studio<ArrowUpRight size={17}/></a></div><div ref={clientPreview} className="sos-client-demo" data-motion-unit="client-preview"><header><div><span className="sos-client-mark"><Camera size={18}/></span><span>YOUR STUDIO<small>Made personal, by you.</small></span></div><Sample/></header><div className="sos-client-welcome"><span>A LITTLE SPACE, JUST FOR YOU</span><h3>Anika & Rohan</h3><p>Your wedding, thoughtfully together.</p></div><div className="sos-client-stages" role="tablist" aria-label="Explore the client smart link" onKeyDown={event=>moveTab(event,clientViews.map(item=>item.id),requestedView.current,selectView)}>{clientViews.map(item=><button key={item.id} type="button" role="tab" id={'sos-client-tab-'+item.id} tabIndex={active===item.id?0:-1} aria-selected={active===item.id} aria-controls="sos-client-panel" onClick={()=>selectView(item.id)} className={item.id}><item.icon size={18}/><span>{item.name}</span><small>{item.status}</small></button>)}</div><div className="sos-client-panel" key={active} id="sos-client-panel" role="tabpanel" tabIndex={0} aria-labelledby={'sos-client-tab-'+active}><div className="sos-client-amount"><span>{view.caption}<strong>{view.amount}</strong></span><span className="sos-client-status"><CircleCheck size={12}/>{view.status}</span></div><div className="sos-client-rows">{view.rows.map(([label,state])=><div key={label}><span>{label}</span><strong>{state}</strong></div>)}</div><div className="sos-client-panel-note"><h4>{view.heading}</h4><p>{view.copy}</p></div><button type="button" className="sos-client-step-action" onClick={()=>selectView(nextView.id)}>{active==='quote'?'Next: studio reviews and issues the invoice':active==='invoice'?'Next: view the payment schedule':active==='payments'?'Next: follow production and delivery':'Back to the accepted quote'}<ArrowRight size={14}/></button></div><footer><ShieldCheck size={12}/><span>A private project link, shared by your studio.</span><button ref={supportButton} type="button" className="sos-client-support" aria-expanded={supportOpen} aria-controls="sos-client-chat" onClick={()=>setSupportOpen(open=>!open)}><MessageCircle size={14}/>Support</button></footer>{supportOpen&&<aside ref={supportPanel} tabIndex={-1} id="sos-client-chat" className="sos-client-chat" aria-label="Sample client support"><header>Project support<button type="button" aria-label="Close sample support" onClick={()=>{setSupportOpen(false);supportButton.current?.focus();}}><X size={16}/></button></header><p>Where can I see the progress of our photographs?</p><p>Your photographs are being edited. You can follow the progress in Production on this same link.</p><a href="#sos-client-panel" onClick={()=>{selectView('production');setSupportOpen(false);}}>View production<ArrowUpRight size={13}/></a><small>Sample conversation · No message is sent.</small></aside>}</div></div></section>;
}
export default function ProductHome(){
  const [menuOpen,setMenuOpen]=useState(false),menuButton=useRef(null),pageRef=useRef(null);
  useProductMotion(pageRef);
  useEffect(()=>{
    const title=document.title;
    document.title=PRODUCT_METADATA.title;
    const entries=[['name','description',PRODUCT_METADATA.description],['property','og:title',PRODUCT_METADATA.title],['property','og:description',PRODUCT_METADATA.socialDescription]];
    const restore=entries.map(([attribute,key,value])=>{
      let node=document.querySelector('meta['+attribute+'="'+key+'"]');
      const created=!node, previous=node?.getAttribute('content');
      if(!node){node=document.createElement('meta');node.setAttribute(attribute,key);document.head.appendChild(node);}
      node.setAttribute('content',value);
      return()=>{if(created)node.remove();else if(previous===null)node.removeAttribute('content');else node.setAttribute('content',previous);};
    });
    return()=>{document.title=title;restore.forEach(reset=>reset());};
  },[]);
  useEffect(()=>{if(!menuOpen)return;const escape=event=>{if(event.key==='Escape'){setMenuOpen(false);menuButton.current?.focus();}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[menuOpen]);
  return <div className="sos-product sos-prismatic sos-bold sos-reactor" ref={pageRef}><div className="sos-page-progress" aria-hidden="true"/><a className="sos-skip" href="#sos-main">Skip to content</a><header className="sos-header"><div className="sos-container sos-header-inner"><Brand/><nav className="sos-desktop-nav" aria-label="Product navigation">{navigation.map(([label,href])=><a key={href} href={href}>{label}</a>)}</nav><div className="sos-header-actions"><Link className="sos-signin" to="/studio-os/login">Sign in</Link><a className="sos-button dark small" href="#plans">Explore plans<ArrowUpRight size={14}/></a><button ref={menuButton} type="button" className="sos-menu-button" aria-label={menuOpen?'Close navigation':'Open navigation'} aria-expanded={menuOpen} aria-controls="sos-mobile-menu" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button></div></div>{menuOpen&&<nav className="sos-mobile-nav" id="sos-mobile-menu" aria-label="Mobile product navigation">{navigation.map(([label,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}<Link to="/studio-os/login" onClick={()=>setMenuOpen(false)}>Sign in<ArrowUpRight size={17}/></Link></nav>}</header>
  <main id="sos-main" tabIndex={-1}><ProductHero><ProductScreens/></ProductHero>
  <ProductAudience/>
  <ProductJourney/>
  <ProductMobile/>
  <SmartLinkDemo/>
  <ProductWorkbench/>
  <ProductReminders/>
  <ProductIntegrations/>
  <section className="sos-plans sos-container" id="plans"><div className="sos-section-heading"><div><h2>Start with your people.<br/>Grow at your pace.</h2></div><p>Monthly INR plans are being prepared.<br/>Pricing will be published before paid subscriptions open.</p></div><div className="sos-plan-cards">{productPlans.map((plan,index)=><article key={plan.name} className={index===0?'is-featured':''}><div className="sos-plan-identity"><header><span>{plan.name}</span>{index===0&&<small>YOUR STARTING POINT</small>}</header><p>{plan.label}</p></div><div className="sos-plan-seats"><strong>{plan.seats}</strong><span>team members<br/>in your studio</span></div><ul>{plan.features.map(feature=><li key={feature}><Check size={15}/>{feature}</li>)}</ul><div className="sos-plan-next"><div className="sos-plan-pricing"><span>Pricing to be announced</span><small>Monthly subscription · INR</small></div><Link to={signupHref(plan.name.toLowerCase())} className={'sos-button '+(index===0?'dark':'outline')}>Choose {plan.name}<ArrowUpRight size={15}/></Link></div></article>)}</div><p className="sos-plans-note"><ShieldCheck size={14}/>A 14-day trial is planned for new studios. Registration is currently in preview; no payment is collected here.</p></section>
  <section className="sos-faq sos-container" id="questions"><div><span className="sos-eyebrow">A FEW THINGS, MADE CLEAR</span><h2>Before your<br/>next chapter.</h2><p>The details matter.<br/>Here are the ones worth knowing.</p></div><div className="sos-faq-list">{faqs.map(([question,answer])=><details key={question}><summary>{question}<Plus size={18}/></summary><p>{answer}</p></details>)}</div></section>
  <section className="sos-final-section" id="start"><div className="sos-container"><span className="sos-eyebrow">LESS ADMIN. MORE ART.</span><h2>Your best work.<br/><span>Your strongest business.</span></h2><p>Supercharge your photography business with Studio X OS.</p><div className="sos-final-actions"><a className="sos-button light" href="#plans">Choose your plan<ArrowUpRight size={17}/></a><Link className="sos-button ghost" to="/signup">Create your studio<ArrowUpRight size={17}/></Link></div><div className="sos-social-signup"><span>Choose how you’d like to join</span><div><Link to="/signup?provider=google">Continue with Google<ArrowRight size={13}/></Link><Link to="/signup?provider=apple">Continue with Apple<ArrowRight size={13}/></Link></div><small>Provider sign-in becomes available after secure setup and registration opens.</small></div></div><div className="sos-final-brand" aria-hidden="true"><img src={PRODUCT_BRAND.symbolWhite} alt="" width="512" height="512" loading="lazy" decoding="async"/></div></section>
  </main><footer className="sos-footer"><div className="sos-container"><div className="sos-footer-top"><div><Brand/><p>The workspace behind your best work.</p></div><div><a href="#workflow">Workflow</a><a href="#smart-link">Client smart link</a><a href="#integrations">Integrations</a><Link to="/studio-os/login">Sign in<ArrowUpRight size={13}/></Link></div></div><nav className="sos-footer-help" aria-label="Team Alpha policies and contact"><a href={PRODUCT_HELP_LINKS.privacy}>Team Alpha privacy<ArrowUpRight size={12}/></a><a href={PRODUCT_HELP_LINKS.terms}>Team Alpha terms<ArrowUpRight size={12}/></a><a href={PRODUCT_HELP_LINKS.support}>Contact support<ArrowUpRight size={12}/></a></nav><a className="sos-footer-wordmark" data-motion-unit="closing-wordmark" href="#sos-main" aria-label="Back to Studio X OS home"><img src={PRODUCT_BRAND.wordmark} alt="" width="1024" height="189" loading="lazy" decoding="async"/></a><div className="sos-footer-bottom"><span>© {new Date().getFullYear()} Studio X OS · By Team Alpha</span><span>Commercial product preview</span><a href="https://teamalpha.photography">Visit Team Alpha<ArrowUpRight size={12}/></a></div></div></footer></div>;
}
