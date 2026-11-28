import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, Cloud, Copy, FileText, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import API from '../../../utils/apiConfig';
import { assertWorkspaceContext, captureWorkspaceContext } from '../../../native/nativeCapabilities';
import StudioButton from '../common/StudioButton';
import StudioSelect from '../common/StudioSelect';
import { OperationsModal } from '../operations/OperationsUI';
import IntegrationLogo from './IntegrationLogo';
import { driveConnectionHandoff } from './connectionHandoff';
import './assistantConnections.css';

const providers = [
  { id: 'openai', name: 'ChatGPT', detail: 'Powered by the OpenAI API', keys: ['OPENAI_API_KEY', 'OPENAI_MODEL'], url: 'https://developers.openai.com/api/docs/quickstart', note: 'Uses API access configured for your studio. Signing in to ChatGPT does not connect this workspace.' },
  { id: 'claude', name: 'Claude', detail: 'Powered by the Anthropic API', keys: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'], url: 'https://platform.claude.com/docs/en/api/messages', note: 'Use a Claude API key and a model available to that API account. Keep the key in your backend’s private settings.' },
  { id: 'openclaw', name: 'OpenClaw', detail: 'Your private assistant gateway', keys: ['OPENCLAW_GATEWAY_URL', 'OPENCLAW_GATEWAY_TOKEN', 'OPENCLAW_PRIVATE_GATEWAY_CONFIRMED'], url: 'https://docs.openclaw.ai/gateway/openai-http-api', note: 'Connect an existing private gateway. This first version checks the connection; OpenClaw drafting stays unavailable until a restricted drafting agent is verified. The server operator must confirm the private gateway configuration.' },
];
const tasks = [
  { id: 'reply', title: 'Client reply', hint: 'Paste the client’s question and the facts you want included. Omit private details you do not need to share.', placeholder: 'The client asked about delivery. Photo selection is complete; editing is in progress. We will confirm the delivery date after review.' },
  { id: 'quotation', title: 'Quotation wording', hint: 'Include confirmed coverage, deliverables, prices and terms. The assistant writes wording; it does not create or change a quotation.', placeholder: 'Wedding coverage: photography and cinematography, 2 days. Include an album. Use only these agreed inclusions and leave unconfirmed prices blank.' },
  { id: 'project-update', title: 'Project update', hint: 'Describe the current stage, completed work and the next confirmed step.', placeholder: 'Photo editing is complete. Album design is in progress. Next step: share the first album layout for client review.' },
];
const assistantModel = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const assistantApi = '/api/integrations/assistants';
const draftLimit = 12000;

function useConnectionRequest(token) {
  const controllers = useRef(new Set());
  useEffect(() => () => { controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); }, [token]);
  return useCallback(async (path, body, method = body === undefined ? 'get' : 'post') => {
    const context = captureWorkspaceContext(), controller = new AbortController();
    controllers.current.add(controller);
    try {
      const result = await axios({ url: API + path, method, data: body, timeout: 45000, signal: controller.signal, headers: { Authorization: 'Bearer ' + token } });
      assertWorkspaceContext(context);
      return result.data;
    } finally { controllers.current.delete(controller); }
  }, [token]);
}
const messageFor = error => {
  if (error?.response?.status === 409 && error?.response?.data?.code === 'SAAS_INTEGRATION_PENDING') return 'These connections are not available for commercial workspaces yet.';
  const message = error?.response?.data?.message || error?.response?.data?.error;
  return typeof message === 'string' ? message : error?.code === 'ECONNABORTED' ? 'The service did not respond in time. Try again shortly.' : 'The connection could not be checked. Please try again.';
};

