import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SignupFrame, PasswordField } from './AuthFrame';
import { isWorkspaceSession, openWorkspaceSession, saasRequest } from './api';
import { callbackParameters, readSocialFlow, safeAuthorizationUrl, SOCIAL_FLOW_KEY, validSocialCode } from './socialAuthFlow';

function usePublicConfig() {
  const [config, setConfig] = useState(null), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    saasRequest('/config', { publicRequest: true, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setConfig(value); })
      .catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return { config, loading };
}
function clearFlow() { try { sessionStorage.removeItem(SOCIAL_FLOW_KEY); } catch { /* No retained flow is needed after completion. */ } }
function saveFlow(flow) {
  try { sessionStorage.setItem(SOCIAL_FLOW_KEY, JSON.stringify(flow)); }
  catch { throw new Error('Allow session storage in this browser to finish signing in, then try again.'); }
}
const errorMessage = error => error?.message === 'Failed to fetch' ? 'We could not connect. Please check your connection and try again.' : error?.message || 'Sign-in could not be completed. Please try again.';

export function SocialAuthButtons({ config, loading = false, purpose = 'signup' }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const actionLock = useRef(false);
  const available = provider => !loading && config?.oauth?.[provider]?.enabled === true && (purpose !== 'signup' || config?.enabled === true);
  const start = async provider => {
    if (!available(provider) || actionLock.current) return;
    actionLock.current = true; setBusy(provider); setError('');
    try {
      // This must survive the round trip in this tab; no credentials are put in a URL.
      clearFlow();
      saveFlow({ pending: true });
      const result = await saasRequest('/oauth/' + provider + '/start', { method: 'POST', publicRequest: true, body: { purpose } });
      const url = safeAuthorizationUrl(result.authorizationUrl, provider);
      if (!url || !validSocialCode(result.browserProof)) throw new Error('The sign-in service returned an unexpected response. Please try again.');
      saveFlow({ browserProof: result.browserProof, purpose, createdAt: Date.now() });
      window.location.assign(url);
    } catch (failure) {
      clearFlow(); setError(errorMessage(failure)); actionLock.current = false; setBusy('');
    }
  };
  return <div className="saas-social-auth">
    <div className="saas-social-buttons">
      <button className="saas-social-button is-google" type="button" disabled={!available('google') || Boolean(busy)} onClick={() => start('google')} aria-describedby="saas-social-status">
        <img src="https://developers.google.com/static/identity/images/g-logo.png" alt="" width="20" height="20" referrerPolicy="no-referrer" />
        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <button className="saas-social-button is-apple" type="button" disabled={!available('apple') || Boolean(busy)} onClick={() => start('apple')} aria-describedby="saas-social-status">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17.05 12.54c.02 3.24 2.84 4.32 2.87 4.34-.02.08-.45 1.54-1.48 3.05-.89 1.3-1.81 2.59-3.26 2.62-1.42.03-1.88-.84-3.51-.84-1.62 0-2.13.82-3.48.87-1.4.06-2.47-1.4-3.37-2.69-1.83-2.64-3.23-7.47-1.35-10.73.93-1.62 2.6-2.65 4.41-2.68 1.38-.03 2.68.93 3.52.93.85 0 2.44-1.15 4.11-.98.7.03 2.67.28 3.94 2.14-.1.06-2.36 1.37-2.4 3.97ZM14.37 4.69c.75-.91 1.26-2.17 1.12-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.08-1.14 3.31 1.21.09 2.44-.61 3.17-1.51Z" /></svg>
        {busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
      </button>
    </div>
    <p className="saas-social-status" id="saas-social-status">{loading ? 'Checking sign-in availability…' : !config?.oauth ? 'Sign-in availability could not be confirmed. Please try again later.' : !available('google') && !available('apple') ? (purpose === 'signup' ? 'Google and Apple signup will open when registration is ready.' : 'Google and Apple sign-in are not available yet.') : !available('google') ? 'Google sign-in is not available yet.' : !available('apple') ? 'Apple sign-in is not available yet.' : 'Only your identity is requested. Email and calendar access are separate.'}</p>
    {error && <p className="saas-error" role="alert">{error}</p>}
  </div>;
}

export function ProductLoginPage() {
  const { user, token } = useAuth(), { config, loading } = usePublicConfig();
  const [form, setForm] = useState({ email: '', password: '' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (token && user?.workspace) return <Navigate to="/admin" replace />;
  const submit = async event => {
    event.preventDefault(); if (busy || config?.authEnabled !== true) return;
    setBusy(true); setError('');
    try {
      const result = await saasRequest('/login', { method: 'POST', publicRequest: true, body: { email: form.email.trim(), password: form.password } });
      if (!isWorkspaceSession(result)) throw new Error('Your studio session could not be confirmed.');
      setForm(previous => ({ ...previous, password: '' })); await openWorkspaceSession(result);
    } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  };
  return <SignupFrame signIn title="Back to your best work." description="Sign in to your Studio OS account to open your private workspace.">
    <SocialAuthButtons config={config} loading={loading} purpose="login" />
    <div className="saas-auth-divider"><span>or sign in with email</span></div>
    {error && <p className="saas-error" role="alert">{error}</p>}
    <form className="saas-auth-form" onSubmit={submit}><fieldset disabled={busy || loading || config?.authEnabled !== true}>
      <label className="saas-field"><span>Email address</span><input type="email" value={form.email} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} autoComplete="username" required maxLength={254} placeholder="you@yourstudio.com" /></label>
      <PasswordField value={form.password} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} minLength={1} autoComplete="current-password" />
      <button className="saas-primary" type="submit" disabled={busy || loading || config?.authEnabled !== true}>{busy ? 'Signing in…' : 'Open my studio'}<ArrowRight size={16} /></button>
    </fieldset></form>
    {!loading && config?.authEnabled !== true && <p className="saas-social-status">Studio account sign-in is not available here yet.</p>}
    <p className="saas-auth-existing"><LockKeyhole size={14} />Existing Team Alpha team? <Link to="/auth">Use studio sign-in</Link></p>
  </SignupFrame>;
}

function callbackState() {
  let flow;
  try { flow = readSocialFlow(sessionStorage.getItem(SOCIAL_FLOW_KEY)); } catch { return { error: 'Allow session storage in this browser to sign in, then try again.' }; }
  const result = callbackParameters(window.location.hash);
  if (result.error) return result;
  const ticket = result.ticket || flow?.ticket;
  if (!flow || !validSocialCode(ticket)) return { error: 'This sign-in must finish in the same tab where it started. Please start again.' };
  return { ...flow, ticket };
}
export function SocialCallbackPage() {
  const [flow] = useState(callbackState), [profile, setProfile] = useState(null), [error, setError] = useState(flow.error || ''), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ studioName: '', firstName: '', lastName: '' });
  const exchange = useRef(null), applied = useRef(false), finishing = useRef(false);
  useEffect(() => {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    if (flow.error) { clearFlow(); return; }
    let active = true;
    if (!exchange.current) exchange.current = Promise.resolve().then(() => { saveFlow(flow); return saasRequest('/oauth/complete', { method: 'POST', publicRequest: true, body: { ticket: flow.ticket, browserProof: flow.browserProof } }); });
    exchange.current.then(async result => {
      if (!active || applied.current) return;
      applied.current = true;
      if (isWorkspaceSession(result)) { clearFlow(); await openWorkspaceSession(result); return; }
      if (!result.needsWorkspace || !result.profile?.email) throw new Error('Your sign-in could not be confirmed. Please start again.');
      setProfile(result.profile); setForm(previous => ({ ...previous, firstName: result.profile.firstName || '', lastName: result.profile.lastName || '' }));
    }).catch(failure => { if (active) { clearFlow(); setError(errorMessage(failure)); } });
    return () => { active = false; };
  }, [flow]);
  const complete = async event => {
    event.preventDefault(); if (finishing.current || !profile) return;
    finishing.current = true; setBusy(true); setError('');
    try {
      const result = await saasRequest('/oauth/complete', { method: 'POST', publicRequest: true, body: { ticket: flow.ticket, browserProof: flow.browserProof, ...form } });
      if (!isWorkspaceSession(result)) throw new Error('Your studio session could not be confirmed. Please start again.');
      clearFlow(); await openWorkspaceSession(result);
    } catch (failure) { setError(errorMessage(failure)); } finally { finishing.current = false; setBusy(false); }
  };
  return <SignupFrame title={profile ? 'Make it your studio.' : error ? 'Let’s try that again.' : 'Opening your workspace.'} description={profile ? 'Your identity is verified. Give your new workspace a name to finish setting up.' : 'Secure sign-in for your creative team.'}>
    {error && <p className="saas-error" role="alert">{error}</p>}
    {profile ? <><div className="saas-invite-summary"><span>{profile.email}</span><small><ShieldCheck size={13} />Verified account</small></div><form className="saas-auth-form" onSubmit={complete}><fieldset disabled={busy}>
      <label className="saas-field"><span>Studio name</span><input required minLength={2} maxLength={120} autoComplete="organization" value={form.studioName} onChange={event => setForm(previous => ({ ...previous, studioName: event.target.value }))} placeholder="Your creative studio" /></label>
      <div className="saas-form-grid"><label className="saas-field"><span>First name</span><input required maxLength={120} autoComplete="given-name" value={form.firstName} onChange={event => setForm(previous => ({ ...previous, firstName: event.target.value }))} /></label><label className="saas-field"><span>Last name</span><input maxLength={120} autoComplete="family-name" value={form.lastName} onChange={event => setForm(previous => ({ ...previous, lastName: event.target.value }))} /></label></div>
      <p className="saas-form-help">Start with a 14-day Starter trial for up to 5 team members. No payment details required.</p><button className="saas-primary" type="submit" disabled={busy}>{busy ? 'Creating your studio…' : 'Create my studio'}<ArrowRight size={16} /></button>
    </fieldset></form></> : !error && <p className="saas-info" role="status">Verifying your account…</p>}
    {error && <Link className="saas-restart-auth" to="/studio-os/login">Return to sign in<ArrowRight size={14} /></Link>}
  </SignupFrame>;
}
