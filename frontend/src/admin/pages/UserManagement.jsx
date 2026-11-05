import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Edit3, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import API from '../../utils/apiConfig';
import { STUDIO_MODULE_GROUPS, STUDIO_MODULE_IDS, permittedModules, hasFullModuleAccess, canManageTeam, canEditTeamMember } from '../../utils/moduleAccess';
import { WorkspaceDialog, WorkspaceEmpty, WorkspaceError, WorkspaceHeader, WorkspaceSearch } from '../components/operations/WorkspaceUI';
import './studioSettings.css';

const blankMember = () => ({ firstName: '', lastName: '', email: '', password: '', moduleAccess: ['overview', 'projects', 'contacts', 'calendar'] });
const errorMessage = (error, fallback) => error?.response?.data?.msg || error?.response?.data?.error || fallback;

export default function UserManagement() {
  const { user: signedIn } = useAuth();
  const preview = signedIn?.isPreview === true;
  const [users, setUsers] = useState([]), [access, setAccess] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [accessError, setAccessError] = useState('');
  const [search, setSearch] = useState(''), [dialog, setDialog] = useState(null), [form, setForm] = useState(blankMember), [busy, setBusy] = useState(false), [formError, setFormError] = useState('');
  const actor = { ...signedIn, ...(access || {}), studioOwner: access?.owner === true || signedIn?.studioOwner === true };
  const manager = Boolean(access && canManageTeam(actor));
  const grantable = permittedModules(actor);
  const request = useCallback((method, path, data, signal) => axios({ method, url: API + path, data, signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }), []);
  const load = useCallback(signal => request('get', '/api/admin-users', undefined, signal)
    .then(result => {
      if (!Array.isArray(result.data)) throw new Error('Unexpected team response');
      setUsers(result.data.filter(member => member.role === 'admin')); setError('');
    }).catch(failure => { if (!axios.isCancel(failure)) setError(errorMessage(failure, 'The studio team could not be loaded. Please retry.')); })
    .finally(() => { if (!signal?.aborted) setLoading(false); }), [request]);
  const loadAccess = useCallback(signal => request('get', '/api/studio/security/access', undefined, signal)
    .then(result => { if (typeof result.data?.owner !== 'boolean') throw new Error(); setAccess(result.data); setAccessError(''); })
    .catch(failure => { if (!axios.isCancel(failure)) setAccessError('Account permissions could not be checked. Retry to restore team controls.'); }), [request]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    if (!preview) loadAccess(controller.signal);
    return () => controller.abort();
  }, [load, loadAccess, preview]);
  const open = (type, member) => {
    setForm(member ? { firstName: member.firstName || '', lastName: member.lastName || '', email: member.email || '', password: '', moduleAccess: permittedModules(member) } : { ...blankMember(), moduleAccess: blankMember().moduleAccess.filter(id => grantable.includes(id)) });
    setDialog({ type, member }); setFormError('');
  };
  const save = async event => {
    event.preventDefault(); if (busy || !manager || preview || (dialog.type !== 'create' && !canEditTeamMember(actor, dialog.member))) return;
    setBusy(true); setFormError('');
    try {
      const payload = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), role: 'admin', moduleAccess: hasFullModuleAccess(actor) && form.moduleAccess.length === STUDIO_MODULE_IDS.length ? null : form.moduleAccess, ...(form.password ? { password: form.password } : {}) };
      await request(dialog.type === 'create' ? 'post' : 'put', dialog.type === 'create' ? '/api/admin-users/create' : '/api/admin-users/' + dialog.member._id, payload);
      toast.success(dialog.type === 'create' ? 'Team member added' : 'Team member updated');
      setDialog(null); setForm(blankMember()); await load();
    } catch (failure) { setFormError(errorMessage(failure, 'The team member could not be saved.')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !manager || preview || (dialog.type !== 'create' && !canEditTeamMember(actor, dialog.member))) return;
    setBusy(true); setFormError('');
    try { await request('delete', '/api/admin-users/' + dialog.member._id); setDialog(null); toast.success('Team access removed'); await load(); }
    catch (failure) { setFormError(errorMessage(failure, 'Team access could not be removed.')); }
    finally { setBusy(false); }
  };
  const filtered = users.filter(member => [member.firstName, member.lastName, member.email].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="studio-team-page">
    <WorkspaceHeader title="Team & access" description="The people who keep your studio moving.">
      {(manager || preview) && <button type="button" className="studio-button primary" onClick={() => open('create')}><UserPlus size={16} />Add team member</button>}
    </WorkspaceHeader>
    <WorkspaceError error={error} retry={() => load()} /><WorkspaceError error={accessError} retry={() => loadAccess()} />
    {preview ? <p className="workspace-info">You’re viewing a sample team. Account changes are available in your connected Studio OS.</p> : access && !manager ? <div className="workspace-info" role="status"><ShieldCheck size={16} /><div><strong>Administrator · view-only team directory</strong><p>You can view your studio team here. Ask a team administrator to add or update sign-in accounts and assigned modules.</p></div></div> : !access && !accessError ? <p className="workspace-info" role="status">Checking account permissions…</p> : null}
    <section className="studio-card studio-team-directory">
      <div className="studio-card-heading"><div><h2>Studio team <span className="studio-inline-count">{users.length}</span></h2><p className="studio-card-subtitle">Administrator accounts with access to the studio workspace.</p></div><WorkspaceSearch value={search} onChange={setSearch} placeholder="Search team members…" /></div>
      {loading ? <WorkspaceEmpty loading /> : filtered.length ? <div className="studio-team-list">{filtered.map(member => {
        const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
        const self = String(member._id) === String(signedIn?._id || signedIn?.id);
        return <article className="studio-team-member" key={member._id}>
          <span className="studio-team-avatar" aria-hidden="true">{(member.firstName?.[0] || member.email?.[0] || '?').toUpperCase()}{member.lastName?.[0]?.toUpperCase()}</span>
          <div className="studio-team-identity"><h3>{name}{self && <span>You</span>}</h3><p>{member.email}</p></div>
          <span className="studio-badge">{member.studioOwner ? 'Studio owner' : hasFullModuleAccess(member) ? 'Full workspace' : permittedModules(member).length + ' modules'}</span>
          {manager && canEditTeamMember(actor, member) && <div className="studio-team-actions"><button type="button" className="studio-icon-button" disabled={preview} aria-label={'Edit ' + name} onClick={() => open('edit', member)}><Edit3 size={16} /></button><button type="button" className="studio-icon-button" disabled={preview || self} aria-label={'Remove access for ' + name} title={self ? 'You cannot remove your own access here' : 'Remove team access'} onClick={() => open('delete', member)}><Trash2 size={16} /></button></div>}
        </article>;
      })}</div> : <WorkspaceEmpty title={search ? 'No matching team members' : 'Your team starts here'} description={search ? 'Try a different name or email address.' : 'Add an administrator when you’re ready to share the workspace.'} />}
    </section>
    {dialog && dialog.type !== 'delete' && <WorkspaceDialog title={dialog.type === 'create' ? 'Add team member' : 'Edit team member'} onClose={() => !busy && setDialog(null)} onSubmit={save} busy={busy} error={formError} submitLabel={dialog.type === 'create' ? 'Add team member' : 'Save changes'} footer={preview ? <p className="studio-muted" role="status">Sample preview only. Connect your studio to save team accounts and access.</p> : undefined}>
      <div className="studio-form-grid">{[['First name', 'firstName'], ['Last name', 'lastName'], ['Email address', 'email'], [dialog.type === 'create' ? 'Sign-in password' : 'New password (optional)', 'password']].map(([label, key]) => <label key={key} className="studio-field">{label}<input className="studio-input" type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} required={key !== 'lastName' && (key !== 'password' || dialog.type === 'create')} minLength={key === 'password' ? 8 : undefined} maxLength={key === 'password' ? 256 : key === 'email' ? 254 : 120} autoComplete={key === 'password' ? 'new-password' : key === 'email' ? 'email' : key === 'firstName' ? 'given-name' : 'family-name'} value={form[key]} placeholder={key === 'password' && dialog.type === 'edit' ? 'Leave blank to keep the current password' : undefined} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}</div>
      <fieldset className="studio-team-modules"><legend>Workspace modules</legend><p className="studio-muted">Choose the areas this person can open. Unselected modules and their records stay hidden.</p><div className="studio-team-module-tools"><button type="button" className="studio-button small" onClick={() => setForm(previous => ({ ...previous, moduleAccess: grantable }))}>Select available</button><button type="button" className="studio-button small" onClick={() => setForm(previous => ({ ...previous, moduleAccess: [] }))}>Clear selection</button><span className="studio-muted">{form.moduleAccess.length} selected</span></div><div className="studio-team-module-grid">{STUDIO_MODULE_GROUPS.map(group => { const modules = group.modules.filter(([id]) => grantable.includes(id)); return modules.length ? <div key={group.label} className="studio-team-module-group"><h3>{group.label}</h3>{modules.map(([id, label]) => <label key={id}><input type="checkbox" checked={form.moduleAccess.includes(id)} onChange={event => setForm(previous => ({ ...previous, moduleAccess: event.target.checked ? [...previous.moduleAccess, id] : previous.moduleAccess.filter(value => value !== id) }))} /><span>{label}</span></label>)}</div> : null; })}</div>{!hasFullModuleAccess(actor) && <p className="studio-muted">You can assign only modules available to your account. Only another administrator can change your own access.</p>}</fieldset>
      <p className="studio-muted">This account can use the internal studio workspace. {dialog.type === 'edit' ? 'Changing a password signs that member out on their devices.' : 'Share sign-in details privately with your team member.'}</p>
    </WorkspaceDialog>}
    {dialog?.type === 'delete' && <WorkspaceDialog title="Remove team access?" busy={busy} error={formError} onClose={() => !busy && setDialog(null)} footer={<><button type="button" className="studio-button" disabled={busy} onClick={() => setDialog(null)}>Keep member</button><button type="button" className="studio-button danger" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove access'}</button></>}><p>{dialog.member.firstName || dialog.member.email} will be signed out and will no longer be able to access Studio OS. Existing studio business records are kept.</p></WorkspaceDialog>}
  </div>;
}
