import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, ShieldCheck, Database, LogOut } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import API_BASE_URL from '../../../utils/apiConfig';
import './securityRecovery.css';

const endpoint = API_BASE_URL + '/api/studio/security';
const date = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const permissionLabels = { discounts: 'Apply discounts', deletion: 'Delete business records', exports: 'Export studio records', invoiceIssue: 'Issue invoices' };
export default function SecurityRecoveryPanel({ mode = 'security', settings = {}, onChange, onSave, saving }) {
  const { token, logout } = useAuth();
  const [access, setAccess] = useState(null), [sessions, setSessions] = useState([]), [backups, setBackups] = useState([]), [trash, setTrash] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [restore, setRestore] = useState(null), [confirmation, setConfirmation] = useState('');
  const request = useCallback(async (path, method = 'GET', body) => {
    const response = await fetch(endpoint + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.msg || 'Unable to complete this action.');
    return result;
  }, [token]);
  const load = async () => {
    const result = await request('/access'); setAccess(result);
    if (mode === 'security') setSessions(await request('/sessions'));
    else if (result.owner) { const [history, recovery] = await Promise.all([request('/backups'), request('/recovery')]); setBackups(history.backups); setTrash(recovery); }
  };
  useEffect(() => { let active = true; request('/access').then(async result => { if (!active) return; setError(''); setAccess(result); if (mode === 'security') { const rows = await request('/sessions'); if (active) setSessions(rows); } else if (result.owner) { const [history, recovery] = await Promise.all([request('/backups'), request('/recovery')]); if (active) { setBackups(history.backups); setTrash(recovery); } } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [mode, request]); // Each request is scoped to the signed-in administrator.
  const run = async action => { if (busy) return; setBusy(true); setError(''); setNotice(''); try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const security = settings.security || {}, backupSettings = settings.backups || {};
  const owner = access?.owner === true;
  const save = () => run(async () => { if (await onSave() === false) throw new Error('Settings could not be saved. Review the errors and try again.'); setNotice('Settings saved.'); });
  const restorePhrase = restore?.type === 'backup' ? 'RESTORE MISSING RECORDS' : 'RESTORE RECORD';
  const download = async id => {
    const response = await fetch(`${endpoint}/backups/${id}/download`, { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Download failed.'); }
    const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = `teamalpha-records-${id}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="security-recovery-panel">
    {error && <div className="studio-error" role="alert">{error}</div>}
    {notice && <p className="studio-muted" role="status">{notice}</p>}
    {mode === 'security' ? <>
      <section className="studio-card"><div className="studio-card-heading"><div><h2><ShieldCheck size={18} />Security policy</h2><p className="studio-muted">Timeouts and permissions are enforced by the server.</p></div></div>
        {!owner && <p className="studio-muted">Only the studio owner can change this policy. You can manage your own sessions below.</p>}
        <div className="studio-form-grid">
          <label className="studio-field">Sign out after inactivity (minutes)<input className="studio-input" type="number" min="5" max="1440" value={security.idleTimeoutMinutes ?? 60} disabled={!owner} onChange={e => onChange('security', 'idleTimeoutMinutes', Number(e.target.value))} /></label>
          <label className="studio-field">Maximum session length (hours)<input className="studio-input" type="number" min="1" max="168" value={security.absoluteSessionHours ?? 24} disabled={!owner} onChange={e => onChange('security', 'absoluteSessionHours', Number(e.target.value))} /></label>
          {Object.entries(permissionLabels).map(([key, label]) => <label className="studio-field" key={key}>{label}<select className="studio-input" value={security.permissions?.[key] || 'all_admins'} disabled={!owner} onChange={e => onChange('security', 'permissions', { ...security.permissions, [key]: e.target.value })}><option value="all_admins">All administrators</option><option value="owner_only">Studio owner only</option></select></label>)}
        </div><p className="studio-muted">Background synchronization does not count as user activity. Policy changes apply to existing sessions on their next request.</p>
        {owner && <button type="button" className="studio-button primary" disabled={busy || saving} onClick={save}>Save security policy</button>}
      </section>
      <section className="studio-card"><div className="studio-card-heading"><div><h2>Active sessions</h2><p className="studio-muted">Your signed-in browsers. Revoking a session ends its server access.</p></div><button className="studio-icon-button" type="button" disabled={busy} onClick={() => run(load)} aria-label="Refresh sessions"><RefreshCw size={17} /></button></div>
        <div className="security-session-list">{sessions.map(row => <div key={row.id}><div><strong>{row.current ? 'This browser' : 'Another browser'}</strong><small>{row.userAgent}</small><small>Signed in {date(row.createdAt)} · Last active {date(row.lastSeenAt)}</small></div><button type="button" className="studio-button" disabled={busy} onClick={() => run(async () => { await request('/sessions/' + row.id, 'DELETE'); if (row.current) logout(); else await load(); })}>{row.current ? 'Sign out' : 'Revoke'}</button></div>)}{access && !sessions.length && <p className="studio-muted">No active sessions to display.</p>}</div>
        <button type="button" className="studio-button danger" disabled={busy || !sessions.length} onClick={() => { if (window.confirm('Sign out of Studio OS on every device, including this browser?')) run(async () => { await request('/sessions/revoke-all', 'POST', { includeCurrent: true }); logout(); }); }}><LogOut size={16} />Sign out everywhere</button>
      </section>
    </> : <>
      {!owner ? <section className="studio-card"><h2>Backups & recovery</h2><p className="studio-muted">Only the studio owner can download or restore studio records.</p></section> : <>
        <section className="studio-card"><div className="studio-card-heading"><div><h2><Database size={18} />Business record backups</h2><p className="studio-muted">Encrypted snapshots are stored privately in MongoDB.</p></div></div>
          <div className="studio-form-grid"><label className="studio-field">Scheduled backups<select className="studio-input" value={backupSettings.enabled ? 'on' : 'off'} onChange={e => onChange('backups', 'enabled', e.target.value === 'on')}><option value="off">Off</option><option value="on">On</option></select></label><label className="studio-field">Frequency<select className="studio-input" value={backupSettings.frequency || 'daily'} onChange={e => onChange('backups', 'frequency', e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label className="studio-field">Retention (days)<input className="studio-input" type="number" min="1" max="365" value={backupSettings.retentionDays ?? 30} onChange={e => onChange('backups', 'retentionDays', Number(e.target.value))} /></label></div>
          <p className="studio-muted">Up to 30 snapshots, 8 MB and 5,000 records each. Includes studio settings, business records and media metadata; excludes photo/video files, accounts, passwords, OAuth connections and protected galleries. Keep the server recovery key safe. Downloads contain private business data.</p><p className="studio-muted">Scheduled jobs run when the server is awake and catch up once after downtime.</p>
          <div className="security-actions"><button type="button" className="studio-button primary" disabled={busy || saving} onClick={save}>Save backup settings</button><button type="button" className="studio-button" disabled={busy} onClick={() => run(async () => { await request('/backups', 'POST', {}); await load(); setNotice('Encrypted backup created.'); })}>Create backup now</button></div>
        </section>
        <section className="studio-card"><h2>Backup history</h2><div className="security-session-list">{backups.map(row => <div key={row._id}><div><strong>{date(row.createdAt)}</strong><small>{row.kind} · {Object.values(row.counts || {}).reduce((sum, count) => sum + count, 0)} records · expires {date(row.expiresAt)}</small></div><div className="security-actions"><button type="button" className="studio-button" disabled={busy} onClick={() => run(() => download(row._id))}><Download size={15} />Download</button><button type="button" className="studio-button" disabled={busy} onClick={() => { setRestore({ type: 'backup', id: row._id }); setConfirmation(''); }}>Restore missing</button></div></div>)}{!backups.length && <p className="studio-muted">No backups yet.</p>}</div></section>
        <section className="studio-card"><h2>Recovery bin</h2><p className="studio-muted">Deleted business records remain recoverable until their retention date.</p><div className="security-session-list">{trash.map(row => <div key={row._id}><div><strong>{row.label || row.model}</strong><small>{row.model} · Deleted {date(row.createdAt)} · expires {date(row.expiresAt)}</small></div><button type="button" className="studio-button" disabled={busy} onClick={() => { setRestore({ type: 'record', id: row._id }); setConfirmation(''); }}>Restore</button></div>)}{!trash.length && <p className="studio-muted">No deleted records to recover.</p>}</div></section>
        {restore && <section className="studio-card security-confirmation" aria-label="Confirm restore"><h2>Review restore</h2><p className="studio-muted">Only missing records are added. Existing records are never overwritten. A conflict rolls back the entire restore. Restored document reminders stay off and client links must be issued again.</p><label className="studio-field">Type {restorePhrase}<input className="studio-input" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label><div className="security-actions"><button type="button" className="studio-button" onClick={() => setRestore(null)}>Cancel</button><button type="button" className="studio-button primary" disabled={busy || confirmation !== restorePhrase} onClick={() => run(async () => { const result = await request((restore.type === 'backup' ? '/backups/' : '/recovery/') + restore.id + '/restore', 'POST', { confirmation }); setRestore(null); await load(); setNotice(`Restored ${result.inserted} missing records; ${result.skipped} existing records kept.`); })}>Confirm restore</button></div></section>}
      </>}
    </>}
  </div>;
}
