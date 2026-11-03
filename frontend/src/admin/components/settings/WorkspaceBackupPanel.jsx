import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Cloud, Download, FileUp, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../utils/apiConfig';
import { captureWorkspaceContext, assertWorkspaceContext, saveNativeWorkspaceFile } from '../../../native/nativeCapabilities';
import './workspaceBackup.css';
import useStudioDialog from '../studio/useStudioDialog';

const security = '/api/studio/security';
const drive = '/api/integrations/drive-backups';
const date = value => new Date(value).toLocaleString('en-IN');
const count = counts => Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
const labels = { StudioConfig: 'Company information', User: 'Team accounts', StudioContact: 'Contacts', StudioProject: 'Projects', Lead: 'Enquiries', Quotation: 'Quotations', Invoice: 'Invoices', Task: 'Production tasks', Photographer: 'Crew' };
const fallbackCoverage = ['Company information and settings', 'Contacts, enquiries and projects', 'Quotes, invoices and payment records', 'Team directory, roles and module access', 'Crew, schedules, production tasks and messages', 'Stored profile images and receipt attachments'];

export default function WorkspaceBackupPanel() {
  const { token, user, logout } = useAuth();
  const preview = user?.isPreview === true;
  const [summary, setSummary] = useState(null), [history, setHistory] = useState([]), [connection, setConnection] = useState(null), [cloudFiles, setCloudFiles] = useState([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(() => new URLSearchParams(window.location.search).get('driveBackup') === 'error' ? 'Google Drive was not connected. Try again and approve access to the backup files.' : ''), [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get('driveBackup') === 'connected' ? 'Google Drive connected.' : ''), [dialog, setDialog] = useState(null);
  const [password, setPassword] = useState(''), [phrase, setPhrase] = useState(''), [acknowledged, setAcknowledged] = useState(false), [inspection, setInspection] = useState(null);
  const pendingFile = useRef(null), fileInput = useRef(null), lock = useRef(false);
  const call = useCallback(async (path, options = {}) => {
    const context = captureWorkspaceContext();
    const response = await fetch(API + path, { ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers } });
    assertWorkspaceContext(context);
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || data.message || 'This action could not be completed. Please try again.'); }
    return response;
  }, [token]);
  const json = useCallback(async (path, body) => (await call(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(), [call]);
  const load = useCallback(async () => {
    const [data, archives] = await Promise.all([json(security + '/workspace-data'), json(security + '/workspace-backups')]);
    setSummary(data); setHistory(archives.backups || archives);
    try { const status = await json(drive + '/status'); setConnection(status); if (status.connected) { const result = await json(drive + '/files'); setCloudFiles(result.files || []); } else setCloudFiles([]); }
    catch { setConnection({ configured: false, message: 'Google Drive backup is not available on this server yet. You can save an encrypted file to Files or iCloud Drive.' }); }
  }, [json]);
  useEffect(() => { if (!preview) Promise.resolve().then(load).catch(e => setError(e.message)); }, [load, preview]);
  const run = async action => { if (lock.current || preview) return; lock.current = true; setBusy(true); setError(''); setNotice(''); const context = captureWorkspaceContext(); try { await action(context); } catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); } };
  const open = value => { setPassword(''); setPhrase(''); setAcknowledged(false); setError(''); setDialog(value); };
  const close = () => { if (busy) return; setDialog(null); setPassword(''); setPhrase(''); setAcknowledged(false); pendingFile.current = null; setInspection(null); };
  const dialogRef = useStudioDialog(close, { enabled: Boolean(dialog), canClose: !busy });
  const save = async (path, filename, context) => {
    const response = await call(path), blob = await response.blob(); assertWorkspaceContext(context);
    if (await saveNativeWorkspaceFile(blob, filename, context)) return;
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const inspect = file => run(async context => {
    if (!file) return;
    if (file.size > (summary?.limits?.maxUploadBytes || 48 * 1024 * 1024)) throw new Error('This file is larger than the supported backup limit.');
    const form = new FormData(); form.append('archive', file);
    const result = await (await call(security + '/workspace-restore/inspect', { method: 'POST', body: form })).json();
    assertWorkspaceContext(context); pendingFile.current = file; setInspection(result); open('restore');
  });
  const finish = async message => { setPassword(''); setPhrase(''); setDialog(null); pendingFile.current = null; window.alert(message + ' You will now be signed out.'); await logout(); };
  const submit = () => run(async context => {
    if (dialog === 'create') {
      const result = await json(security + '/workspace-backups', { password }); assertWorkspaceContext(context);
      setDialog(null); setPassword(''); await load(); setNotice('Encrypted workspace backup created. Save a copy outside Studio OS before resetting.');
      if (result.backupId || result.id || result._id) await save(security + '/workspace-backups/' + (result.backupId || result.id || result._id) + '/download', 'studio-os-workspace-' + new Date().toISOString().slice(0, 10) + '.studioos.json', context);
    } else if (dialog === 'resume') {
      await json(security + '/workspace-resume', { password, confirmation: phrase }); assertWorkspaceContext(context);
      setPassword(''); setPhrase(''); setDialog(null); await load(); setNotice('Integrations resumed. Reconnect your providers where required.');
    } else if (dialog === 'reset') {
      await json(security + '/workspace-reset', { password, confirmation: phrase }); assertWorkspaceContext(context);
      await finish('Workspace data has been reset. Your owner sign-in and recovery archives were kept.');
    } else if (dialog === 'restore') {
      const form = new FormData(); form.append('archive', pendingFile.current); form.append('password', password); form.append('confirmation', phrase);
      await call(security + '/workspace-restore', { method: 'POST', body: form }); assertWorkspaceContext(context);
      await finish('Workspace backup restored. Restored team accounts need new passwords and integrations must be reconnected.');
    }
  });
  const confirmation = dialog === 'reset' ? 'DELETE WORKSPACE DATA' : dialog === 'resume' ? 'RESUME INTEGRATIONS' : 'RESTORE WORKSPACE';
  const confirmed = dialog === 'create' || (acknowledged && phrase === confirmation);
  return <section className="workspace-backups" aria-label="Workspace backup and reset">
    <div className="workspace-backup-heading"><span className="workspace-backup-symbol"><ShieldCheck size={22} /></span><div><h2>Protect your entire workspace</h2><p>Keep an encrypted recovery copy before making a fresh start.</p></div></div>
    {preview && <p className="workspace-backup-callout">Sample preview · Backup and reset controls work only with your saved studio owner account.</p>}
    {error && <div className="studio-error" role="alert">{error}<button type="button" className="studio-button small" disabled={busy || preview} onClick={() => run(load)}>Retry status</button></div>}
    {summary && !summary.keyConfigured && <p className="workspace-backup-warning" role="note">Backups require a stable server recovery key. An administrator must configure BACKUP_SECRET or VAULT_SECRET before backup, restore or reset can run.</p>}
    {summary && !summary.recoveryEnabled && <p className="workspace-backup-warning" role="note">Reset and restore are awaiting database recovery verification. Encrypted backups can still be created and saved.</p>}
    {summary?.integrationsPaused && <div className="workspace-backup-callout"><strong>Integrations are paused after recovery.</strong><p>Automatic imports, provider callbacks and scheduled activity stay paused so old connections cannot repopulate the workspace. Review your settings, resume integrations, then reconnect providers where required.</p><button type="button" className="studio-button" disabled={busy || preview || !summary?.recoveryEnabled || summary?.maintenanceBlocked} onClick={() => open('resume')}>Review and resume integrations</button></div>}
    {notice && <p className="workspace-backup-callout" role="status">{notice}</p>}
    <div className="workspace-backup-coverage"><strong>Included in an encrypted workspace archive</strong><ul>{fallbackCoverage.map(item => <li key={item}>{item}</li>)}</ul><p>Passwords, active sessions, API keys and Google connections are excluded. Team accounts are restored disabled until you assign fresh passwords. Photo and video originals hosted elsewhere are referenced by their links; those original files need their own backup.</p><p>Archives require this server’s original recovery key. Keep that key securely backed up separately; losing it makes the archive unreadable.</p></div>
    <div className="workspace-backup-actions"><button type="button" className="studio-button primary" disabled={busy || preview || !summary?.keyConfigured} onClick={() => open('create')}><Archive size={17} />Create encrypted backup</button><button type="button" className="studio-button" disabled={busy || preview || !summary?.keyConfigured || summary?.resetBlocked} onClick={() => fileInput.current?.click()}><FileUp size={17} />Restore from file</button><input ref={fileInput} className="workspace-backup-file" type="file" accept=".json,application/json" aria-label="Choose encrypted workspace backup" onChange={e => { inspect(e.target.files?.[0]); e.target.value = ''; }} /></div>
    {summary?.latestArchiveWarnings?.unresolvedReferences > 0 && <p className="workspace-backup-warning">The latest archive preserves {summary.latestArchiveWarnings.unresolvedReferences} historical links to deleted records. Review those links after restoring.</p>}
    <p className="workspace-backup-hint">Save to Files / iCloud Drive: download an archive, then choose iCloud Drive in your device’s Files picker or move the downloaded file there. No Apple password is collected.</p>
    <div className="workspace-backup-section"><h3>Workspace archives <span>{history.length}</span></h3>{history.length ? <ul className="workspace-archive-list">{history.map(row => <li key={row._id || row.id}><div><strong>{date(row.createdAt)}</strong><small>{row.reason || row.kind || 'Manual'} · {count(row.counts)} records · available until {date(row.expiresAt)}</small></div><div className="workspace-backup-actions"><button type="button" className="studio-button small" disabled={busy} onClick={() => run(context => save(security + '/workspace-backups/' + (row._id || row.id) + '/download', 'studio-os-' + (row._id || row.id) + '.studioos.json', context))}><Download size={16} />Save file</button><button type="button" className="studio-button small" disabled={busy || !connection?.connected} onClick={() => run(async () => { await json(drive + '/files', { backupId: row._id || row.id }); await load(); setNotice('Encrypted archive saved to Google Drive.'); })}><Cloud size={16} />Save to Drive</button></div></li>)}</ul> : <p className="studio-muted">Create your first workspace archive. Existing record snapshots remain available below.</p>}</div>
    <div className="workspace-backup-section"><div className="workspace-backup-row"><div><h3>Google Drive</h3><p>{connection?.connected ? connection.email : 'Store encrypted archives in your own Google Drive.'}</p></div><button type="button" className="studio-button" disabled={busy || preview || !connection?.configured} onClick={() => run(async context => { if (connection.connected) { await json(drive + '/disconnect', {}); await load(); } else { const result = await json(drive + '/connect', {}); assertWorkspaceContext(context); window.location.assign(result.url); } })}>{connection?.connected ? 'Disconnect' : 'Connect Google Drive'}</button></div>{!connection?.configured && <p className="workspace-backup-hint">{connection?.message || 'An administrator must configure the Google Drive callback in the backend before connecting. Encrypted file backups remain available.'}</p>}<p className="workspace-backup-hint">Drive permission is limited to files created by this integration. Calendar and Gmail connections stay separate.</p>{cloudFiles.length > 0 && <ul className="workspace-archive-list">{cloudFiles.map(row => <li key={row.id}><div><strong>{row.name}</strong><small>{date(row.createdTime)}</small></div><button type="button" className="studio-button small" disabled={busy} onClick={() => run(context => save(drive + '/files/' + row.id + '/download', row.name, context))}><Download size={16} />Download to restore</button></li>)}</ul>}</div>
    <div className="workspace-reset-zone"><div><Trash2 size={21} aria-hidden="true" /><h3>Master reset</h3></div><p>Delete company settings, contacts, enquiries, projects, quotes, invoices, financial records, crew, tasks, messages and other team accounts from this workspace. Existing client links stop working. Your owner sign-in and recovery archives are retained so you can recover.</p>{summary?.blockers?.map(message => <p key={message} className="workspace-backup-warning">{message}</p>)}<p>A safety archive must be created successfully before deletion. This does not delete photo or video originals stored in external services.</p><button type="button" className="studio-button danger" disabled={busy || preview || !summary?.keyConfigured || summary?.resetBlocked} onClick={() => open('reset')}>Review master reset</button></div>
    {dialog && createPortal(<div className="studio-app studio-personal-workspace workspace-backup-overlay"><div ref={dialogRef} className="workspace-backup-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-backup-title"><header><h2 id="workspace-backup-title">{dialog === 'create' ? 'Create a private recovery copy' : dialog === 'reset' ? 'Permanently reset this workspace?' : dialog === 'resume' ? 'Resume studio integrations?' : 'Replace workspace from backup?'}</h2><button type="button" className="studio-icon-button" aria-label="Close backup confirmation" disabled={busy} onClick={close}><X size={20} /></button></header><div className="workspace-backup-dialog-body">{dialog === 'create' ? <p>Confirm your current owner password. The archive contains private studio and client data, protected by the server’s recovery key.</p> : <><div className="workspace-backup-warning" role="note"><strong>{dialog === 'reset' ? 'This deletes your current workspace data.' : dialog === 'resume' ? 'This allows automatic studio activity to run again.' : 'This replaces your current workspace data.'}</strong>{dialog === 'resume' ? <p>Review provider connections, email settings, webhooks and reminders first. Reconnected services may import records or deliver scheduled messages.</p> : <p>Quotes, invoices, payments and project history will be {dialog === 'reset' ? 'removed' : 'replaced'}. Keep a downloaded backup first. A safety archive is created before the operation; a failure cancels the operation.</p>}</div>{dialog !== 'resume' && <dl className="workspace-backup-counts">{Object.entries((dialog === 'restore' ? inspection?.counts : { ...summary?.counts, User: Math.max(0, (summary?.counts?.User || 0) - 1) }) || {}).filter(([,value]) => Number(value) > 0).map(([key,value]) => <div key={key}><dt>{labels[key] || key}</dt><dd>{value}</dd></div>)}</dl>}{dialog === 'reset' && <p>Your owner sign-in and recovery archives are retained. The team count above excludes your owner account.</p>}{dialog === 'restore' && inspection?.warnings?.map(message => <p key={message} className="workspace-backup-warning">{message} ({inspection.unresolvedReferences?.length || 0} links)</p>)}{dialog === 'restore' && <p>Restored team accounts are disabled until the owner sets new passwords. Google connections must be reconnected. Client links and automatic reminders are reset for safety.</p>}<label className="workspace-backup-ack"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} disabled={busy} /><span>{dialog === 'resume' ? 'I have reviewed the studio integrations and want automatic activity to resume.' : 'I have saved a recovery copy and understand this changes the entire workspace.'}</span></label><label className="studio-field">Type {confirmation}<input className="studio-input" autoComplete="off" value={phrase} disabled={busy} onChange={e => setPhrase(e.target.value)} /></label></>}<label className="studio-field">Current owner password<input className="studio-input" type="password" autoComplete="current-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></label>{error && <div className="studio-error" role="alert">{error}</div>}</div><footer><button className="studio-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className={'studio-button ' + (dialog === 'reset' ? 'danger' : 'primary')} type="button" disabled={busy || !password || !confirmed} onClick={submit}>{busy ? 'Please wait…' : dialog === 'create' ? 'Create backup' : dialog === 'reset' ? 'Delete workspace data' : dialog === 'resume' ? 'Resume integrations' : 'Replace and restore'}</button></footer></div></div>, document.body)}
  </section>;
}
