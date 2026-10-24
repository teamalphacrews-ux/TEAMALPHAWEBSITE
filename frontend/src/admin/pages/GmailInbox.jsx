import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Inbox, Mail, Paperclip, RefreshCw, Search, Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { WorkspaceDialog, WorkspaceError, WorkspaceHeader } from '../components/operations/WorkspaceUI';
import { gmailRequest, gmailError, gmailHandoff } from '../components/integrations/gmailApi';
import './integrations.css';

const folders = [{ id: 'inbox', label: 'Inbox' }, { id: 'sent', label: 'Sent' }, { id: 'all', label: 'All mail' }];
const folderIcons = { inbox: <Inbox size={15} />, sent: <Send size={15} />, all: <Mail size={15} /> };
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const steps = { state: 'The connection expired or was opened in another browser. Start again from this page.',
  token: 'Google could not complete the connection. Check the backend Google client settings and try again.',
  permission: 'Approve Gmail read access to view your email here.', profile: 'Enable the Gmail API for this Google project and try connecting again.',
  account: 'Sign in with your saved administrator account and reconnect Gmail.' };

export default function GmailInbox() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const preview = user?.isPreview === true;
  const [status, setStatus] = useState(preview ? { configured: false, connected: false } : null), [statusLoading, setStatusLoading] = useState(!preview), [error, setError] = useState('');
  const [folder, setFolder] = useState('inbox'), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [pages, setPages] = useState(['']), [page, setPage] = useState(0), [listResult, setListResult] = useState({ key: '', data: null, error: '' });
  const [selected, setSelected] = useState(''), [detailResult, setDetailResult] = useState({ key: '', data: null, error: '' });
  const [busy, setBusy] = useState(false), [consent, setConsent] = useState(false), [disconnect, setDisconnect] = useState(false), [refresh, setRefresh] = useState(0);
  const listSequence = useRef(0);
  const loadStatus = useCallback(() => {
    if (preview) return Promise.resolve();
    return gmailRequest('get', '/status').then(result => { if (typeof result?.connected !== 'boolean' || typeof result.configured !== 'boolean') throw new Error(); setStatus(result); setError(''); })
      .catch(err => setError(gmailError(err))).finally(() => setStatusLoading(false));
  }, [preview]);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  const pageToken = pages[page];
  const listKey = JSON.stringify([folder, query, pageToken, refresh, status?.email, status?.connectedAt]);
  const mail = listResult.key === listKey ? listResult.data : null;
  const listError = listResult.key === listKey ? listResult.error : '';
  const loading = status?.connected && listResult.key !== listKey;
  const detailKey = JSON.stringify([selected, status?.email, status?.connectedAt, refresh]);
  const detail = detailResult.key === detailKey ? detailResult.data : null;
  const detailError = detailResult.key === detailKey ? detailResult.error : '';
  const detailLoading = Boolean(selected && detailResult.key !== detailKey);
  useEffect(() => {
    if (!status?.connected || preview) return;
    const controller = new AbortController(), sequence = ++listSequence.current;
    gmailRequest('get', '/messages', { params: { folder, q: query, pageToken }, signal: controller.signal })
      .then(result => { if (!controller.signal.aborted && sequence === listSequence.current) setListResult({ key: listKey, data: result, error: '' }); })
      .catch(err => { if (!controller.signal.aborted && sequence === listSequence.current) setListResult({ key: listKey, data: null, error: gmailError(err) }); });
    return () => controller.abort();
  }, [status?.connected, preview, folder, query, pageToken, refresh, listKey]);
  useEffect(() => {
    if (!selected || !status?.connected) return;
    const controller = new AbortController();
    gmailRequest('get', '/messages/' + encodeURIComponent(selected), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDetailResult({ key: detailKey, data: result, error: '' }); })
      .catch(err => { if (!controller.signal.aborted) setDetailResult({ key: detailKey, data: null, error: gmailError(err) }); });
    return () => controller.abort();
  }, [selected, status?.connected, detailKey]);
  const connect = async () => {
    if (busy || preview) return;
    setBusy(true); setError('');
    try { window.location.assign(gmailHandoff(await gmailRequest('post', '/connect'))); }
    catch (err) { setError(err.response ? gmailError(err) : err.message); setConsent(false); }
    finally { setBusy(false); }
  };
  const removeConnection = async () => {
    setBusy(true); setError('');
    try {
      await gmailRequest('post', '/disconnect');
      listSequence.current++; setListResult({ key: '', data: null, error: '' }); setDetailResult({ key: '', data: null, error: '' }); setSelected(''); setDisconnect(false);
      setStatus(previous => ({ ...previous, connected: false, hasConnection: false, email: '', lastError: '' }));
    } catch (err) { setError(gmailError(err)); }
    finally { setBusy(false); }
  };
  const resetList = () => { setPages(['']); setPage(0); setSelected(''); };
  const chooseFolder = value => { resetList(); setFolder(value); };
  const submitSearch = event => { event.preventDefault(); resetList(); setQuery(search.trim()); setRefresh(value => value + 1); };
  const next = () => { if (mail?.nextPageToken) { setPages(previous => [...previous.slice(0, page + 1), mail.nextPageToken]); setPage(value => value + 1); setSelected(''); } };
  const callbackError = params.get('gmail') === 'error' ? steps[params.get('step')] || 'Gmail authorization was not completed. Connect again when you are ready.' : '';
  return <div className="studio-email-page">
    <WorkspaceHeader eyebrow="YOUR STUDIO, CONNECTED" title="Email" description="Your Gmail account, thoughtfully within reach.">
      <Link className="studio-button" to="/admin/integrations"><ArrowLeft size={15} />Integrations</Link>
      {status?.hasConnection ? <><button className="studio-button" onClick={() => setConsent(true)} disabled={busy || !status.configured}>Reconnect Gmail</button><button className="studio-button" onClick={() => setDisconnect(true)} disabled={busy}>Disconnect</button></>
        : <button className="studio-button primary" onClick={() => setConsent(true)} disabled={preview || statusLoading || !status?.configured || busy}><Mail size={15} />Connect Gmail</button>}
    </WorkspaceHeader>
    <WorkspaceError error={error || listError || callbackError} retry={error || listError ? () => { setError(''); loadStatus(); setRefresh(value => value + 1); } : undefined} />
    {status?.lastError && <WorkspaceError error={status.lastError} />}
    {preview ? <p className="workspace-info">Gmail connects from the live Studio OS with your saved administrator account. This sample preview cannot access email.</p>
      : !statusLoading && !status?.configured && <p className="workspace-info">{status?.setupMessage || 'Gmail setup is incomplete. Ask your studio administrator to finish the backend connection settings.'}</p>}
    {params.get('gmail') === 'connected' && status?.connected && <p className="workspace-info" role="status">Gmail is connected. Your mailbox is visible only to your administrator account.</p>}
    {status?.connected ? <section className="studio-card studio-email-workspace">
      <div className="studio-email-toolbar"><div className="studio-email-account"><Mail size={18} /><div><strong>{status.email}</strong><small>Read access · Emails remain in Gmail</small></div></div><button className="studio-icon-button" aria-label="Refresh email" onClick={() => setRefresh(value => value + 1)} disabled={loading}><RefreshCw size={16} /></button></div>
      <div className="studio-email-controls"><nav aria-label="Email folders">{folders.map(({ id, label }) => <button key={id} className={folder === id ? 'selected' : ''} aria-current={folder === id ? 'page' : undefined} onClick={() => chooseFolder(id)}>{folderIcons[id]}{label}</button>)}</nav>
        <form className="studio-email-search" onSubmit={submitSearch}><Search size={16} /><input aria-label="Search Gmail" value={search} onChange={event => setSearch(event.target.value)} maxLength={500} placeholder="Search email…" /><button className="studio-button small" type="submit">Search</button></form></div>
      <div className={'studio-email-columns' + (selected ? ' has-selection' : '')}>
        <div className="studio-email-list" aria-label="Email messages" aria-busy={loading}>
          {loading ? <p className="studio-email-empty" role="status">Loading your email…</p> : mail?.messages?.length ? mail.messages.map(message => <button key={message.id} className={'studio-email-row' + (selected === message.id ? ' selected' : '') + (message.unread ? ' unread' : '')} onClick={() => setSelected(message.id)} aria-pressed={selected === message.id}>
            <span className="studio-email-row-top"><strong>{folder === 'sent' ? message.to || message.from : message.from || 'Unknown sender'}</strong><time>{date(message.receivedAt || message.date)}</time></span><span className="studio-email-subject">{message.subject}</span><span className="studio-email-snippet">{message.snippet}</span></button>)
            : <p className="studio-email-empty">{listError ? 'Email is unavailable. Please retry.' : query ? 'No messages match your search in this folder.' : 'No messages in this folder.'}</p>}
          <div className="studio-email-pagination"><button className="studio-button small" disabled={loading || page === 0} onClick={() => { setPage(value => value - 1); setSelected(''); }}><ChevronLeft size={14} />Previous</button><span>Page {page + 1}</span><button className="studio-button small" disabled={loading || !mail?.nextPageToken} onClick={next}>Next<ChevronRight size={14} /></button></div>
        </div>
        <article className="studio-email-detail" aria-label="Selected email" aria-busy={detailLoading}>
          {selected && <button className="studio-email-back studio-button small" onClick={() => setSelected('')}><ChevronLeft size={14} />Back to email</button>}
          {detailLoading ? <p className="studio-email-empty" role="status">Opening email…</p> : detailError ? <WorkspaceError error={detailError} retry={() => setRefresh(value => value + 1)} /> : detail && selected ? <>
            <div className="studio-email-detail-heading"><h2>{detail.subject}</h2><a className="studio-button small" href={detail.gmailUrl} target="_blank" rel="noopener noreferrer">Open in Gmail<ArrowUpRight size={14} /></a></div>
            <dl><div><dt>From</dt><dd>{detail.from}</dd></div><div><dt>To</dt><dd>{detail.to}</dd></div>{detail.cc && <div><dt>Cc</dt><dd>{detail.cc}</dd></div>}<div><dt>Date</dt><dd>{detail.date || date(detail.receivedAt)}</dd></div></dl>
            <div className="studio-email-body">{detail.body || detail.snippet || 'This message has no plain text preview.'}</div>
            {detail.truncated && <p className="studio-muted">The preview is shortened. Open Gmail to read the complete message.</p>}
            {!detail.body && <p className="studio-muted">Open Gmail to see the original formatting and complete content.</p>}
            {!!detail.attachments?.length && <div className="studio-email-attachments"><h3>Attachments</h3>{detail.attachments.map((item, index) => <p key={index}><Paperclip size={14} /><span>{item.name}</span><small>{Math.ceil(item.size / 1024)} KB</small></p>)}<p className="studio-muted">Attachments are available in the original Gmail message.</p></div>}
          </> : <div className="studio-email-empty"><Mail size={30} /><h2>A little space to read.</h2><p>Select an email to view it here.</p></div>}
        </article>
      </div><p className="studio-email-footnote">Opening a message here does not mark it as read or change it in Gmail. All mail includes archived messages and excludes Spam and Trash.</p>
    </section> : <section className="studio-card studio-email-welcome"><Mail size={34} /><h2>Your conversations, in one place.</h2><p>Connect Gmail to browse your inbox, sent messages and archived email. Search and read messages without changing your mailbox.</p><small>{statusLoading ? 'Checking your connection…' : 'Read-only access. Private to your administrator account.'}</small></section>}
    {consent && <WorkspaceDialog title="Connect your Gmail account" onClose={() => !busy && setConsent(false)} busy={busy} footer={<><button className="studio-button" disabled={busy} onClick={() => setConsent(false)}><X size={14} />Cancel</button><button className="studio-button primary" disabled={busy} onClick={connect}>{busy ? 'Connecting…' : 'Continue to Google'}</button></>}>
      <p>Google will ask permission to read your Gmail messages and settings. Studio OS uses this to show your inbox, sent mail, search results and message previews.</p><p>Mail is fetched when you open this page and is not copied into the studio database. Your encrypted connection belongs to your administrator account.</p><p>You can disconnect at any time. Calendar has its own connection.</p>
    </WorkspaceDialog>}
    {disconnect && <WorkspaceDialog title="Disconnect Gmail?" onClose={() => !busy && setDisconnect(false)} busy={busy} footer={<><button className="studio-button" disabled={busy} onClick={() => setDisconnect(false)}>Keep connected</button><button className="studio-button primary" disabled={busy} onClick={removeConnection}>{busy ? 'Disconnecting…' : 'Disconnect Gmail'}</button></>}><p>This removes your saved Gmail connection from Studio OS. Your emails and your Calendar connection remain unchanged.</p></WorkspaceDialog>}
  </div>;
}