function AssistantConnectionDialog({ dialog, busy, error, onClose, onSave, onDisconnect }) {
  const formId = useId(), keyInput = useRef(null), modelInput = useRef(null);
  const { provider, model, disconnect } = dialog;
  const submit = event => {
    event.preventDefault();
    const key = keyInput.current.value.trim(), model = modelInput.current.value.trim();
    keyInput.current.value = '';
    onSave(provider.id, key, model);
  };
  return <OperationsModal
    title={`${disconnect ? 'Disconnect' : model ? 'Update' : 'Connect'} ${provider.name}`}
    onClose={onClose} busy={busy}
    footer={<>
      <StudioButton type="button" onClick={onClose} disabled={busy}>Cancel</StudioButton>
      {disconnect
        ? <StudioButton type="button" variant="destructive" onClick={() => onDisconnect(provider.id)} loading={busy}>Disconnect {provider.name}</StudioButton>
        : <StudioButton type="submit" form={formId} variant="primary" loading={busy}>Save connection</StudioButton>}
    </>}
  >
    {error && <p className="connections-notice is-error" role="alert">{error}</p>}
    {disconnect ? <p className="assistant-connection-copy">This removes the API key from this studio and stops new {provider.name} drafts. You can reconnect later.</p> :
      <form id={formId} onSubmit={submit} className="assistant-credential-form" autoComplete="off">
        <p className="assistant-connection-copy">Use an API key and a model ID from your provider account. API usage may be billed separately from your chat subscription.</p>
        <label className="studio-field">{provider.name} API key
          <input ref={keyInput} className="studio-input" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={8} maxLength={4096} disabled={busy} />
          <small>{model ? 'Enter a new key to update this connection.' : 'The key is encrypted for this studio when saved.'}</small>
        </label>
        <label className="studio-field">Model ID
          <input ref={modelInput} className="studio-input" type="text" defaultValue={model || ''} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={120} disabled={busy} />
          <small>Enter the exact ID of a model your API account can use.</small>
        </label>
        <a className="assistant-provider-docs" href={provider.url} target="_blank" rel="noopener noreferrer">{provider.name} API documentation <ArrowUpRight size={14} aria-hidden="true" /></a>
      </form>}
  </OperationsModal>;
}

function connectionError(error) {
  const code = error?.response?.status;
  if (code === 400) return 'Enter a valid API key and model ID, then try again.';
  if (code === 401 || code === 403) return 'Sign in as the studio owner and try again.';
  if (code === 409 || code === 503) return 'The connection cannot be changed right now. Refresh its status and try again.';
  return 'The connection change could not be confirmed. Refresh its status and try again.';
}

