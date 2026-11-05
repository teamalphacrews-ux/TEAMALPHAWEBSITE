import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isWorkspaceSession, openWorkspaceSession, roleLabel, saasRequest, safeDate } from './api';
import { SignupFrame, PasswordField } from './AuthFrame';
import { AuthAvailability, SocialAuthButtons } from './SocialAuth';
import { usePublicAuthConfig } from './usePublicAuthConfig';
import './saas.css';

const failureMessage = error => error?.message === 'Failed to fetch' ? 'We could not reach Studio OS. Check your connection and try again.' : error?.message || 'Please try again.';
export function SignupPage() {
  const { user, token } = useAuth();
  const availability = usePublicAuthConfig(), { config, loading } = availability;
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const submitting = useRef(false);
  const beginProvider = useCallback(() => { if (submitting.current) return false; submitting.current = true; setProviderBusy(true); return true; }, []);
  const finishProvider = useCallback(() => { submitting.current = false; setProviderBusy(false); }, []);
  const [form, setForm] = useState({ studioName: '', firstName: '', lastName: '', email: '', password: '' });
  if (token && user?.workspace) return <Navigate to="/admin" replace />;
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault(); if (submitting.current || config?.enabled !== true || config?.authEnabled !== true) return; submitting.current = true; setBusy(true); setError('');
    try { const result = await saasRequest('/signup', { method: 'POST', publicRequest: true, body: { ...form, studioName: form.studioName.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase() } }); if (!isWorkspaceSession(result)) throw new Error('Your studio session could not be confirmed. Please sign in.'); setForm(previous => ({ ...previous, password: '' })); await openWorkspaceSession(result); }
    catch (failure) { setError(failureMessage(failure)); } finally { submitting.current = false; setBusy(false); }
  };
  return <SignupFrame title="Make space for your studio." description="Create your private workspace for clients, projects and the people behind your studio.">
    <AuthAvailability {...availability} />
    {error && <p className="saas-error" role="alert">{error}</p>}
    <SocialAuthButtons config={config} loading={loading} purpose="signup" disabled={busy || providerBusy} onStart={beginProvider} onFinish={finishProvider} />
    {!loading && config && (!config.enabled || !config.authEnabled) ? <div className="saas-info"><h2>Studio registration opens soon.</h2><p>We’re preparing the commercial beta. Your account will be created only when registration is enabled.</p><Link to="/studio-os/login">Sign in to an existing studio <ArrowRight size={15} /></Link></div> : config?.enabled && config?.authEnabled ? <>
      <div className="saas-auth-divider"><span>or create an account with email</span></div>
      <div className="saas-trial-note"><span><ShieldCheck size={16} />{Number(config.trialDays) || 14}-day studio trial</span><small>No payment details required to get started.</small></div>
      <form onSubmit={submit} className="saas-auth-form"><fieldset disabled={busy || providerBusy}>
        <label className="saas-field"><span>Studio name</span><input name="studioName" value={form.studioName} onChange={change} required minLength={2} maxLength={120} autoComplete="organization" placeholder="Your creative studio" /></label>
        <div className="saas-form-grid"><label className="saas-field"><span>First name</span><input name="firstName" value={form.firstName} onChange={change} required maxLength={120} autoComplete="given-name" /></label><label className="saas-field"><span>Last name</span><input name="lastName" value={form.lastName} onChange={change} required maxLength={120} autoComplete="family-name" /></label></div>
        <label className="saas-field"><span>Work email</span><input name="email" type="email" value={form.email} onChange={change} required maxLength={254} autoComplete="email" placeholder="you@yourstudio.com" /></label>
        <PasswordField value={form.password} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} />
        <p className="saas-form-help">Use at least 12 characters. You’ll be the owner of this studio.</p>
        <button className="saas-primary" type="submit" disabled={busy || providerBusy} aria-busy={busy}>{busy ? 'Creating your studio…' : 'Create my studio'}<ArrowRight size={16} /></button>
      </fieldset></form>
    </> : null}
  </SignupFrame>;
}
export function AcceptInvitationPage() {
  const { token: inviteToken } = useParams();
  const [invite, setInvite] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  useEffect(() => { const controller = new AbortController(); saasRequest('/invitations/' + encodeURIComponent(inviteToken || ''), { publicRequest: true, signal: controller.signal }).then(setInvite).catch(failure => { if (failure.name !== 'AbortError') setError(failureMessage(failure)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [inviteToken]);
  const submit = async event => {
    event.preventDefault(); if (busy || !invite) return; setBusy(true); setError('');
    try { const result = await saasRequest('/invitations/' + encodeURIComponent(inviteToken || '') + '/accept', { method: 'POST', publicRequest: true, body: { ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim() } }); if (!isWorkspaceSession(result)) throw new Error('Your studio access could not be confirmed. Please sign in.'); setForm(previous => ({ ...previous, password: '' })); await openWorkspaceSession(result); }
    catch (failure) { setError(failureMessage(failure)); } finally { setBusy(false); }
  };
  return <SignupFrame invitation title={invite ? 'You’re invited to ' + invite.studioName + '.' : 'Join your studio.'} description="A shared space for the people behind every story.">{error && <p className="saas-error" role="alert">{error}</p>}{loading ? <p className="saas-info" role="status">Checking your invitation…</p> : !invite ? <div className="saas-info"><h2>This invitation could not be opened.</h2><p>Ask the studio owner for a new link if this invitation has expired or been revoked.</p><Link to="/auth">Back to sign in <ArrowRight size={13} /></Link></div> : <><div className="saas-invite-summary"><span>{invite.email}</span><small>{roleLabel(invite.role)} · Invitation expires {safeDate(invite.expiresAt)}</small></div><form className="saas-auth-form" onSubmit={submit}><fieldset disabled={busy}><div className="saas-form-grid"><label className="saas-field"><span>First name</span><input value={form.firstName} onChange={event => setForm(previous => ({ ...previous, firstName: event.target.value }))} required maxLength={120} autoComplete="given-name" /></label><label className="saas-field"><span>Last name</span><input value={form.lastName} onChange={event => setForm(previous => ({ ...previous, lastName: event.target.value }))} required maxLength={120} autoComplete="family-name" /></label></div><PasswordField value={form.password} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} minLength={8} label="Your Studio OS password" autoComplete="current-password" /><p className="saas-form-help">Already have a Studio OS account? Enter its current password. If you’re new, choose a password of at least 12 characters for the invited email address.</p><button className="saas-primary" type="submit" disabled={busy}>{busy ? 'Joining your studio…' : 'Accept invitation'}<ArrowRight size={16} /></button></fieldset></form></>}</SignupFrame>;
}
