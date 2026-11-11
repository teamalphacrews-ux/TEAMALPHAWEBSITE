import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, UsersRound } from 'lucide-react';
import '../admin/studio.css';
import './saas.css';
import './productAuth.css';
import StudioProductBrand from '../components/StudioProductBrand';
import { signupHref, signupPlanId } from './signupIntent';
import { PRODUCT_HELP_LINKS } from './productLinks';

export function SignupFrame({ title, description, children, invitation = false, signIn = false, plan }) {
  useEffect(() => { const previous = document.title; document.title = title + ' · Studio X OS'; return () => { document.title = previous; }; }, [title]);
  return <main className="studio-app saas-auth saas-product-auth"><header className="saas-auth-header"><Link className="saas-product-brand" to="/studio-os"><StudioProductBrand tone="inverse" /></Link><Link to={signIn ? signupHref(plan) : '/studio-os/login' + (signupPlanId(plan) ? '?plan=' + plan : '')} className="saas-auth-signin">{signIn ? "New to Studio X OS?" : "Already a member?"} <strong>{signIn ? "Create a studio" : "Sign in"} <ArrowRight size={13} /></strong></Link></header><div className="saas-auth-layout"><section className="saas-auth-card"><h1>{title}</h1><p className="saas-auth-description">{description}</p>{children}</section><aside className="saas-auth-aside"><span className="saas-editorial-label">{invitation ? 'Better, together.' : 'One studio. Beautifully connected.'}</span><h2>{invitation ? <>Your people.<br />Your shared craft.</> : <>More room for<br />your best work.</>}</h2><p>From the first enquiry to the final delivery, bring your clients, projects and team together.</p><ul><li><Check size={16} />A workspace that belongs to your studio</li><li><Check size={16} />Your own branding and client smart links</li><li><Check size={16} />Projects, payments and production in sync</li><li><Check size={16} />Invite your people as you grow</li></ul><div className="saas-auth-orbit" aria-hidden="true"><i /><i /><i />{invitation ? <UsersRound size={46} strokeWidth={1} /> : <StudioProductBrand compact tone="inverse" />}</div></aside></div><footer className="saas-auth-footer"><span>Studio X OS · Built for creative teams</span><nav aria-label="Legal and support"><a href={PRODUCT_HELP_LINKS.privacy}>Team Alpha privacy</a><a href={PRODUCT_HELP_LINKS.terms}>Team Alpha terms</a><a href={PRODUCT_HELP_LINKS.support}>Contact support</a></nav><Link to="/studio-os">Explore Studio X OS <ArrowRight size={12} /></Link></footer></main>;
}
export function PasswordField({ value, onChange, minLength = 12, label = 'Password', autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return <label className="saas-field"><span>{label}</span><div className="saas-password"><input type={visible ? 'text' : 'password'} value={value} onChange={onChange} minLength={minLength} maxLength={256} required autoComplete={autoComplete} /><button type="button" onClick={() => setVisible(previous => !previous)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>;
}
