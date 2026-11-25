import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Link2, Menu, Plus, ShieldCheck, X } from 'lucide-react';
import './productHome.css';
import ProductScreens from "./ProductScreens";
import ProductDocsTeaser from "./ProductDocsTeaser";
import ProductClientCapture from "./ProductClientCapture";
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
import './commercialPublicSurface.css';
import './productHandset.css';

const faqs = [
  ['Is Studio X OS ready for new studios?','The commercial version is currently in preview. Private workspaces, team roles, invitations and subscription screens are being developed and tested. Registration, provider connections and paid plans will open after launch checks are complete.'],
  ['Does my client need to create an account?','No. The client smart link gives access to that project without a client login. It is a private access link, so share it only with the intended client.'],
  ['What happens after a client accepts a quote?','An accepted quote can generate a draft invoice. Your studio reviews and issues it before the invoice and payment schedule become visible to the client. The original shared link stays with the project.'],
  ['Can I keep my existing WhatsApp Business number?','Yes. Manual sharing opens your existing WhatsApp app. It does not migrate your number or automatically sync conversations into Studio X OS.'],
  ['Are client payments and my Studio X OS subscription the same?','No. Your Studio X OS subscription pays for your studio workspace. Your clients pay your studio using the payment instructions you configure; those receipts must be confirmed by your team.'],
  ['Can my team work together privately?','Each studio is designed to have its own workspace and business data, with owner, administrator and staff roles. The Starter plan is designed for up to five members. The preview does not create real team accounts.'],
];
const navigation=[['Why Studio X OS','#for-photographers'],['On the go','#on-the-go'],['Client smart link','#smart-link'],['Questions','#questions'],['Docs','/studio-os/docs']];
const productPlans=[
  { name:'Starter', seats:5, label:'For solo photographers and small teams', features:['Client enquiries & projects','Quotes, invoices & smart links','Calendar & post-production'] },
  { name:'Studio', seats:15, label:'For a studio finding its stride', features:['Everything in Starter','More room for your crew','One shared studio workspace'] },
  { name:'Scale', seats:50, label:'For more people, more possibilities', features:['Everything in Studio','Capacity for several teams','The same connected workflow'] },
];
function Brand(){return <a className="sos-brand" href="#sos-main" aria-label="Studio X OS home"><span className="sos-brand-lockup" style={{'--brand-mask':`url("${PRODUCT_BRAND.lockup}")`}}><img className="sos-signature" src={PRODUCT_BRAND.lockup} alt="" width="640" height="213" decoding="async" /><i aria-hidden="true"/></span></a>;}
function warmAccountOnIntent(event) {
  if (event.type === 'pointerover' && event.pointerType !== 'mouse') return;
  const link = event.target.closest?.('a[href]');
  if (!link || !/^(?:\/signup(?:[?#]|$)|\/studio-os\/login(?:[?#]|$)|#plans$)/.test(link.getAttribute('href'))) return;
  if (event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) return;
  // Public flags only: no account data or background polling on homepage load.
  import('./publicConfigService').then(module => module.prefetchPublicConfig()).catch(() => {});
}

function SmartLinkDemo(){
  return <section className="sos-smart-section sos-client-chapter" id="smart-link"><div className="sos-container sos-smart-grid"><div className="sos-smart-copy"><span className="sos-eyebrow"><Link2 size={15}/>THE CLIENT SMART LINK</span><h2>Elevate your<br/>client experience.<br/><span>Every step of the way.</span></h2><p className="sos-smart-subheading">One smart link. Their whole project.</p><p>A considered client experience, from the first proposal to the final frame. No scattered documents. No new client account.</p><div className="sos-smart-benefits">{['Accepted quote & issued invoice','Payment schedule & project progress','Delivery links & project support'].map(label=><span key={label}><Check size={15}/>{label}</span>)}</div><a className="sos-text-link" href="#start">Make it part of your studio<ArrowUpRight size={17}/></a></div><ProductClientCapture/></div></section>;
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
  return <div className="sos-product sos-prismatic sos-bold sos-reactor" ref={pageRef} onPointerOver={warmAccountOnIntent} onFocusCapture={warmAccountOnIntent} onPointerDownCapture={warmAccountOnIntent}><div className="sos-page-progress" aria-hidden="true"/><a className="sos-skip" href="#sos-main">Skip to content</a><header className="sos-header"><div className="sos-container sos-header-inner"><Brand/><nav className="sos-desktop-nav" aria-label="Product navigation">{navigation.map(([label,href])=><a key={href} href={href}>{label}</a>)}</nav><div className="sos-header-actions"><Link className="sos-signin" to="/studio-os/login">Sign in</Link><a className="sos-button dark small" href="#plans">Explore plans<ArrowUpRight size={14}/></a><button ref={menuButton} type="button" className="sos-menu-button" aria-label={menuOpen?'Close navigation':'Open navigation'} aria-expanded={menuOpen} aria-controls="sos-mobile-menu" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button></div></div>{menuOpen&&<nav className="sos-mobile-nav" id="sos-mobile-menu" aria-label="Mobile product navigation">{navigation.map(([label,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}<Link to="/studio-os/login" onClick={()=>setMenuOpen(false)}>Sign in<ArrowUpRight size={17}/></Link></nav>}</header>
  <main id="sos-main" tabIndex={-1}><ProductHero><ProductScreens/></ProductHero>
  <ProductAudience/>
  <ProductJourney/>
  <ProductMobile/>
  <SmartLinkDemo/>
  <ProductWorkbench/>
  <ProductReminders/>
  <ProductIntegrations/>
  <section className="sos-plans sos-container" id="plans"><div className="sos-section-heading" id="availability"><div><h2>Start with your people.<br/>Grow at your pace.</h2></div><p>Commercial preview. Registration and monthly INR pricing are being prepared. Check a plan’s status to see the current account options; your choice stays saved.</p></div><div className="sos-plan-cards">{productPlans.map((plan,index)=><article key={plan.name} className={index===0?'is-featured':''}><div className="sos-plan-identity"><header><span>{plan.name}</span>{index===0&&<small>YOUR STARTING POINT</small>}</header><p>{plan.label}</p></div><div className="sos-plan-seats"><small>Up to</small><strong>{plan.seats}</strong><span>team members<br/>in your studio</span></div><ul>{plan.features.map(feature=><li key={feature}><Check size={15}/>{feature}</li>)}</ul><div className="sos-plan-next"><div className="sos-plan-pricing"><span>Pricing to be announced</span><small>Monthly subscription · INR</small></div><Link to={signupHref(plan.name.toLowerCase())} className={'sos-button '+(index===0?'dark':'outline')}>Check {plan.name} status<ArrowUpRight size={15}/></Link></div></article>)}</div><p className="sos-plans-note"><ShieldCheck size={14}/>A 14-day trial is planned for new studios. Registration is currently in preview; no payment is collected here.</p></section>
  <ProductDocsTeaser/>
  <section className="sos-faq sos-container" id="questions"><div><span className="sos-eyebrow">A FEW THINGS, MADE CLEAR</span><h2>Before your<br/>next chapter.</h2><p>The details matter.<br/>Here are the ones worth knowing.</p></div><div className="sos-faq-list">{faqs.map(([question,answer])=><details key={question}><summary>{question}<Plus size={18}/></summary><p>{answer}</p></details>)}</div></section>
  <section className="sos-final-section" id="start"><div className="sos-container"><span className="sos-eyebrow">LESS ADMIN. MORE ART.</span><h2>Your best work.<br/><span>Your strongest business.</span></h2><p>Explore the preview. See what your next chapter could look like.</p><div className="sos-final-actions"><a className="sos-button light" href="#product-demo">Explore product screens<ArrowUpRight size={17}/></a><Link className="sos-button ghost" to="/signup">Check registration status<ArrowUpRight size={17}/></Link></div><p className="sos-registration-note">Registration and paid plans are being prepared. Google and Apple sign-in will be available after secure setup and registration opens.</p></div><div className="sos-final-brand" aria-hidden="true"><img src={PRODUCT_BRAND.symbolWhite} alt="" width="512" height="512" loading="lazy" decoding="async"/></div></section>
  </main><footer className="sos-footer"><div className="sos-container"><div className="sos-footer-top"><div><Brand/><p>The workspace behind your best work.</p></div><div><a href="#workflow">Workflow</a><a href="#smart-link">Client smart link</a><a href="#integrations">Integrations</a><a href="/studio-os/docs">Docs</a><Link to="/studio-os/login">Sign in<ArrowUpRight size={13}/></Link></div></div><nav className="sos-footer-help" aria-label="Team Alpha policies and contact"><a href={PRODUCT_HELP_LINKS.privacy}>Team Alpha privacy<ArrowUpRight size={12}/></a><a href={PRODUCT_HELP_LINKS.terms}>Team Alpha terms<ArrowUpRight size={12}/></a><a href={PRODUCT_HELP_LINKS.support}>Contact support<ArrowUpRight size={12}/></a></nav><a className="sos-footer-wordmark" data-motion-unit="closing-wordmark" href="#sos-main" aria-label="Back to Studio X OS home"><img src={PRODUCT_BRAND.wordmark} srcSet={PRODUCT_BRAND.wordmarkSrcSet} sizes={PRODUCT_BRAND.wordmarkSizes} alt="" width="4096" height="759" loading="lazy" decoding="async"/></a><div className="sos-footer-bottom"><span>© {new Date().getFullYear()} Studio X OS · By Team Alpha</span><span>Commercial product preview</span><a href="https://teamalpha.photography">Visit Team Alpha<ArrowUpRight size={12}/></a></div></div></footer></div>;
}
