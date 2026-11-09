import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SignupFrame, PasswordField } from './AuthFrame';
import { isWorkspaceSession, openWorkspaceSession, saasRequest } from './api';
import { socialCallbackState, safeAuthorizationUrl, SOCIAL_FLOW_KEY, validSocialCode, validateWorkspaceDetails } from './socialAuthFlow';
import { socialProviderState } from './publicAuthConfig';
import { usePublicConfig } from './usePublicConfig';
import PublicConfigStatus from './PublicConfigStatus';
import { useSignupPlan } from './useSignupPlan';
import { SIGNUP_PLAN_NAMES, signupHref, signupPlanId } from './signupIntent';
import { IS_COMMERCIAL_DEPLOYMENT } from './release';

function clearFlow() { try { sessionStorage.removeItem(SOCIAL_FLOW_KEY); } catch { /* No retained flow is needed after completion. */ } }
function saveFlow(flow) {
  try { sessionStorage.setItem(SOCIAL_FLOW_KEY, JSON.stringify(flow)); }
  catch { throw new Error('Allow session storage in this browser to finish signing in, then try again.'); }
}
const errorMessage = error => error?.message === 'Failed to fetch' ? 'We could not connect. Please check your connection and try again.' : error?.message || 'Sign-in could not be completed. Please try again.';

async function completeSocialSignIn(body) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try { return await saasRequest('/oauth/complete', { method: 'POST', publicRequest: true, body, signal: controller.signal }); }
  catch (failure) {
    if (failure.name === 'AbortError') throw new Error('Account verification took too long. Start sign-in again to safely continue.');
    throw failure;
  } finally { window.clearTimeout(timeout); }
}

export function SocialAuthButtons({ config, loading = false, purpose = 'signup', plan = 'starter', disabled = false, onStart, onFinish }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const statusId = useId();
  const actionLock = useRef(false);
  const pendingRequest = useRef(null);
  const state = provider => socialProviderState(config, provider, purpose, loading);
  const available = provider => state(provider) === 'ready';
  useEffect(() => {
    const returned = event => {
      if (!event.persisted) return;
      actionLock.current = false; setBusy(''); setError(''); clearFlow(); onFinish?.();
    };
    window.addEventListener('pageshow', returned);
    return () => { window.removeEventListener('pageshow', returned); pendingRequest.current?.abort(); };
  }, [onFinish]);
  const start = async provider => {
    if (disabled || !available(provider) || actionLock.current) return;
    if (onStart && !onStart()) return;
    actionLock.current = true; setBusy(provider); setError('');
    const controller = new AbortController(); pendingRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      // This must survive the round trip in this tab; no credentials are put in a URL.
      clearFlow();
      saveFlow({ pending: true });
      const result = await saasRequest('/oauth/' + provider + '/start', { method: 'POST', publicRequest: true, body: { purpose }, signal: controller.signal });
      const url = safeAuthorizationUrl(result.authorizationUrl, provider);
      if (!url || !validSocialCode(result.browserProof)) throw new Error('The sign-in service returned an unexpected response. Please try again.');
      saveFlow({ browserProof: result.browserProof, purpose, provider, createdAt: Date.now(), ...(signupPlanId(plan) ? { plan } : {}) });
      window.location.assign(url);
    } catch (failure) {
      clearFlow(); setError(failure.name === 'AbortError' ? 'Sign-in took too long to open. Check your connection and try again.' : errorMessage(failure)); actionLock.current = false; setBusy(''); onFinish?.();
    } finally { window.clearTimeout(timeout); pendingRequest.current = null; }
  };
  return <div className="saas-social-auth">
    <div className="saas-social-buttons">
      <button className="saas-social-button is-google" type="button" disabled={disabled || !available('google') || Boolean(busy)} onClick={() => start('google')} aria-describedby={statusId} aria-busy={busy === 'google'}>
        <img src="https://developers.google.com/static/identity/images/g-logo.png" alt="" width="20" height="20" referrerPolicy="no-referrer" />
        <span>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</span>
        {busy === 'google' && <LoaderCircle className="saas-auth-spinner saas-provider-progress" size={16} aria-hidden="true" />}
      </button>
      <button className="saas-social-button is-apple" type="button" disabled={disabled || !available('apple') || Boolean(busy)} onClick={() => start('apple')} aria-describedby={statusId} aria-busy={busy === 'apple'}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17.05 12.54c.02 3.24 2.84 4.32 2.87 4.34-.02.08-.45 1.54-1.48 3.05-.89 1.3-1.81 2.59-3.26 2.62-1.42.03-1.88-.84-3.51-.84-1.62 0-2.13.82-3.48.87-1.4.06-2.47-1.4-3.37-2.69-1.83-2.64-3.23-7.47-1.35-10.73.93-1.62 2.6-2.65 4.41-2.68 1.38-.03 2.68.93 3.52.93.85 0 2.44-1.15 4.11-.98.7.03 2.67.28 3.94 2.14-.1.06-2.36 1.37-2.4 3.97ZM14.37 4.69c.75-.91 1.26-2.17 1.12-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.08-1.14 3.31 1.21.09 2.44-.61 3.17-1.51Z" /></svg>
        <span>{busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}</span>
        {busy === 'apple' && <LoaderCircle className="saas-auth-spinner saas-provider-progress" size={16} aria-hidden="true" />}
      </button>
    </div>
    <div className="saas-social-status" id={statusId} aria-live="polite">
      {busy ? <p>Continue securely in {busy === 'google' ? 'Google' : 'Apple'}. You’ll return here to finish.</p> : loading ? <p>Account options will appear as soon as the service responds.</p> : !config ? <p>Account options are unavailable until we can check the sign-in service.</p> : purpose === 'signup' && !config.enabled ? <p>New studio registration is currently closed. Existing members can still <Link to="/studio-os/login">sign in</Link>.</p> : !available('google') && !available('apple') ? <p>Google and Apple are not connected yet.{config.authEnabled && config.enabled ? ' You can continue with email below.' : ''}</p> : <><p>We use your name and email to identify your account. Gmail, Calendar and Drive are connected separately.</p>{!available('google') && <p>Google sign-in is not available yet. Use Apple{purpose === 'login' || config.enabled ? ' or email' : ''}.</p>}{!available('apple') && <p>Apple sign-in is not available yet. Use Google{purpose === 'login' || config.enabled ? ' or email' : ''}.</p>}</>}
    </div>
    {error && <p className="saas-error" role="alert">{error}</p>}
  </div>;
}

