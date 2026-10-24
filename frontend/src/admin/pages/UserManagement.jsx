import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Edit3, Eye, EyeOff, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import API from '../../utils/apiConfig';
import { WorkspaceDialog, WorkspaceEmpty, WorkspaceError, WorkspaceHeader, WorkspaceSearch } from '../components/operations/WorkspaceUI';
import './studioSettings.css';

const blankMember = () => ({ firstName: '', lastName: '', email: '', password: '' });
const errorMessage = (error, fallback) => error?.response?.data?.msg || error?.response?.data?.error || fallback;

export default function UserManagement() {
  const { user: signedIn } = useAuth();
  const preview = signedIn?.isPreview === true;
  const [users, setUsers] = useState([]), [access, setAccess] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [accessError, setAccessError] = useState('');
  const [search, setSearch] = useState(''), [dialog, setDialog] = useState(null), [form, setForm] = useState(blankMember), [busy, setBusy] = useState(false), [formError, setFormError] = useState(''), [visiblePasswords, setVisiblePasswords] = useState({});
  const owner = access?.owner === true;
  const request = useCallback((method, path, data, signal) => axios({ method, url: API + path, data, signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }), []);
  const load = useCallback(signal => request('get', '/api/admin-users', undefined, signal)
    .then(result => {
      if (!Array.isArray(result.data)) throw new Error('Unexpected team response');
      setUsers(result.data.filter(member => member.role === 'admin')); setError('');
    }).catch(failure => { if (!axios.isCancel(failure)) setError(errorMessage(failure, 'The studio team could not be loaded. Please retry.')); })
    .finally(() => { if (!signal?.aborted) setLoading(false); }), [request]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    if (!preview) request('get', '/api/studio/security/access', undefined, controller.signal)
      .then(result => { if (typeof result.data?.owner !== 'boolean') throw new Error(); setAccess(result.data); setAccessError(''); })
      .catch(failure => { if (!axios.isCancel(failure)) setAccessError('Account permissions could not be checked. Team changes are unavailable until this connection is restored.'); });
    return () => controller.abort();
  }, [load, preview, request]);
  const open = (type, member) => {
    setForm(member ? { firstName: member.firstName || '', lastName: member.lastName || '', email: member.email || '', password: '' } : blankMember());
    setDialog({ type, member }); setFormError('');
  };
  const save = async event => {
    event.preventDefault(); if (busy || !owner || preview) return;
    setBusy(true); setFormError('');
    try {
      const payload = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), role: 'admin', ...(form.password ? { password: form.password } : {}) };
      await request(dialog.type === 'create' ? 'post' : 'put', dialog.type === 'create' ? '/api/admin-users/create' : '/api/admin-users/' + dialog.member._id, payload);
      toast.success(dialog.type === 'create' ? 'Team member added' : 'Team member updated');
      setDialog(null); setForm(blankMember()); setVisiblePasswords({}); await load();
    } catch (failure) { setFormError(errorMessage(failure, 'The team member could not be saved.')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !owner || preview) return;
    setBusy(true); setFormError('');
    try { await request('delete', '/api/admin-users/' + dialog.member._id); setDialog(null); setVisiblePasswords({}); toast.success('Team access removed'); await load(); }
    catch (failure) { setFormError(errorMessage(failure, 'Team access could not be removed.')); }
    finally { setBusy(false); }
  };
  const filtered = users.filter(member => [member.firstName, member.lastName, member.email].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="studio-team-page">
    <WorkspaceHeader title="Team & access" description="The people who keep your studio moving.">
      <button type="button" className="studio-button primary" onClick={() => open('create')} disabled={!owner || preview}><UserPlus size={16} />Add team member</button>
    </WorkspaceHeader>
    <WorkspaceError error={error} retry={() => load()} /><WorkspaceError error={accessError} />
    {preview ? <p className="workspace-info">You’re viewing a sample team. Account changes are available in your connected Studio OS.</p> : access && !owner ? <p className="workspace-info"><ShieldCheck size={16} />Only the studio owner can add or change team access.</p> : null}
    <section className="studio-card studio-team-directory">
      <div className="studio-card-heading"><div><h2>Studio team <span className="studio-inline-count">{users.length}</span></h2><p className="studio-card-subtitle">Administrator accounts with access to the studio workspace.</p></div><WorkspaceSearch value={search} onChange={setSearch} placeholder="Search team members…" /></div>
      {loading ? <WorkspaceEmpty loading /> : filtered.length ? <div className="studio-team-list">{filtered.map(member => {
        const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
        const self = String(member._id) === String(signedIn?._id || signedIn?.id);
        return <article className="studio-team-member" key={member._id}>
          <span className="studio-team-avatar" aria-hidden="true">{(member.firstName?.[0] || member.email?.[0] || '?').toUpperCase()}{member.lastName?.[0]?.toUpperCase()}</span>
          <div className="studio-team-identity"><h3>{name}{self && <span>You</span>}</h3><p>{member.email}</p></div>
          <span className="studio-badge">Administrator</span>
          {owner && member.plainPassword && member.plainPassword !== 'Error' && <div className="studio-team-password"><span className="studio-team-password-value">{visiblePasswords[member._id] ? member.plainPassword : '••••••••'}</span><button type="button" className="studio-icon-button" aria-label={(visiblePasswords[member._id] ? 'Hide' : 'Show') + ' saved password for ' + name} aria-pressed={Boolean(visiblePasswords[member._id])} onClick={() => setVisiblePasswords(previous => ({ ...previous, [member._id]: !previous[member._id] }))}>{visiblePasswords[member._id] ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>}
          {owner && <div className="studio-team-actions"><button type="button" className="studio-icon-button" disabled={preview} aria-label={'Edit ' + name} onClick={() => open('edit', member)}><Edit3 size={16} /></button><button type="button" className="studio-icon-button" disabled={preview || self} aria-label={'Remove access for ' + name} title={self ? 'You cannot remove your own access here' : 'Remove team access'} onClick={() => open('delete', member)}><Trash2 size={16} /></button></div>}
        </article>;
      })}</div> : <WorkspaceEmpty title={search ? 'No matching team members' : 'Your team starts here'} description={search ? 'Try a different name or email address.' : 'Add an administrator when you’re ready to share the workspace.'} />}
    </section>
    {dialog && dialog.type !== 'delete' && <WorkspaceDialog title={dialog.type === 'create' ? 'Add team member' : 'Edit team member'} onClose={() => !busy && setDialog(null)} onSubmit={save} busy={busy} error={formError} submitLabel={dialog.type === 'create' ? 'Add team member' : 'Save changes'}>
      <div className="studio-form-grid">{[['First name', 'firstName'], ['Last name', 'lastName'], ['Email address', 'email'], [dialog.type === 'create' ? 'Sign-in password' : 'New password (optional)', 'password']].map(([label, key]) => <label key={key} className="studio-field">{label}<input className="studio-input" type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} required={key !== 'lastName' && (key !== 'password' || dialog.type === 'create')} minLength={key === 'password' ? 8 : undefined} maxLength={key === 'password' ? 256 : key === 'email' ? 254 : 120} autoComplete={key === 'password' ? 'new-password' : key === 'email' ? 'email' : key === 'firstName' ? 'given-name' : 'family-name'} value={form[key]} placeholder={key === 'password' && dialog.type === 'edit' ? 'Leave blank to keep the current password' : undefined} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}</div>
      <p className="studio-muted">This account can use the internal studio workspace. {dialog.type === 'edit' ? 'Changing a password signs that member out on their devices.' : 'Share sign-in details privately with your team member.'}</p>
    </WorkspaceDialog>}
    {dialog?.type === 'delete' && <WorkspaceDialog title="Remove team access?" busy={busy} error={formError} onClose={() => !busy && setDialog(null)} footer={<><button type="button" className="studio-button" disabled={busy} onClick={() => setDialog(null)}>Keep member</button><button type="button" className="studio-button danger" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove access'}</button></>}><p>{dialog.member.firstName || dialog.member.email} will be signed out and will no longer be able to access Studio OS. Existing studio business records are kept.</p></WorkspaceDialog>}
  </div>;
}
