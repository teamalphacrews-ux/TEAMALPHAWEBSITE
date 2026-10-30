import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Eye, EyeOff, ArrowUpRight } from 'lucide-react';
import { TEAM_ALPHA_LOGO } from '../utils/branding';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../utils/apiConfig';
import { SAAS_RELEASE_ENABLED } from '../saas/release';
import '../admin/studio.css';
import '../admin/studio-mobile.css';
import './auth.css';
import '../admin/studio-brand.css';

export default function AuthPage() {
  const { user, token, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user?.role === 'admin' && token) return <Navigate to="/admin" replace />;
  const submit = async event => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const result = await fetch(API_BASE_URL + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password, role: 'admin' }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.msg || 'Please check your email and password.');
      if (data.user?.role !== 'admin') throw new Error('This sign-in is for the studio team.');
      await login(data.user, data.token);
    } catch (err) { setError(err.message === 'Failed to fetch' ? 'We couldn’t connect to your studio. Please try again shortly.' : err.message); }
    finally { setSubmitting(false); }
  };
  return <div className="studio-app studio-auth">
    <section className="studio-auth-form-panel">
      <Link to="/" className="studio-auth-brand"><img src={TEAM_ALPHA_LOGO} alt="" width="64" height="64" /><span><strong>TEAM ALPHA</strong><small>STUDIO OS</small></span></Link>
      <div className="studio-auth-form-content"><span className="studio-eyebrow">A HOME FOR YOUR CRAFT</span><h1>Welcome back.</h1><p>Your stories. Your people. Your studio, in sync.</p>
        {error && <div className="studio-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="studio-field" htmlFor="studio-email">Email address<input id="studio-email" className="studio-input" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@teamalpha.studio" required /></label>
          <label className="studio-field" htmlFor="studio-password">Password<div className="studio-password-input"><input id="studio-password" className="studio-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <button className="studio-button primary studio-auth-submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Enter your studio'}<ArrowRight size={16} /></button>
        </form>
        {SAAS_RELEASE_ENABLED ? <p className="studio-auth-help">New to Studio OS? <Link to="/signup">Create your studio</Link><br />Joining a team? Open your studio invitation.</p> : <p className="studio-auth-help">Need access? Contact your studio administrator.</p>}
        <div className="studio-auth-security"><ShieldCheck size={14} /><span>{SAAS_RELEASE_ENABLED ? 'A private workspace for every studio' : 'Private workspace · Team Alpha team only'}</span></div>
      </div>
      <footer className="studio-auth-footer"><span>© {new Date().getFullYear()} Team Alpha</span><Link to="/">Back to our website <ArrowUpRight size={12} /></Link></footer>
    </section>
  </div>;
}
