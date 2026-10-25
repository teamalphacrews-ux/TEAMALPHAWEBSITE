import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronLeft, Copy, FileText, Link2, LockKeyhole, MessageCircle, Plus, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudioIdentity } from '../../utils/studioIdentity';
import { studioTimezone } from '../../utils/studioTime';
import { recordDestination } from '../../utils/studioNavigation';
import API from '../../utils/apiConfig';
import { approvedTemplateDraft, confirmedWhatsAppSubmission, internationalWhatsAppPhone, mergeWhatsAppMessages, openWhatsAppUrl, refreshWhatsAppMessages, whatsappConnectionLabel, whatsappMessageStatus, whatsappReplyWindow, whatsappRequestId } from '../../utils/whatsappData';
import { WorkspaceDialog, WorkspaceError, WorkspaceHeader } from '../components/operations/WorkspaceUI';
import './whatsappInbox.css';

const base = '/api/integrations/whatsapp';
const request = async (method, path, data, options = {}) => (await axios({ method, url: API + base + path, data, timeout: 90000, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, ...options })).data;
const errorText = error => typeof error?.response?.data?.error === 'string' ? error.response.data.error : 'WhatsApp is temporarily unavailable. Please try again.';
const validConversation = value => value && typeof value.id === 'string' && typeof value.phone === 'string';
const replaceConversation = (list, next) => validConversation(next) ? [next, ...list.filter(item => item.id !== next.id)].sort((a, b) => (Date.parse(b.lastMessageAt) || 0) - (Date.parse(a.lastMessageAt) || 0)) : list;
const avatar = value => String(value || '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'WA';
const templateKey = template => template.name + ':' + template.language;
const draftDefault = () => ({ text: '', mode: 'text', template: '', parameters: [] });
const emptyMessages = [];
const sourceName = type => type === 'contact' ? 'client contact' : 'enquiry';
const safeWebhook = value => { try { const u = new URL(value); return !u.username && !u.password && !u.search && !u.hash && u.pathname === base + '/webhook' && ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = /^[a-f\d]{24}$/i.test(params.get('conversation') || '') ? params.get('conversation') : '';
  const { identity } = useStudioIdentity();
  const timezone = studioTimezone(identity?.timezone);
  const preview = user?.isPreview === true;
  const [status, setStatus] = useState(null), [statusError, setStatusError] = useState(''), [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [listResult, setListResult] = useState({ key: '', rows: [], nextCursor: null, error: '' });
  const [detailResult, setDetailResult] = useState({ key: '', data: null, error: '' });
  const [templateResult, setTemplateResult] = useState({ key: '', templates: [], error: '' }), [templateRefresh, setTemplateRefresh] = useState(0);
  const [drafts, setDrafts] = useState({}), [uncertain, setUncertain] = useState({}), [failedAttempts, setFailedAttempts] = useState({}), [clock, setClock] = useState(Date.now);
  const [busy, setBusy] = useState(''), [moreBusy, setMoreBusy] = useState(false), [historyBusy, setHistoryBusy] = useState(false), [sendError, setSendError] = useState({ id: '', text: '' });
  const [modal, setModal] = useState(''), [modalError, setModalError] = useState(''), [newPhone, setNewPhone] = useState(''), [newName, setNewName] = useState('');
  const [recordType, setRecordType] = useState('contact'), [recordId, setRecordId] = useState(''), [recordSearch, setRecordSearch] = useState(''), [records, setRecords] = useState(null);
  const [consentSource, setConsentSource] = useState(''), [consentChecked, setConsentChecked] = useState(false), [copied, setCopied] = useState(false);
  const mounted = useRef(true), listGeneration = useRef(0), detailGeneration = useRef(0), claims = useRef(new Map()), listRef = useRef(null), stickToLatest = useRef(true), currentAccount = useRef('');
  const connected = !preview && status?.connected === true && !statusError;
  const listKey = JSON.stringify([query, status?.displayPhoneNumber, status?.verifiedAt]);
  const accountKey = JSON.stringify([status?.displayPhoneNumber, status?.verifiedAt]);
  const detailKey = JSON.stringify([selected, accountKey]);
  const rows = listResult.key === listKey ? listResult.rows : [];
  const listError = listResult.key === listKey ? listResult.error : '';
  const detail = detailResult.key === detailKey ? detailResult.data : null;
  const conversation = detail?.conversation;
  const messages = detail?.messages || emptyMessages;
  const draft = drafts[selected] || draftDefault();
  const replyOpen = whatsappReplyWindow(conversation, clock);
  const mode = replyOpen ? draft.mode : 'template';
  const templates = templateResult.key === String(status?.verifiedAt || '') ? templateResult.templates : [];
  const chosenTemplate = templates.find(item => templateKey(item) === draft.template);
  const templateDraft = approvedTemplateDraft(chosenTemplate, draft.parameters);
  const canSend = connected && conversation && !uncertain[selected] && !busy && (mode === 'text' ? replyOpen && draft.text.trim().length > 0 : templateDraft.valid && (replyOpen || conversation.optIn?.confirmed === true));
  const webhook = safeWebhook(status?.webhookUrl);
  const date = (value, short = false) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('en-IN', { timeZone: timezone, ...(short ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }).format(new Date(value)) : '';

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { currentAccount.current = accountKey; }, [accountKey]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    request('get', '/status', undefined, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { if (typeof result?.connected !== 'boolean' || typeof result.configured !== 'boolean') throw new Error(); setStatus(result); setStatusError(''); }
    }).catch(error => { if (!controller.signal.aborted) setStatusError(errorText(error)); });
    return () => controller.abort();
  }, [preview, refresh]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController(), generation = ++listGeneration.current;
    let running = false;
    const load = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const result = await request('get', '/conversations', undefined, { signal: controller.signal, params: { q: query } });
        if (!Array.isArray(result?.conversations)) throw new Error();
        if (!controller.signal.aborted && generation === listGeneration.current) setListResult(previous => {
          const current = previous.key === listKey ? previous : null;
          let combined = current?.rows || [];
          for (const row of result.conversations.filter(validConversation)) combined = replaceConversation(combined, row);
          return { key: listKey, rows: combined.slice(0, 300), nextCursor: current?.loadedMore ? current.nextCursor : result.nextCursor || null, loadedMore: current?.loadedMore || false, error: '' };
        });
      } catch (error) { if (!controller.signal.aborted && generation === listGeneration.current) setListResult(previous => ({ key: listKey, rows: previous.key === listKey ? previous.rows : [], nextCursor: previous.key === listKey ? previous.nextCursor : null, error: errorText(error) })); }
      finally { running = false; }
    };
    load();
    const timer = setInterval(load, 15000);
    document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [connected, query, listKey, refresh]);
  useEffect(() => {
    if (!connected || !selected) return;
    const controller = new AbortController(), generation = ++detailGeneration.current;
    let running = false;
    const load = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const requestedAt = Date.now();
        const result = await request('get', '/conversations/' + encodeURIComponent(selected), undefined, { signal: controller.signal });
        if (!validConversation(result?.conversation) || !Array.isArray(result.messages)) throw new Error();
        if (!controller.signal.aborted && generation === detailGeneration.current) {
          setDetailResult(previous => ({ key: detailKey, data: { ...result, messages: refreshWhatsAppMessages(previous.key === detailKey ? previous.data?.messages : [], result.messages, { hasEarlier: !!result.nextCursor, requestedAt }), nextCursor: previous.key === detailKey && previous.data?.loadedEarlier ? previous.data.nextCursor : result.nextCursor, loadedEarlier: previous.key === detailKey && previous.data?.loadedEarlier }, error: '' }));
          setListResult(previous => ({ ...previous, rows: replaceConversation(previous.rows, result.conversation) }));
          if (result.conversation.unread) request('post', '/conversations/' + encodeURIComponent(selected) + '/read', {}).then(() => {
            if (!controller.signal.aborted) setListResult(previous => ({ ...previous, rows: previous.rows.map(row => row.id === selected ? { ...row, unread: false } : row) }));
          }).catch(() => {});
        }
      } catch (error) { if (!controller.signal.aborted && generation === detailGeneration.current) setDetailResult(previous => ({ key: detailKey, data: previous.key === detailKey ? previous.data : null, error: errorText(error) })); }
      finally { running = false; }
    };
    load(); const timer = setInterval(load, 10000); document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [connected, selected, refresh, detailKey]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController(), key = String(status?.verifiedAt || '');
    request('get', '/templates', undefined, { signal: controller.signal }).then(result => {
      if (!Array.isArray(result?.templates)) throw new Error();
      if (!controller.signal.aborted) setTemplateResult({ key, templates: result.templates, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setTemplateResult({ key, templates: [], error: errorText(error) }); });
    return () => controller.abort();
  }, [connected, status?.verifiedAt, templateRefresh]);
  useEffect(() => {
    if (stickToLatest.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [selected, messages]);
  useEffect(() => {
    if (modal !== 'link' || preview) return;
    const controller = new AbortController();
    Promise.all(['/api/contacts', '/api/leads'].map(path => axios.get(API + path, { signal: controller.signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }))).then(([contacts, enquiries]) => {
      if (!Array.isArray(contacts.data) || !Array.isArray(enquiries.data)) throw new Error();
      if (!controller.signal.aborted) setRecords({ contacts: contacts.data, enquiries: enquiries.data });
    }).catch(error => { if (!controller.signal.aborted) setModalError(errorText(error)); });
    return () => controller.abort();
  }, [modal, preview]);
  const chooseConversation = id => { const next = new URLSearchParams(params); if (id) next.set('conversation', id); else next.delete('conversation'); stickToLatest.current = true; setParams(next); setSendError({ id: '', text: '' }); };
  const updateDraft = patch => { if (selected) setDrafts(previous => ({ ...previous, [selected]: { ...(previous[selected] || draftDefault()), ...patch } })); };
  const updateConversation = useCallback(next => {
    if (!validConversation(next) || currentAccount.current !== accountKey) return;
    setListResult(previous => ({ ...previous, rows: replaceConversation(previous.rows, next) }));
    setDetailResult(previous => previous.key === detailKey && previous.data?.conversation.id === next.id ? { ...previous, data: { ...previous.data, conversation: next } } : previous);
  }, [accountKey, detailKey]);
  const showModal = value => { setModalError(''); setRecordId(''); setRecordSearch(''); setRecords(null); setConsentChecked(false); setConsentSource(''); setModal(value); };
  const verify = async () => {
    if (preview || busy || !status?.owner) return;
    setBusy('verify'); setStatusError('');
    try { const result = await request('post', '/verify', {}); if (typeof result?.connected !== 'boolean') throw new Error(); if (mounted.current) setStatus(result); }
    catch (error) { if (mounted.current) setStatusError(errorText(error)); }
    finally { if (mounted.current) setBusy(''); }
  };
  const loadMore = async () => {
    if (moreBusy || !listResult.nextCursor || preview) return;
    const key = listKey, generation = listGeneration.current;
    setMoreBusy(true);
    try {
      const result = await request('get', '/conversations', undefined, { params: { q: query, cursor: listResult.nextCursor } });
      if (!Array.isArray(result?.conversations)) throw new Error();
      if (mounted.current && generation === listGeneration.current) setListResult(previous => {
        if (previous.key !== key) return previous;
        let combined = previous.rows; for (const row of result.conversations.filter(validConversation)) combined = replaceConversation(combined, row);
        return { ...previous, rows: combined.slice(0, 300), nextCursor: result.nextCursor || null, loadedMore: true };
      });
    } catch (error) { if (mounted.current && generation === listGeneration.current) setListResult(previous => ({ ...previous, error: errorText(error) })); }
    finally { if (mounted.current) setMoreBusy(false); }
  };
  const loadEarlier = async () => {
    const id = selected, generation = detailGeneration.current;
    if (!detail?.nextCursor || historyBusy || preview) return;
    setHistoryBusy(true); stickToLatest.current = false;
    try {
      const result = await request('get', '/conversations/' + encodeURIComponent(id), undefined, { params: { before: detail.nextCursor } });
      if (!Array.isArray(result?.messages)) throw new Error();
      if (mounted.current && generation === detailGeneration.current) setDetailResult(previous => previous.key === detailKey ? { ...previous, data: { ...previous.data, messages: mergeWhatsAppMessages(result.messages, previous.data.messages), nextCursor: result.nextCursor || null, loadedEarlier: true } } : previous);
    } catch (error) { if (mounted.current && generation === detailGeneration.current) setSendError({ id, text: errorText(error) }); }
    finally { if (mounted.current) setHistoryBusy(false); }
  };
  const createConversation = async event => {
    event.preventDefault(); if (busy || preview) return;
    const phone = internationalWhatsAppPhone(newPhone);
    if (!phone) { setModalError('Enter the full number with country code, for example +919876543210.'); return; }
    setBusy('create'); setModalError('');
    try {
      const result = await request('post', '/conversations', { phone, name: newName.trim() });
      if (!validConversation(result?.conversation)) throw new Error();
      if (mounted.current) { setListResult(previous => ({ ...previous, key: listKey, rows: replaceConversation(previous.rows, result.conversation) })); chooseConversation(result.conversation.id); setModal(''); setNewPhone(''); setNewName(''); }
    } catch (error) { if (mounted.current) setModalError(errorText(error)); }
    finally { if (mounted.current) setBusy(''); }
  };
  const saveLink = async event => {
    event.preventDefault(); if (busy || !recordId || preview) return;
    const id = selected; setBusy('link'); setModalError('');
    try { const result = await request('put', '/conversations/' + encodeURIComponent(id) + '/link', { entityType: recordType, entityId: recordId }); if (!validConversation(result?.conversation)) throw new Error(); if (mounted.current) { updateConversation(result.conversation); setModal(''); } }
    catch (error) { if (mounted.current) setModalError(errorText(error)); }
    finally { if (mounted.current) setBusy(''); }
  };
  const saveConsent = async event => {
    event.preventDefault(); if (busy || preview || !consentChecked || consentSource.trim().length < 5) return;
    const id = selected; setBusy('consent'); setModalError('');
    try { const result = await request('put', '/conversations/' + encodeURIComponent(id) + '/consent', { confirmed: true, source: consentSource.trim() }); if (!validConversation(result?.conversation)) throw new Error(); if (mounted.current) { updateConversation(result.conversation); setModal(''); } }
    catch (error) { if (mounted.current) setModalError(errorText(error)); }
    finally { if (mounted.current) setBusy(''); }
  };
  const withdrawConsent = async () => {
    if (busy || preview || !selected) return;
    const id = selected; setBusy('consent'); setModalError('');
    try { const result = await request('put', '/conversations/' + encodeURIComponent(id) + '/consent', { confirmed: false, source: '' }); if (!validConversation(result?.conversation)) throw new Error(); if (mounted.current) { updateConversation(result.conversation); setModal(''); } }
    catch (error) { if (mounted.current) setModalError(errorText(error)); }
    finally { if (mounted.current) setBusy(''); }
  };
  const send = async event => {
    event.preventDefault(); if (!canSend) return;
    const id = selected, payload = mode === 'text' ? { kind: 'text', text: draft.text.trim() } : { kind: 'template', template: { name: chosenTemplate.name, language: chosenTemplate.language, parameters: templateDraft.parameters } };
    const fingerprint = JSON.stringify(payload);
    let claim = claims.current.get(id);
    if (claim?.fingerprint !== fingerprint) { claim = { fingerprint, requestId: whatsappRequestId() }; claims.current.set(id, claim); }
    setBusy('send:' + id); setFailedAttempts(previous => ({ ...previous, [id]: false })); setSendError({ id, text: '' });
    try {
      const result = await request('post', '/conversations/' + encodeURIComponent(id) + '/messages', { ...payload, requestId: claim.requestId });
      if (!result?.message?.id || !validConversation(result.conversation)) throw new Error();
      if (mounted.current) {
        updateConversation(result.conversation);
        setDetailResult(previous => previous.key === detailKey && previous.data ? { ...previous, data: { ...previous.data, messages: mergeWhatsAppMessages(previous.data.messages, [result.message]) } } : previous);
        if (['unknown', 'sending', 'pending'].includes(result.message.status)) { setUncertain(previous => ({ ...previous, [id]: true })); setSendError({ id, text: 'Delivery could not be confirmed. Check the WhatsApp Business app before composing another message.' }); }
        else if (result.message.status === 'failed') { setFailedAttempts(previous => ({ ...previous, [id]: true })); setSendError({ id, text: result.message.error || 'WhatsApp did not send this message. Review the error before composing another message.' }); }
        else if (confirmedWhatsAppSubmission(result.message.status)) { setDrafts(previous => ({ ...previous, [id]: draftDefault() })); claims.current.delete(id); stickToLatest.current = true; }
        else { setUncertain(previous => ({ ...previous, [id]: true })); setSendError({ id, text: 'This attempt has no confirmed delivery status. Check WhatsApp Business before composing another message.' }); }
      }
    } catch (error) {
      if (mounted.current) {
        const unconfirmed = !error.response || error.response.status >= 500;
        if (unconfirmed) setUncertain(previous => ({ ...previous, [id]: true })); else setFailedAttempts(previous => ({ ...previous, [id]: true }));
        setSendError({ id, text: unconfirmed ? 'We could not confirm this attempt. Check the WhatsApp Business app before composing another message; it will not be resent automatically.' : errorText(error) });
      }
    } finally { if (mounted.current) setBusy(''); }
  };
  const copyWebhook = async () => { try { await navigator.clipboard.writeText(webhook); setCopied(true); } catch { setCopied(false); setStatusError('Select and copy the webhook address shown below.'); } };
  const candidates = (recordType === 'contact' ? records?.contacts : records?.enquiries) || [];
  const matchingRecords = candidates.filter(record => !record.archived && record.status !== 'Archived' && String([record.firstName, record.lastName, record.name, record.phone, record.email].filter(Boolean).join(' ')).toLowerCase().includes(recordSearch.toLowerCase())).slice(0, 100);

  return <div className="studio-whatsapp-page">
    <WorkspaceHeader eyebrow="CLIENT CONVERSATIONS" title="WhatsApp Business" description="Your client conversations, connected to the studio.">
      <Link className="studio-button" to="/admin/integrations"><ArrowLeft size={15} />Integrations</Link>
      <button type="button" className="studio-button" onClick={() => setRefresh(value => value + 1)} disabled={preview || !!busy} aria-label="Refresh WhatsApp"><RefreshCw size={15} />Refresh</button>
      <button type="button" className="studio-button primary" disabled={!connected || !!busy} onClick={() => showModal('new')}><Plus size={16} />New conversation</button>
    </WorkspaceHeader>
    <WorkspaceError error={statusError} retry={() => setRefresh(value => value + 1)} />
    <section className="wa-connection-strip studio-card"><span className="wa-brand-icon"><MessageCircle size={22} strokeWidth={1.5} /></span><div><strong>{connected ? status.verifiedName || 'Your WhatsApp Business account' : 'Keep your number. Keep your Business app.'}</strong><p>{connected ? status.displayPhoneNumber : preview ? 'This sample preview cannot access WhatsApp or send messages.' : 'Connect through Meta’s supported coexistence setup. Your phone account is not changed from this workspace.'}</p></div><span className={'studio-badge ' + (connected ? 'green' : 'gold')}>{preview ? 'Preview only' : statusError ? 'Unavailable' : whatsappConnectionLabel(status)}</span>{status?.owner && <button type="button" className="studio-button small" disabled={preview || !status.configured || !!busy} onClick={verify}><ShieldCheck size={14} />{busy === 'verify' ? 'Verifying…' : 'Verify connection'}</button>}</section>
    {!connected && <section className="studio-card wa-setup"><div className="wa-setup-heading"><span className="wa-brand-icon"><LockKeyhole size={22} /></span><div><h2>Connect your existing business number</h2><p>Official WhatsApp Business API · Coexistence connection</p></div></div><ol><li><span>01</span><div><h3>Complete the supported Meta connection</h3><p>Use the coexistence onboarding flow for your existing WhatsApp Business app. Availability depends on your Meta business account and provider setup.</p><a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/" target="_blank" rel="noopener noreferrer">Meta setup guide <ArrowUpRight size={13} /></a></div></li><li><span>02</span><div><h3>Keep connection keys on the backend</h3><p>Your studio owner configures the connection privately in the backend hosting service. Access tokens and app secrets are never entered in client messages or shared links.</p>{!!status?.missing?.length && <details><summary>Backend settings still needed</summary><ul className="wa-config-fields">{status.missing.filter(value => typeof value === 'string' && /^WHATSAPP_[A-Z0-9_]+$/.test(value)).map(value => <li key={value}><code>{value}</code></li>)}</ul></details>}</div></li><li><span>03</span><div><h3>Verify the account and receive new messages</h3><p>{status?.owner ? 'Use Verify connection once the backend is configured. Studio OS checks that your Business app remains connected before enabling sending.' : 'Ask your studio owner to verify the configured account. Your Business app must remain connected before sending is enabled.'}</p>{webhook && <div className="wa-webhook-line"><code>{webhook}</code><button type="button" className="studio-icon-button" aria-label="Copy WhatsApp webhook address" onClick={copyWebhook}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>}</div></li></ol><p className="wa-setup-footnote">Messages appear here as they are received after connection. Earlier app history and media downloads are not imported automatically. Meta messaging charges may apply.</p></section>}
    {connected && <section className={'wa-workspace' + (selected ? ' has-selection' : '')}>
      <aside className="wa-inbox" aria-label="WhatsApp conversations"><div className="wa-inbox-heading"><h2>Conversations</h2><span>{rows.length}</span></div><form className="wa-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}><Search size={16} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search WhatsApp conversations" placeholder="Search name or number…" maxLength={100} /><button type="submit" className="studio-icon-button" aria-label="Search conversations"><ArrowUpRight size={15} /></button></form><WorkspaceError error={listError} retry={() => setRefresh(value => value + 1)} /><div className="wa-conversation-list" aria-busy={listResult.key !== listKey}>
        {listResult.key !== listKey ? <div className="wa-empty" role="status"><RefreshCw size={24} /><p>Loading conversations…</p></div> : rows.length ? rows.map(row => <button type="button" key={row.id} className={'wa-conversation-row' + (selected === row.id ? ' selected' : '')} aria-pressed={selected === row.id} onClick={() => chooseConversation(row.id)}><span className="wa-avatar">{avatar(row.name || row.phone)}</span><span className="wa-conversation-copy"><span><strong>{row.name || row.phone}</strong><time>{date(row.lastMessageAt, true)}</time></span><span><small>{typeof row.lastMessage === 'string' ? row.lastMessage : row.lastMessage?.text || 'No messages yet'}</small>{row.unread && <b aria-label="Unread conversation" />}</span></span></button>) : <div className="wa-empty"><MessageCircle size={29} /><h3>{query ? 'No matching conversations' : 'Your next conversation starts here'}</h3><p>{query ? 'Try another client name or international number.' : 'New client messages will appear here once received.'}</p></div>}
      </div>{listResult.nextCursor && rows.length < 300 && <button type="button" className="studio-button small wa-load-more" disabled={moreBusy} onClick={loadMore}>{moreBusy ? 'Loading…' : 'More conversations'}</button>}</aside>
      <article className="wa-thread" aria-label="Selected WhatsApp conversation">
        {!selected ? <div className="wa-empty wa-thread-empty"><span className="wa-brand-icon"><MessageCircle size={32} strokeWidth={1.3} /></span><h2>A little closer to your clients.</h2><p>Select a conversation to read and reply. New messages are shared with your authorised Studio OS team.</p></div> : detailResult.key !== detailKey ? <div className="wa-empty" role="status">Opening conversation…</div> : !conversation ? <div className="wa-empty"><WorkspaceError error={detailResult.error || 'This conversation could not be opened.'} retry={() => setRefresh(value => value + 1)} /><button type="button" className="studio-button" onClick={() => chooseConversation('')}><ChevronLeft size={15} />Back to conversations</button></div> : <>
          <header className="wa-thread-heading"><button type="button" className="studio-icon-button wa-back" aria-label="Back to conversations" onClick={() => chooseConversation('')}><ChevronLeft size={19} /></button><span className="wa-avatar">{avatar(conversation.name || conversation.phone)}</span><div><h2>{conversation.name || conversation.phone}</h2><p>{conversation.phone}</p></div><a className="studio-icon-button" href={openWhatsAppUrl(conversation.phone) || undefined} target="_blank" rel="noopener noreferrer" aria-label="Open this client in WhatsApp Business"><ArrowUpRight size={17} /></a></header>
          <div className="wa-context-bar"><span className={'wa-window-status' + (replyOpen ? ' open' : '')}><i />{replyOpen ? 'Reply window open' : 'Approved template needed'}</span><div>{conversation.contactId ? <Link to={'/admin/contacts/' + conversation.contactId}><Link2 size={13} />Client contact</Link> : conversation.leadId ? <Link to={recordDestination('enquiry', conversation.leadId, '/admin/whatsapp?conversation=' + selected)}><Link2 size={13} />Linked enquiry</Link> : <button type="button" onClick={() => showModal('link')}><Link2 size={13} />Link client</button>}<button type="button" onClick={() => showModal('consent')}><ShieldCheck size={13} />{conversation.optIn?.confirmed ? 'Permission recorded' : 'Record permission'}</button></div></div>
          <WorkspaceError error={detailResult.error} retry={() => setRefresh(value => value + 1)} />
          <div className="wa-messages" ref={listRef} onScroll={event => { const node = event.currentTarget; stickToLatest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60; }} aria-label="Conversation messages" aria-live="polite" aria-relevant="additions text">
            {detail.nextCursor && messages.length < 500 && <button type="button" className="studio-button small wa-earlier" disabled={historyBusy} onClick={loadEarlier}>{historyBusy ? 'Loading…' : 'Earlier messages'}</button>}
            {messages.length >= 500 && <p className="wa-history-limit">Showing the most recent 500 loaded messages. Use WhatsApp Business for older app history.</p>}
            {messages.length ? messages.map(message => <article key={message.id} className={'wa-message ' + (message.direction === 'outbound' ? 'outbound' : 'inbound') + (message.status === 'unknown' || message.status === 'failed' ? ' attention' : '')}>{message.kind === 'template' && <small className="wa-template-label"><FileText size={11} />Approved template</small>}<p>{message.text || (message.kind === 'unsupported' ? 'This message type can be viewed in the WhatsApp Business app.' : 'Message content unavailable.')}</p><div><time>{date(message.createdAt)}</time><span className="wa-message-status">{message.status === 'read' ? <CheckCheck size={12} /> : ['sent', 'delivered'].includes(message.status) ? <Check size={12} /> : null}{whatsappMessageStatus(message)}</span></div>{message.error && <small className="wa-message-error">{message.error}</small>}</article>) : <div className="wa-empty"><p>No messages in this conversation yet.</p><p>Starting a conversation requires an approved template and recorded permission.</p></div>}
          </div>
          <form className="wa-composer" onSubmit={send}>
            <div className="wa-composer-heading"><label htmlFor="wa-reply">{mode === 'text' ? 'Your reply' : 'Approved message template'}</label>{replyOpen && <button type="button" onClick={() => updateDraft({ mode: mode === 'text' ? 'template' : 'text' })} disabled={!!busy}><FileText size={13} />{mode === 'text' ? 'Use a template' : 'Write a reply'}</button>}</div>
            {mode === 'text' ? <textarea id="wa-reply" rows={3} value={draft.text} disabled={!!busy || !!uncertain[selected]} onChange={event => updateDraft({ text: event.target.value })} maxLength={4096} placeholder="Write a thoughtful reply…" /> : <div className="wa-template-composer"><select id="wa-reply" value={draft.template} disabled={!!busy || !!uncertain[selected]} onChange={event => updateDraft({ template: event.target.value, parameters: [] })}><option value="">Choose an approved template</option>{templates.map(template => <option key={templateKey(template)} value={templateKey(template)}>{template.name} · {template.language}</option>)}</select>{templateResult.error && <WorkspaceError error={templateResult.error} retry={() => setTemplateRefresh(value => value + 1)} />}{!templates.length && !templateResult.error && <p>No supported approved text templates are available. Manage templates in your Meta account, then refresh.</p>}{chosenTemplate && <><p className="wa-template-preview">{templateDraft.preview}</p>{Array.from({ length: Math.min(20, chosenTemplate.parameterCount || 0) }, (_, index) => <label key={index}>Value {index + 1}<input value={draft.parameters[index] || ''} maxLength={1024} disabled={!!busy || !!uncertain[selected]} onChange={event => updateDraft({ parameters: Array.from({ length: chosenTemplate.parameterCount }, (_, position) => position === index ? event.target.value : draft.parameters[position] || '') })} /></label>)}<small>{chosenTemplate.category} · Meta may charge for this message.</small></>}{!replyOpen && !conversation.optIn?.confirmed && <p className="wa-permission-needed"><ShieldCheck size={14} />Record the client’s permission before sending a template.</p>}</div>}
            {sendError.id === selected && <WorkspaceError error={sendError.text} />}
            {failedAttempts[selected] && !uncertain[selected] && <div className="wa-uncertain-action"><p>The previous attempt was not sent. Review the error before starting another message.</p><button type="button" className="studio-button small" onClick={() => { claims.current.delete(selected); setFailedAttempts(previous => ({ ...previous, [selected]: false })); updateDraft(draftDefault()); setSendError({ id: '', text: '' }); }}>Compose a new message</button></div>}
            {uncertain[selected] && <div className="wa-uncertain-action"><p>Do not repeat the previous attempt until you have checked the Business app.</p><button type="button" className="studio-button small" onClick={() => { claims.current.delete(selected); setUncertain(previous => ({ ...previous, [selected]: false })); updateDraft(draftDefault()); setSendError({ id: '', text: '' }); }}>I checked WhatsApp · compose another message</button></div>}
            <div className="wa-composer-footer"><small>{mode === 'text' ? `${draft.text.length}/4,096 · Replies use the active 24-hour window.` : 'Only supported, currently approved text templates can be sent.'}</small><button type="submit" className="studio-button primary" disabled={!canSend}><Send size={15} />{busy === 'send:' + selected ? 'Sending…' : mode === 'text' ? 'Send reply' : 'Send template'}</button></div>
          </form>
        </>}
      </article>
    </section>}
    <p className="wa-page-note"><ShieldCheck size={13} />Messages are sent only when your team chooses Send. Delivery updates come from WhatsApp; opening the inbox does not send a WhatsApp read receipt.</p>
    {modal === 'new' && <WorkspaceDialog title="New WhatsApp conversation" onClose={() => !busy && setModal('')} onSubmit={createConversation} busy={!!busy} error={modalError} submitLabel="Open conversation"><p className="wa-dialog-help">Create a conversation without sending a message. Use the client’s full international number.</p><label className="wa-form-field">Client name<input value={newName} onChange={event => setNewName(event.target.value)} maxLength={120} autoComplete="name" placeholder="Optional client name" /></label><label className="wa-form-field">WhatsApp number<input value={newPhone} onChange={event => setNewPhone(event.target.value)} required maxLength={30} autoComplete="tel" inputMode="tel" placeholder="+919876543210" /></label></WorkspaceDialog>}
    {modal === 'link' && <WorkspaceDialog title="Link this conversation" onClose={() => !busy && setModal('')} onSubmit={saveLink} busy={!!busy} error={modalError} submitLabel="Link record"><p className="wa-dialog-help">Choose an existing record with this exact international phone number. Studio OS checks the match; it does not create or merge client records.</p><label className="wa-form-field">Record type<select value={recordType} onChange={event => { setRecordType(event.target.value); setRecordId(''); }}><option value="contact">Client contact</option><option value="enquiry">Enquiry</option></select></label><label className="wa-form-field">Find a record<input value={recordSearch} onChange={event => setRecordSearch(event.target.value)} maxLength={100} placeholder="Search name, email or number…" /></label><label className="wa-form-field">{sourceName(recordType)}<select value={recordId} onChange={event => setRecordId(event.target.value)} required><option value="">{records ? 'Choose a matching record' : 'Loading studio records…'}</option>{matchingRecords.map(record => <option key={record._id} value={record._id}>{[record.firstName, record.lastName].filter(Boolean).join(' ') || record.name} · {record.phone || 'No number saved'}</option>)}</select></label></WorkspaceDialog>}
    {modal === 'consent' && <WorkspaceDialog title="Record messaging permission" onClose={() => !busy && setModal('')} onSubmit={saveConsent} busy={!!busy} error={modalError} submitLabel="Save permission"><p className="wa-dialog-help">Record permission you have already received from this client. Saving this record does not contact the client or send a message.</p><label className="wa-permission-check"><input type="checkbox" checked={consentChecked} onChange={event => setConsentChecked(event.target.checked)} required /><span>The client has agreed to receive these WhatsApp messages from the studio.</span></label><label className="wa-form-field">Where was permission recorded?<textarea value={consentSource} onChange={event => setConsentSource(event.target.value)} minLength={5} maxLength={300} rows={3} required placeholder="For example, the enquiry form or a client message and date." /></label>{conversation?.optIn?.confirmed && <><p className="wa-dialog-help">Current record: {conversation.optIn.source || 'Permission confirmed'} {date(conversation.optIn.at)}</p><button type="button" className="studio-button small" disabled={!!busy} onClick={withdrawConsent}>Withdraw recorded permission</button></>}</WorkspaceDialog>}
  </div>;
}
