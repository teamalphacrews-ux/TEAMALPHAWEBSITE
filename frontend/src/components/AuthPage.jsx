import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Aperture, ShieldCheck, Eye, EyeOff, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../utils/apiConfig';
import '../admin/studio.css';
import './auth.css';

export default function AuthPage() {
  const { user, token, login } = useAuth();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'client' ? 'client' : 'admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user && token) return <Navigate to={user.role === 'admin' ? '/admin' : '/portal'} replace />;
  const submit = async event => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const result = await fetch(API_BASE_URL + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password, role }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.msg || 'Please check your email and password.');
      login(data.user, data.token);
    } catch (err) { setError(err.message === 'Failed to fetch' ? 'We couldn’t connect to your studio. Please try again shortly.' : err.message); }
    finally { setSubmitting(false); }
  };
  return <div className="studio-app studio-auth">
    <section className="studio-auth-form-panel">
      <Link to="/" className="studio-auth-brand"><Aperture size={30} strokeWidth={1.1} /><span><strong>TEAM ALPHA</strong><small>STUDIO OS</small></span></Link>
      <div className="studio-auth-form-content"><span className="studio-eyebrow">A HOME FOR YOUR CRAFT</span><h1>Welcome back.</h1><p>{role === 'admin' ? 'Your stories. Your people. Your studio, in sync.' : 'Your celebrations, beautifully preserved.'}</p>
        <div className="studio-auth-roles" aria-label="Choose sign-in type"><button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => { setRole('admin'); setError(''); }} aria-pressed={role === 'admin'}>Studio team</button><button type="button" className={role === 'client' ? 'active' : ''} onClick={() => { setRole('client'); setError(''); }} aria-pressed={role === 'client'}>Client portal</button></div>
        {error && <div className="studio-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="studio-field" htmlFor="studio-email">Email address<input id="studio-email" className="studio-input" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@teamalpha.studio" required /></label>
          <label className="studio-field" htmlFor="studio-password">Password<div className="studio-password-input"><input id="studio-password" className="studio-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <button className="studio-button primary studio-auth-submit" disabled={submitting}>{submitting ? 'Signing in…' : role === 'admin' ? 'Enter your studio' : 'Open your portal'}<ArrowRight size={16} /></button>
        </form>
        <p className="studio-auth-help">{role === 'admin' ? 'Need access? Contact your studio administrator.' : 'Your studio team will share your account details.'}</p>
        <div className="studio-auth-security"><ShieldCheck size={14} /><span>{role === 'admin' ? 'Private workspace · Team Alpha team only' : 'Your personal client portal'}</span></div>
      </div>
      <footer className="studio-auth-footer"><span>© {new Date().getFullYear()} Team Alpha</span><Link to="/">Back to our website <ArrowUpRight size={12} /></Link></footer>
    </section>
    <section className="studio-auth-image-panel" aria-label="Team Alpha wedding photography"><img src="/assets/studio-pre-wedding.webp" alt="A couple photographed by Team Alpha" /><div className="studio-auth-image-overlay" /><div className="studio-auth-image-caption"><span className="studio-eyebrow">THE ART OF RUNNING YOUR STUDIO</span><h2>More space<br />for <em>beautiful stories.</em></h2><p>From the first hello to the final frame.<br />Every detail, thoughtfully together.</p><span className="studio-auth-signature">TEAM ALPHA <span>THE WEDDING ARTIST</span></span></div><span className="studio-auth-image-label">PHOTOGRAPHY & CINEMATOGRAPHY</span></section>
  </div>;
}
