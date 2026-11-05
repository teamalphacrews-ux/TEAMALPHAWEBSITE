import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, Layers3, UsersRound } from 'lucide-react';
import '../admin/studio.css';
import './saas.css';
import './productAuth.css';

export function SignupFrame({ title, description, children, invitation = false, signIn = false }) {
  useEffect(() => { const previous = document.title; document.title = title + ' · Studio OS'; return () => { document.title = previous; }; }, [title]);
  return <main className="studio-app saas-auth"><header className="saas-auth-header"><Link className="saas-product-brand" to="/studio-os"><span><Layers3 size={23} strokeWidth={1.6} /></span><strong>Studio OS<small>A home for your craft</small></strong></Link><Link to={signIn ? "/signup" : "/studio-os/login"} className="saas-auth-signin">{signIn ? "New to Studio OS?" : "Already a member?"} <strong>{signIn ? "Create a studio" : "Sign in"} <ArrowRight size={13} /></strong></Link></header><div className="saas-auth-layout"><section className="saas-auth-card"><span className="saas-kicker">YOUR NEXT CHAPTER</span><h1>{title}</h1><p className="saas-auth-description">{description}</p>{children}</section><aside className="saas-auth-aside"><span className="saas-editorial-label">{invitation ? 'Better, together.' : 'One studio. Beautifully connected.'}</span><h2>{invitation ? <>Your people.<br />Your shared craft.</> : <>More room for<br />your best work.</>}</h2><p>From the first enquiry to the final delivery, bring your clients, projects and team together.</p><ul><li><Check size={16} />A workspace that belongs to your studio</li><li><Check size={16} />Your own branding and client smart links</li><li><Check size={16} />Projects, payments and production in sync</li><li><Check size={16} />Invite your people as you grow</li></ul><div className="saas-auth-orbit" aria-hidden="true"><i /><i /><i />{invitation ? <UsersRound size={46} strokeWidth={1} /> : <Layers3 size={46} strokeWidth={1} />}</div></aside></div><footer className="saas-auth-footer"><span>Studio OS · Built for creative teams</span><Link to="/studio-os">Explore Studio OS <ArrowRight size={12} /></Link></footer></main>;
}
export function PasswordField({ value, onChange, minLength = 12, label = 'Password', autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return <label className="saas-field"><span>{label}</span><div className="saas-password"><input type={visible ? 'text' : 'password'} value={value} onChange={onChange} minLength={minLength} maxLength={256} required autoComplete={autoComplete} /><button type="button" onClick={() => setVisible(previous => !previous)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>;
}
