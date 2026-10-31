import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowUpRight, Check, Clock3, FileText, LockKeyhole, MessageCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import API from '../../utils/apiConfig';
import { internationalWhatsAppPhone, safeWabbDashboardUrl, wabbAttemptStatus, wabbManualDraft, wabbManualTextReady, whatsappConnectionLabel, whatsappRequestId } from '../../utils/whatsappData';
import { WorkspaceError, WorkspaceHeader } from '../components/operations/WorkspaceUI';

const attemptStates = ['sending', 'submitted', 'failed', 'unknown'];
const safeError = error => typeof error?.response?.data?.error === 'string' ? error.response.data.error : 'The request could not be completed.';
const restoreAttempt = key => {
  try {
    const value = JSON.parse(sessionStorage.getItem(key));
    if (!value || !/^[a-f\d]{32}$/i.test(value.requestId || '') || !internationalWhatsAppPhone(value.phone) || typeof value.text !== 'string' || value.text.length > 4096 || !['sending', 'failed', 'unknown'].includes(value.status)) return null;
    return { ...value, status: value.status === 'sending' ? 'unknown' : value.status };
  } catch { return null; }
};

/** Wabb supports manual outbound requests here. Its connection and inbox remain in Wabb. */
export default function WabbWorkspace({ status, preview = false, busy = false, error = '', onVerify, onRefresh, timezone = 'Asia/Kolkata', accountId = '' }) {
  const demo = status?.demo === true;
  const dashboard = safeWabbDashboardUrl(status?.dashboardUrl);
  const storageKey = 'studio-os:wabb-attempt:' + JSON.stringify([accountId, dashboard, status?.displayPhoneNumber]);
  const [restored] = useState(() => preview || demo ? null : restoreAttempt(storageKey));
  const [phone, setPhone] = useState(restored?.phone || '');
  const [text, setText] = useState(restored?.text || '');
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [replyWindowConfirmed, setReplyWindowConfirmed] = useState(false);
  const [attempt, setAttempt] = useState(restored);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const claim = useRef(restored ? { requestId: restored.requestId, fingerprint: JSON.stringify([restored.phone, restored.text]) } : null);
  const mounted = useRef(true);
  const ready = !preview && wabbManualTextReady(status) && !error;
  const draft = wabbManualDraft({ phone, text, permissionConfirmed, replyWindowConfirmed });
  const locked = sending || ['sending', 'unknown', 'failed'].includes(attempt?.status);
  const canSend = ready && !demo && draft.valid && !locked && !busy;
  const missing = Array.isArray(status?.missing) ? status.missing.filter(value => typeof value === 'string' && /^WABB_[A-Z0-9_]+$/.test(value)) : [];
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const saveAttempt = value => {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
    if (mounted.current) setAttempt(value);
  };
  const composeNew = () => {
    if (sending) return;
    try { sessionStorage.removeItem(storageKey); } catch { /* The current in-memory lock can still be cleared explicitly. */ }
    claim.current = null; setAttempt(null); setText(''); setPermissionConfirmed(false); setReplyWindowConfirmed(false); setSendError('');
  };
  const send = async event => {
    event.preventDefault();
    if (!canSend) return;
    const fingerprint = JSON.stringify([draft.phone, draft.text]);
    if (claim.current?.fingerprint !== fingerprint) claim.current = { fingerprint, requestId: whatsappRequestId() };
    const pending = { requestId: claim.current.requestId, phone: draft.phone, text: draft.text, status: 'sending', createdAt: new Date().toISOString() };
    // Save the request reference before contacting Wabb. Reloading never replays it.
    try { saveAttempt(pending); }
    catch { setSendError('This browser could not save the request reference. Allow session storage before sending. No request was sent.'); return; }
    setSending(true); setSendError('');
    try {
      const { data } = await axios.post(API + '/api/integrations/whatsapp/wabb/messages', { requestId: pending.requestId, phone: draft.phone, text: draft.text, permissionConfirmed: true, replyWindowConfirmed: true }, { timeout: 90000, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      if (!data?.attempt?.id || !attemptStates.includes(data.attempt.status)) throw new Error('Unconfirmed response');
      const result = { ...pending, ...data.attempt, requestId: pending.requestId };
      if (result.status === 'submitted') {
        try { sessionStorage.removeItem(storageKey); } catch { /* An old stored lock is safer than an accidental resend. */ }
        if (mounted.current) { setAttempt(result); setText(''); setPermissionConfirmed(false); setReplyWindowConfirmed(false); claim.current = null; }
      } else {
        try { saveAttempt(result); } catch { if (mounted.current) setAttempt(result); }
      }
    } catch (failure) {
      const responseAttempt = failure?.response?.data?.attempt;
      const uncertain = !failure.response || failure.response.status >= 500 || [408, 409].includes(failure.response.status);
      const next = { ...pending, ...(responseAttempt && attemptStates.includes(responseAttempt.status) ? responseAttempt : {}), status: responseAttempt && attemptStates.includes(responseAttempt.status) ? responseAttempt.status : uncertain ? 'unknown' : 'failed', error: uncertain ? 'Submission could not be confirmed. Check Wabb and the WhatsApp Business app before composing another message. Nothing will be resent automatically.' : safeError(failure) };
      try { saveAttempt(next); } catch { if (mounted.current) setAttempt(next); }
    } finally { if (mounted.current) setSending(false); }
  };
  const time = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-IN', { timeZone: timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';

  return <div className="studio-whatsapp-page wa-wabb-page">
    <WorkspaceHeader eyebrow="CLIENT COMMUNICATION" title="WhatsApp Business" description={preview ? 'A workspace for your studio’s WhatsApp communication.' : 'Your existing Wabb account. A simpler way to send a client message.'}>
      <Link className="studio-button" to="/admin/integrations"><ArrowLeft size={15} />Integrations</Link>
      <button type="button" className="studio-button" onClick={onRefresh} disabled={preview || busy || sending}><RefreshCw size={15} />Refresh status</button>
      {dashboard && <a className="studio-button primary" href={dashboard} target="_blank" rel="noopener noreferrer">Open Wabb <ArrowUpRight size={15} /></a>}
    </WorkspaceHeader>
    {demo && <div className="wa-wabb-demo" role="status"><ShieldCheck size={17} /><strong>DEMO ONLY — No Wabb account connected. Sending is disabled.</strong></div>}
    <WorkspaceError error={error} retry={onRefresh} />
    <section className="wa-connection-strip studio-card">
      <span className="wa-brand-icon"><MessageCircle size={22} strokeWidth={1.5} /></span>
      <div><strong>{preview ? 'WhatsApp Business preview' : status?.verifiedName || 'Your Wabb connection'}</strong><p>{preview ? 'This sample workspace cannot access your account or send messages.' : [status?.displayPhoneNumber && 'Studio number · ' + status.displayPhoneNumber, 'Your Business app and Wabb connection stay in place.'].filter(Boolean).join(' · ')}</p></div>
      <span className={'studio-badge ' + (ready && !demo ? 'green' : 'gold')}>{preview ? 'Preview only' : error ? 'Unavailable' : whatsappConnectionLabel(status)}</span>
      {status?.owner && <button type="button" className="studio-button small" onClick={onVerify} disabled={preview || demo || !status.configured || busy || sending}><ShieldCheck size={14} />{busy ? 'Checking…' : 'Verify Wabb API'}</button>}
    </section>
    <div className="wa-wabb-grid">
      <section className="studio-card wa-wabb-compose" aria-labelledby="wabb-compose-title">
        <div className="wa-wabb-section-heading"><span className="wa-brand-icon"><Send size={19} strokeWidth={1.5} /></span><div><span className="wa-wabb-kicker">ONE CLIENT AT A TIME</span><h2 id="wabb-compose-title">Send a personal message</h2></div></div>
        <p className="wa-wabb-intro">Reply to an existing Wabb contact. You can paste a quotation, invoice or client smart link into your message.</p>
        {!ready && <p className="wa-wabb-inline-note"><LockKeyhole size={15} />{preview ? 'Sending is unavailable in the sample preview.' : 'Your studio owner must configure and verify the Wabb API before sending from Studio OS.'}</p>}
        <form onSubmit={send}>
          <fieldset disabled={locked} className="wa-wabb-fields">
            <legend className="wa-wabb-sr-only">Message details and staff confirmations</legend>
            <label className="wa-form-field">Existing Wabb contact number<input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+919876543210" maxLength={35} required aria-describedby="wabb-phone-help" /></label>
            <p id="wabb-phone-help" className="wa-wabb-field-help">Include the country code. The number must already exist in Wabb; no contact is created automatically.</p>
            <label className="wa-form-field">Your message<textarea value={text} onChange={event => setText(event.target.value)} rows={7} maxLength={4096} required placeholder="Hi, here’s your Team Alpha project link…" aria-describedby="wabb-message-help" /></label>
            <div id="wabb-message-help" className="wa-wabb-message-help"><span>Text and links · manual sending only</span><span>{text.length.toLocaleString('en-IN')} / 4,096</span></div>
            <div className="wa-wabb-confirmations"><span className="wa-wabb-kicker">CONFIRM BEFORE SENDING</span>
              <label className="wa-permission-check"><input type="checkbox" checked={permissionConfirmed} onChange={event => setPermissionConfirmed(event.target.checked)} required /><span><strong>I have this client’s permission to message them.</strong><small>Confirm permission already received from the client.</small></span></label>
              <label className="wa-permission-check"><input type="checkbox" checked={replyWindowConfirmed} onChange={event => setReplyWindowConfirmed(event.target.checked)} required /><span><strong>This client messaged the studio within the last 24 hours.</strong><small>This is your confirmation; Studio OS cannot verify the reply window through Wabb.</small></span></label>
            </div>
          </fieldset>
          <p className="wa-wabb-window-note"><Clock3 size={14} /><span>Outside the reply window, use an approved template in Wabb. Wabb and WhatsApp enforce messaging restrictions.</span></p>
          <WorkspaceError error={sendError} />
          <div className="wa-wabb-send-row"><span>{demo ? 'Demo · sending disabled' : ready ? 'Delivered and read receipts are not available here.' : 'API verification required'}</span><button className="studio-button primary" type="submit" disabled={!canSend}><Send size={15} />{sending ? 'Submitting…' : 'Send through Wabb'}</button></div>
        </form>
        {attempt && <div className={'wa-wabb-attempt ' + attempt.status} role="status" aria-live="polite"><div><strong>{wabbAttemptStatus(attempt.status)}</strong><time>{time(attempt.createdAt)}</time></div><p className="wa-wabb-attempt-phone">{attempt.phone}</p><p className="wa-wabb-attempt-text">{attempt.text}</p><p>{attempt.status === 'submitted' ? 'Wabb accepted this request. Delivery and read status are unconfirmed.' : attempt.error || 'This attempt is not yet confirmed. Do not resend it automatically.'}</p>{attempt.status === 'failed' && <button type="button" className="studio-button small" onClick={composeNew} disabled={sending}>Compose a new message</button>}{['unknown', 'sending'].includes(attempt.status) && !sending && <button type="button" className="studio-button small" onClick={composeNew}>I checked Wabb / Business app · compose another</button>}</div>}
      </section>
      <aside className="wa-wabb-sidebar" aria-label="Wabb integration details">
        <section className="studio-card wa-wabb-capabilities"><div className="wa-wabb-section-heading"><span className="wa-brand-icon"><ShieldCheck size={19} strokeWidth={1.5} /></span><div><span className="wa-wabb-kicker">CURRENT CONNECTION</span><h2>Clear about what’s ready.</h2></div></div><p>API verification checks your Wabb access. It does not verify the phone’s live connection or enable a shared inbox.</p><dl><div><dt>Manual text messages</dt><dd>{ready ? <><Check size={13} />API ready</> : 'Verification needed'}</dd></div><div><dt>Inbox & chat history</dt><dd>Not enabled</dd></div><div><dt>Delivery & read receipts</dt><dd>Not enabled</dd></div><div><dt>Template library</dt><dd>Use Wabb</dd></div></dl>{status?.verifiedAt && <p className="wa-wabb-checked">API checked {time(status.verifiedAt)} · {timezone}</p>}{dashboard && <a className="wa-wabb-text-link" href={dashboard} target="_blank" rel="noopener noreferrer">Manage conversations in Wabb <ArrowUpRight size={14} /></a>}</section>
        {!ready && !preview && <section className="studio-card wa-wabb-setup"><LockKeyhole size={21} strokeWidth={1.5} /><h2>Private backend setup</h2><p>Keep your existing Wabb account and number. Configure Wabb settings in the backend hosting environment, then ask your studio owner to verify the API here.</p>{missing.length > 0 && <details><summary>Settings still needed</summary><ul>{missing.map(value => <li key={value}><code>{value}</code></li>)}</ul></details>}<p>API keys stay on the server. Never paste them into a message or a client link.</p></section>}
        <section className="studio-card wa-wabb-enquiries"><FileText size={21} strokeWidth={1.5} /><h2>Bring enquiries into your CRM</h2><p>The existing enquiry integration can receive lead submissions from a Wabb flow. This is separate from WhatsApp chat synchronization.</p><Link className="wa-wabb-text-link" to="/admin/integrations">Enquiry automation setup <ArrowUpRight size={14} /></Link></section>
      </aside>
    </div>
    <p className="wa-page-note">Keep using Wabb and the WhatsApp Business app for conversations and delivery checks. Studio OS sends only when you press Send.</p>
  </div>;
}