export function ProductLoginPage() {
  const { user, token } = useAuth(), availability = usePublicConfig();
  const plan = useSignupPlan();
  const { config, loading } = availability;
  const [form, setForm] = useState({ email: '', password: '' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [providerBusy, setProviderBusy] = useState(false);
  const submitting = useRef(false);
  const beginProvider = useCallback(() => { if (submitting.current) return false; submitting.current = true; setProviderBusy(true); return true; }, []);
  const finishProvider = useCallback(() => { submitting.current = false; setProviderBusy(false); }, []);
  if (token && user?.workspace) return <Navigate to="/admin" replace />;
  const submit = async event => {
    event.preventDefault(); if (submitting.current || config?.authEnabled !== true) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const result = await saasRequest('/login', { method: 'POST', publicRequest: true, body: { email: form.email.trim(), password: form.password } });
      if (!isWorkspaceSession(result)) throw new Error('Your studio session could not be confirmed.');
      setForm(previous => ({ ...previous, password: '' })); await openWorkspaceSession(result);
    } catch (failure) { setError(errorMessage(failure)); } finally { submitting.current = false; setBusy(false); }
  };
  return <SignupFrame signIn plan={plan} title="Back to your best work." description="Sign in to your Studio X OS account to open your private workspace.">
    <PublicConfigStatus {...availability} />
    <SocialAuthButtons config={config} loading={loading} plan={plan} purpose="login" disabled={busy || providerBusy} onStart={beginProvider} onFinish={finishProvider} />
    <div className="saas-auth-divider"><span>or sign in with email</span></div>
    {error && <p className="saas-error" role="alert">{error}</p>}
    <form className="saas-auth-form" onSubmit={submit}><fieldset disabled={busy || providerBusy || loading || config?.authEnabled !== true}>
      <label className="saas-field"><span>Email address</span><input type="email" value={form.email} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} autoComplete="username" required maxLength={254} placeholder="you@yourstudio.com" /></label>
      <PasswordField value={form.password} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} minLength={1} autoComplete="current-password" />
      <button className="saas-primary" type="submit" disabled={busy || providerBusy || loading || config?.authEnabled !== true} aria-busy={busy}>{busy ? 'Signing in…' : 'Open my studio'}<ArrowRight size={16} /></button>
    </fieldset></form>
    {!loading && config && config.authEnabled !== true && <p className="saas-social-status">Studio account sign-in is not available here yet. Please return when the service opens.</p>}
    <p className="saas-auth-existing"><LockKeyhole size={14} />Existing Team Alpha team? {IS_COMMERCIAL_DEPLOYMENT ? <a href="https://teamalpha.photography/auth">Use Team Alpha sign-in</a> : <Link to="/auth">Use studio sign-in</Link>}</p>
  </SignupFrame>;
}

