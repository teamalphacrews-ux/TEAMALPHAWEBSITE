import { useEffect, useState } from 'react';
import { Save, Building2, Palette, Wallet, Bell, Mail, Workflow, Eye, ShieldCheck, Database, Plug } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { WorkspaceHeader, WorkspaceError, WorkspaceEmpty } from '../components/operations/WorkspaceUI';
import { useWorkspaceData, workspaceRequest, recordError } from '../components/operations/workspaceData';
import StudioAppIcon from '../components/common/StudioAppIcon';
import SettingsEditor from '../components/settings/SettingsEditor';
import SecurityRecoveryPanel from '../components/settings/SecurityRecoveryPanel';
import defaults from '../studio-settings-defaults.json' with { type: 'json' };
import API from '../../utils/apiConfig';
import './studioSettings.css';

const sections = [
  ['profile', 'Studio profile', 'Identity and contact details', Building2, 'blue'],
  ['branding', 'Branding', 'Your documents and studio image', Palette, 'violet'],
  ['billing', 'Billing & documents', 'Numbering, tax and payment plans', Wallet, 'green'],
  ['automation', 'Automation & reminders', 'Approvals and notifications', Bell, 'amber'],
  ['communication', 'Communication', 'Email and support hours', Mail, 'cyan'],
  ['production', 'Production templates', 'Repeatable delivery workflows', Workflow, 'indigo'],
  ['client', 'Client experience', 'Shared links and visibility', Eye, 'rose'],
  ['security', 'Security & access', 'Permissions and signed-in devices', ShieldCheck, 'slate'],
  ['backups', 'Backups & recovery', 'Protect and restore studio records', Database, 'blue'],
  ['connections', 'Connections', 'Gmail, Calendar and channels', Plug, 'violet'],
];
function withDefaults(saved) {
  const value = { ...saved };
  for (const key of Object.keys(defaults)) value[key] = { ...structuredClone(defaults[key]), ...(saved[key] || {}) };
  value.security.permissions = { ...defaults.security.permissions, ...(saved.security?.permissions || {}) };
  return value;
}
export default function Settings() {
  const { data, loading, error, reload } = useWorkspaceData(['/api/studio/settings']);
  const [form, setForm] = useState(null), [baseline, setBaseline] = useState(null), [busy, setBusy] = useState(false), [saveError, setSaveError] = useState(''), [tab, setTab] = useState('profile'), [access, setAccess] = useState(null);
  const saved = data[0];
  const values = form || (saved ? withDefaults(saved) : null);
  const dirty = Boolean(form && JSON.stringify(form) !== JSON.stringify(baseline || (saved && withDefaults(saved))));
  const current = sections.find(section => section[0] === tab);
  const change = (key, value) => setForm(previous => ({ ...(previous || withDefaults(saved)), [key]: value }));
  const changeNested = (group, key, value) => setForm(previous => {
    const base = previous || withDefaults(saved);
    return { ...base, [group]: { ...base[group], [key]: value } };
  });
  useEffect(() => {
    const controller = new AbortController();
    axios.get(API + '/api/studio/security/access', { signal: controller.signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(result => setAccess(result.data)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const saveSettings = async event => {
    event?.preventDefault();
    if (busy || !values) return;
    setBusy(true); setSaveError('');
    try {
      const payload = { ...values, quotationValidityDays: Number(values.quotationValidityDays) };
      if (!access?.owner) { delete payload.security; delete payload.backups; }
      const result = await workspaceRequest('put', '/api/studio/settings', payload);
      const normalized = withDefaults(result);
      setForm(normalized); setBaseline(normalized);
      window.dispatchEvent(new CustomEvent('studio-settings-updated', { detail: result }));
      toast.success('Studio settings saved'); return result;
    } catch (failure) { setSaveError(recordError(failure)); throw failure; }
    finally { setBusy(false); }
  };
  return <div className="studio-settings-page">
    <WorkspaceHeader title="Studio settings" description="Your studio identity, working preferences and connections."><span className="studio-badge">INR · Asia/Kolkata</span></WorkspaceHeader>
    <WorkspaceError error={error} retry={reload} /><WorkspaceError error={saveError} />
    {loading || !values ? <WorkspaceEmpty loading={loading} /> : <div className="settings-layout">
      <nav className="settings-navigation" aria-label="Settings sections">{sections.map(([id, title, description, icon, tone]) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><StudioAppIcon icon={icon} tone={tone} size={29} /><span><strong>{title}</strong><small>{description}</small></span></button>)}</nav>
      <label className="studio-field settings-mobile-navigation">Settings section<select className="studio-input" value={tab} onChange={event => setTab(event.target.value)}>{sections.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <div className="settings-content">{['security', 'backups'].includes(tab) ? <SecurityRecoveryPanel mode={tab} settings={values} access={access} onChange={changeNested} onSave={saveSettings} saving={busy} /> : <form onSubmit={event => { saveSettings(event).catch(() => {}); }} className="studio-card settings-editor">
        <div className="settings-section-heading"><h2>{current[1]}</h2><p>{current[2]}.</p></div>
        <SettingsEditor tab={tab} values={values} change={change} changeNested={changeNested} />
        {tab !== 'connections' && <div className="settings-editor-footer"><span role="status">{dirty && <i className="settings-unsaved-dot" aria-hidden="true" />}{dirty ? 'You have unsaved changes.' : 'Your preferences are up to date.'}</span><button type="submit" className="studio-button primary" disabled={busy || !dirty}><Save size={15} />{busy ? 'Saving…' : 'Save settings'}</button></div>}
      </form>}</div>
    </div>}
  </div>;
}