export default function AssistantConnections() {
  const { user, token, loading, sessionError } = useAuth();
  const sessionVerified = Boolean(token && !loading && !sessionError);
  const identity = [user?._id || user?.id, user?.workspace?._id || user?.workspace?.id || 'personal', user?.workspaceRole, token, sessionVerified].join(':');
  return <AssistantWorkspace key={identity} user={user} token={token} sessionVerified={sessionVerified} />;
}
function AssistantWorkspace({ user, token, sessionVerified }) {
  const preview = user?.isPreview === true;
  const commercial = IS_COMMERCIAL_DEPLOYMENT || Boolean(user?.workspace);
  const owner = commercial ? Boolean((user?.workspace?.id || user?.workspace?._id) && user.workspace.role === 'owner' && user.workspaceRole === 'owner') : user?.studioOwner === true || user?.owner === true;
  const enabled = owner && !preview && sessionVerified;
  const availableProviders = commercial ? providers.filter(item => item.id !== 'openclaw') : providers;
  const call = useConnectionRequest(token);
  const [status, setStatus] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(enabled);
  const [dialog, setDialog] = useState(null), [setupError, setSetupError] = useState('');
  const [busy, setBusy] = useState(''), [verified, setVerified] = useState({}), [testErrors, setTestErrors] = useState({});
  const [provider, setProvider] = useState('openai'), [task, setTask] = useState('reply'), [tone, setTone] = useState('professional');
  const [context, setContext] = useState(''), [consent, setConsent] = useState(false), [result, setResult] = useState(null), [copied, setCopied] = useState(false);
  const lock = useRef(false), output = useRef(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError(''); setConsent(false); setVerified({}); setTestErrors({});
    try { const data = await call(assistantApi + '/status'); if (!Array.isArray(data?.providers)) throw new Error(); if (mounted.current) setStatus(data); }
    catch (failure) { if (mounted.current && !axios.isCancel(failure)) { setStatus(null); setError(messageFor(failure)); } }
    finally { if (mounted.current) setLoading(false); }
  }, [call]);
  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);
  const selected = availableProviders.find(item => item.id === provider), purpose = tasks.find(item => item.id === task);
  const providerStatus = id => status?.providers?.find(item => item.id === id);
  const active = enabled && !loading && status?.preview !== true && (!commercial || status?.connectionStorageAvailable === true);
  const canManage = commercial && active;
  const ready = active && providerStatus(provider)?.configured === true && providerStatus(provider)?.draftSupported !== false && provider !== 'openclaw';
  const openDialog = (provider, disconnect = false) => {
    if (!canManage || lock.current) return;
    setSetupError('');
    setDialog({ provider, model: providerStatus(provider.id)?.model || '', disconnect });
  };
  const updateConnection = async (id, body) => {
    if (!canManage || lock.current) return;
    if (body && (!assistantModel.test(body.model) || body.model.includes(body.apiKey) || body.apiKey.length < 8 || /\s/.test(body.apiKey))) {
      setSetupError('Enter a valid API key and model ID, then try again.');
      return;
    }
    lock.current = true; setBusy('connection'); setSetupError('');
    try {
      const row = await call(`${assistantApi}/${id}/connection`, body, body ? 'post' : 'delete');
      if (row?.id !== id || row.configured !== Boolean(body) || (body && row.model !== body.model)) throw new Error();
      if (mounted.current) {
        setStatus(previous => ({ ...previous, providers: previous.providers.map(current => current.id === id ? row : current) }));
        setVerified(previous => ({ ...previous, [id]: '' }));
        setTestErrors(previous => ({ ...previous, [id]: '' }));
        setDialog(null); setConsent(false);
      }
    } catch (failure) {
      if (mounted.current && !axios.isCancel(failure)) setSetupError(connectionError(failure));
    } finally { lock.current = false; if (mounted.current) setBusy(''); }
  };
  const test = async id => {
    if (!active || !providerStatus(id)?.configured || lock.current) return;
    lock.current = true; setBusy(id); setTestErrors(value => ({ ...value, [id]: '' }));
    try { const data = await call(`${assistantApi}/${id}/test`, {}); if (typeof data?.message !== 'string') throw new Error(); if (mounted.current) setVerified(value => ({ ...value, [id]: data.message })); }
    catch (failure) { if (mounted.current && !axios.isCancel(failure)) { setVerified(value => ({ ...value, [id]: '' })); setTestErrors(value => ({ ...value, [id]: messageFor(failure) })); } }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  };
  const generate = async event => {
    event.preventDefault(); if (lock.current || !ready || !consent || context.trim().length < 10) return;
    lock.current = true; setBusy('draft'); setError(''); setCopied(false);
    try {
      const data = await call(`${assistantApi}/${provider}/draft`, { task, tone, context: context.trim(), consent: true });
      if (typeof data?.draft !== 'string' || !data.draft.trim()) throw new Error();
      if (mounted.current) { setResult({ text: data.draft, provider: selected.name, model: data.model }); requestAnimationFrame(() => output.current?.focus()); }
    } catch (failure) { if (mounted.current && !axios.isCancel(failure)) setError(messageFor(failure)); }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  };
  return <section className="assistant-connections" id="assistants" aria-labelledby="assistant-title" tabIndex={-1}>
    <header className="connections-section-heading"><div><span className="connections-eyebrow">Writing assistants</span><h2 id="assistant-title">A clearer message. A little less admin.</h2><p>Draft client replies, quotation wording and project updates, then review every word.</p></div>{enabled && <StudioButton type="button" icon={RefreshCw} size="sm" onClick={refresh} disabled={loading || Boolean(busy)} loading={loading}>Refresh status</StudioButton>}</header>
    {(preview || !owner || !sessionVerified || status?.preview || (enabled && commercial && status && !status.connectionStorageAvailable)) && <p className="connections-notice" role="note"><ShieldCheck size={18} aria-hidden="true" />{preview || status?.preview ? 'Preview only. Connections and AI requests are disabled for sample records.' : !owner ? 'The studio owner manages assistant connections and API usage.' : !sessionVerified ? 'Reconnect to your studio to manage assistant connections.' : 'Secure key storage is unavailable. Contact your Studio X OS administrator to enable assistant setup.'}</p>}
    {commercial && enabled && !status?.preview && <p className="assistant-connection-copy">Connect your own API account. Testing sends a sample prompt, and API usage may be billed by your provider.</p>}
    <div className="assistant-provider-list">{availableProviders.map(item => {
      const row = providerStatus(item.id), checked = verified[item.id];
      const label = preview || status?.preview ? 'Preview' : !owner ? 'Owner setup' : loading ? 'Checking…' : !status ? 'Unavailable' : commercial && !canManage ? 'Setup unavailable' : checked ? 'Verified this session' : row?.configured ? 'Configured' : 'Setup needed';
      return <article className="assistant-provider" key={item.id}>
        <div className="assistant-provider-heading">
          <IntegrationLogo brand={item.id} size={38} />
          <div><h3>{item.name}</h3><p>{item.detail}</p>{row?.configured && row.model && <small className="assistant-model">Model {row.model}</small>}</div>
          <span className={'connection-status' + (checked ? ' is-verified' : '')} role="status">{label}</span>
        </div>
        {(active && row?.configured || canManage || !commercial) && <div className="assistant-provider-actions" data-api-setup={commercial || undefined}>
          {canManage && <StudioButton type="button" size="sm" onClick={() => openDialog(item)} disabled={Boolean(busy)}>{row?.configured ? `Update ${item.name}` : `Connect ${item.name}`}</StudioButton>}
          {!commercial && <details><summary>Setup details <ChevronDown size={15} aria-hidden="true" /></summary><div className="assistant-setup"><p>{item.note}</p><p>Add these values in the backend’s private environment settings and restart the service:</p><ul>{item.keys.map(key => <li key={key}><code>{key}</code></li>)}</ul><p>Select a supported model for your API account. API usage may be billed by the provider.</p><a href={item.url} target="_blank" rel="noopener noreferrer">Provider documentation <ArrowUpRight size={14} aria-hidden="true" /></a></div></details>}
          {(!commercial || row?.configured) && <StudioButton type="button" size="sm" onClick={() => test(item.id)} disabled={!active || !row?.configured || Boolean(busy)} loading={busy === item.id} icon={ShieldCheck}>Test connection</StudioButton>}
          {canManage && row?.configured && <StudioButton type="button" variant="ghost" size="sm" onClick={() => openDialog(item, true)} disabled={Boolean(busy)}>Disconnect {item.name}</StudioButton>}
        </div>}
        {(checked || testErrors[item.id]) && <p className={'connection-feedback' + (testErrors[item.id] ? ' is-error' : '')} role={testErrors[item.id] ? 'alert' : 'status'}>{testErrors[item.id] || checked}</p>}
      </article>;
    })}</div>
    {canManage && dialog && <AssistantConnectionDialog dialog={dialog} busy={busy === 'connection'} error={setupError}
      onClose={() => setDialog(null)} onSave={(id, apiKey, model) => updateConnection(id, { apiKey, model })} onDisconnect={id => updateConnection(id)} />}
    <div className="assistant-draft-workspace"><div className="assistant-draft-intro"><FileText size={20} /><div><h3>Draft with your assistant</h3><p>Only the text you enter below is sent. Your studio records are not attached automatically.</p></div></div>
      <form onSubmit={generate} className="assistant-draft-form">
        <div className="assistant-draft-options"><label><span>Assistant</span><StudioSelect title="Assistant" className="studio-input" value={provider} disabled={!active || Boolean(busy)} onChange={event => { setProvider(event.target.value); setConsent(false); }}>{availableProviders.map(item => <option key={item.id} value={item.id} disabled={item.id === 'openclaw'}>{item.name}{item.id === 'openclaw' ? ' — connection only' : ''}</option>)}</StudioSelect></label><label><span>Write a</span><StudioSelect title="Draft type" className="studio-input" value={task} disabled={!active || Boolean(busy)} onChange={event => { setTask(event.target.value); setConsent(false); }}>{tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</StudioSelect></label><label><span>Tone</span><StudioSelect title="Writing tone" className="studio-input" value={tone} disabled={!active || Boolean(busy)} onChange={event => { setTone(event.target.value); setConsent(false); }}><option value="professional">Professional</option><option value="warm">Warm</option><option value="concise">Concise</option></StudioSelect></label></div>
        <label className="assistant-context"><span>What should it include?</span><textarea className="studio-input" value={context} disabled={!active || Boolean(busy)} minLength={10} maxLength={draftLimit} required rows={5} placeholder={purpose.placeholder} aria-describedby="assistant-context-help" onChange={event => { setContext(event.target.value); setConsent(false); }} /><small id="assistant-context-help">{purpose.hint} · {context.length.toLocaleString()} / {draftLimit.toLocaleString()}</small></label>
        <label className="assistant-consent"><input type="checkbox" checked={consent} disabled={!ready || Boolean(busy)} onChange={event => setConsent(event.target.checked)} /><span>Send this text to {selected.name} to generate a draft. I have reviewed the details I’m sharing.</span></label>
        <div className="assistant-draft-footer"><p>{preview ? 'This sample preview does not connect to providers or generate drafts.' : !ready ? 'Connect and configure an assistant above to enable drafting.' : 'Review the result before using it. No messages or documents are sent.'}</p><StudioButton type="submit" variant="primary" icon={Sparkles} loading={busy === 'draft'} disabled={!ready || !consent || context.trim().length < 10 || Boolean(busy)} loadingLabel="Generating your draft">Generate draft</StudioButton></div>
      </form>
      {error && <p className="connections-notice is-error" role="alert">{error}{!status && enabled && <StudioButton type="button" size="sm" onClick={refresh} disabled={loading}>Retry</StudioButton>}</p>}
      {result && <section className="assistant-result" ref={output} tabIndex={-1} aria-label="Generated draft"><div><h4>Your draft</h4><span>{result.provider}{result.model ? ' · ' + result.model : ''}</span></div><textarea className="studio-input" aria-label="Review and edit generated draft" rows={9} value={result.text} onChange={event => { setResult(value => ({ ...value, text: event.target.value })); setCopied(false); }} /><footer><small>Check facts, prices and commitments before sending.</small><StudioButton type="button" size="sm" icon={copied ? Check : Copy} onClick={async () => { try { await navigator.clipboard.writeText(result.text); setCopied(true); } catch { setError('Copy is unavailable here. Select the draft text and copy it manually.'); } }}>{copied ? 'Copied' : 'Copy draft'}</StudioButton><StudioButton type="button" size="sm" variant="ghost" onClick={() => { setResult(null); setContext(''); setConsent(false); }}>Clear draft</StudioButton></footer></section>}
    </div>
  </section>;
}