function callbackState() {
  try { return socialCallbackState(sessionStorage.getItem(SOCIAL_FLOW_KEY), window.location.hash); }
  catch { return { error: 'Allow session storage in this browser to sign in, then try again.' }; }
}
export function SocialCallbackPage() {
  const [flow] = useState(callbackState), [profile, setProfile] = useState(null), [error, setError] = useState(flow.error || ''), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ studioName: '', firstName: '', lastName: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const formId = useId();
  const exchange = useRef(null), applied = useRef(false), finishing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    if (flow.error) { clearFlow(); return; }
    let active = true;
    if (!exchange.current) exchange.current = Promise.resolve().then(() => { saveFlow(flow); return completeSocialSignIn({ ticket: flow.ticket, browserProof: flow.browserProof }); });
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
    const { values, errors } = validateWorkspaceDetails(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) { event.currentTarget.elements.namedItem(Object.keys(errors)[0])?.focus(); return; }
    finishing.current = true; setBusy(true); setError('');
    try {
      const result = await completeSocialSignIn({ ticket: flow.ticket, browserProof: flow.browserProof, ...values });
      if (!mounted.current) return;
      if (!isWorkspaceSession(result)) throw new Error('Your studio session could not be confirmed. Please start again.');
      clearFlow(); await openWorkspaceSession(result);
    } catch (failure) {
      if (!mounted.current) return;
      if (!failure.status || failure.status === 401 || failure.status === 410 || failure.status >= 500) {
        clearFlow(); setProfile(null);
        setError('Studio setup could not be confirmed. Start sign-in again to safely open your account or finish setup.');
      } else setError(errorMessage(failure));
    } finally { finishing.current = false; if (mounted.current) setBusy(false); }
  };
  const change = event => {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
    setFieldErrors(previous => ({ ...previous, [name]: '' }));
  };
  const restartPath = flow.purpose === 'signup' ? signupHref(flow.plan) : '/studio-os/login';
  const providerName = flow.provider === 'google' ? 'Google' : flow.provider === 'apple' ? 'Apple' : '';
  return <SignupFrame plan={flow.plan} title={profile ? 'Make it your studio.' : error ? 'Let’s try that again.' : 'Opening your workspace.'} description={profile ? 'Your identity is verified. Give your new workspace a name to finish setting up.' : 'Secure sign-in for your creative team.'}>
    {error && <p className="saas-error" role="alert">{error}</p>}
    {profile && signupPlanId(flow.plan) && <div className="saas-invite-summary" aria-label="Selected plan"><span>Plan you’re exploring: {SIGNUP_PLAN_NAMES[flow.plan]}</span><small>Your new workspace starts with a Starter trial for up to 5 team members. Your plan preference is kept; no paid plan is activated here.</small></div>}
    {profile ? <>
      <div className="saas-invite-summary"><span>{profile.email}</span><small><ShieldCheck size={13} aria-hidden="true" />{providerName ? `Verified with ${providerName}` : 'Verified account'}</small></div>
      {flow.provider === 'apple' && <p className="saas-form-help saas-identity-help">Using Hide My Email? This private address is your Studio X OS account email. You can add your studio’s public contact email in Settings later.</p>}
      <form className="saas-auth-form" onSubmit={complete} noValidate><fieldset disabled={busy}>
        <label className="saas-field"><span id={formId + "-studioName-label"}>Studio name</span><input aria-labelledby={formId + "-studioName-label"} name="studioName" required minLength={2} maxLength={120} autoComplete="organization" value={form.studioName} onChange={change} placeholder="Your creative studio" aria-invalid={Boolean(fieldErrors.studioName)} aria-describedby={fieldErrors.studioName ? formId + '-studioName' : undefined} />{fieldErrors.studioName && <small className="saas-field-error" id={formId + '-studioName'}>{fieldErrors.studioName}</small>}</label>
        <div className="saas-form-grid"><label className="saas-field"><span id={formId + "-firstName-label"}>First name</span><input aria-labelledby={formId + "-firstName-label"} name="firstName" required maxLength={120} autoComplete="given-name" value={form.firstName} onChange={change} aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? formId + '-firstName' : undefined} />{fieldErrors.firstName && <small className="saas-field-error" id={formId + '-firstName'}>{fieldErrors.firstName}</small>}</label><label className="saas-field"><span id={formId + "-lastName-label"}>Last name <small>(optional)</small></span><input aria-labelledby={formId + "-lastName-label"} name="lastName" maxLength={120} autoComplete="family-name" value={form.lastName} onChange={change} aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? formId + '-lastName' : undefined} />{fieldErrors.lastName && <small className="saas-field-error" id={formId + '-lastName'}>{fieldErrors.lastName}</small>}</label></div>
        <p className="saas-form-help">You’ll be the studio owner. Continue using this verified account to sign in; no additional password is needed.</p>
        <button className="saas-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Creating your studio…' : 'Create my studio'}{busy ? <LoaderCircle className="saas-auth-spinner" size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
      </fieldset></form>
      {busy ? <span className="saas-restart-auth" aria-disabled="true">Finishing secure setup…</span> : <Link className="saas-restart-auth" to={restartPath} onClick={clearFlow}>Use a different account</Link>}
    </> : !error && <p className="saas-auth-verifying" role="status"><LoaderCircle className="saas-auth-spinner" size={20} aria-hidden="true" />Verifying your account securely…</p>}
    {error && !profile && <Link className="saas-restart-auth" to={restartPath} onClick={clearFlow}>Start sign-in again<ArrowRight size={15} aria-hidden="true" /></Link>}
  </SignupFrame>;
}