export function DriveBackupConnection() {
  const { user, token } = useAuth();
  return <DriveConnection key={[user?._id || user?.id, token].join(':')} user={user} token={token} />;
}
function DriveConnection({ user, token }) {
  const preview = user?.isPreview === true, enabled = (user?.studioOwner === true || user?.owner === true) && !preview && !user?.workspace;
  const call = useConnectionRequest(token);
  const [status, setStatus] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const mounted = useRef(true), lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!enabled) return; let active = true; call('/api/integrations/drive-backups/status').then(data => { if (typeof data?.connected !== 'boolean') throw new Error(); if (active) { setStatus(data); setError(''); } }).catch(failure => { if (active && !axios.isCancel(failure)) setError(messageFor(failure)); }); return () => { active = false; }; }, [call, enabled, retry]);
  const connect = async () => {
    if (lock.current || !enabled) return; lock.current = true; setBusy(true); setError('');
    try { const data = await call('/api/integrations/drive-backups/connect', {}); const url = driveConnectionHandoff(data, API, window.location.origin); if (mounted.current) window.location.assign(url); }
    catch (failure) { if (mounted.current && !axios.isCancel(failure)) setError(messageFor(failure)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <section className="drive-connection" id="drive" aria-labelledby="drive-connection-title" tabIndex={-1}><div className="drive-connection-main"><IntegrationLogo brand="drive" size={38} /><div><h2 id="drive-connection-title">Google Drive</h2><p>Keep an encrypted recovery copy of your studio in your own Drive.</p><small>{preview ? 'Preview only. No Google account is connected.' : !enabled ? 'The studio owner manages Drive backups.' : status?.connected ? status.email : status?.message || 'Uses the existing Studio OS backup connection. Access is limited to files created by this integration.'}</small></div><span className={'connection-status' + (status?.connected ? ' is-verified' : '')}>{preview ? 'Preview' : !enabled ? 'Owner setup' : status?.connected ? 'Connected' : status?.configured ? 'Not connected' : status ? 'Setup needed' : error ? 'Unavailable' : 'Checking…'}</span></div><div className="drive-connection-actions">{enabled && status?.configured && !status.connected && <StudioButton type="button" icon={Cloud} loading={busy} onClick={connect}>Connect Google Drive</StudioButton>}<Link className="studio-button" to="/admin/settings?section=backups">{status?.connected ? 'Manage backups' : 'Backup settings'}<ArrowUpRight size={16} /></Link>{error && <StudioButton type="button" size="sm" icon={RefreshCw} onClick={() => setRetry(value => value + 1)}>Retry status</StudioButton>}</div>{error && <p className="connection-feedback is-error" role="alert">{error}</p>}</section>;
}
