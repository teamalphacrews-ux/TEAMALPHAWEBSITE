import StudioButton from '../components/common/StudioButton';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Search, X, ArrowLeft, ChevronRight, RotateCcw, SlidersHorizontal, Building2, Palette, Wallet, Bell, Mail, Workflow, Eye, ShieldCheck, Database, Plug, Languages, Volume2, Moon, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { WorkspaceError, WorkspaceEmpty } from '../components/operations/WorkspaceUI';
import { OperationsModal } from '../components/operations/OperationsUI';
import { useWorkspaceData, workspaceRequest, recordError } from '../components/operations/workspaceData';
import { useAuth } from '../../context/AuthContext';
import StudioAppIcon from '../components/common/StudioAppIcon';
import SettingsEditor from '../components/settings/SettingsEditor';
import { SettingsDisclosures } from '../components/settings/SettingsDisclosures';
import WorkspacePreferences from '../components/settings/WorkspacePreferences';
import LocalePreferences from '../components/settings/LocalePreferences';
import NotificationPreferences from '../components/settings/NotificationPreferences';
import { useStudioPreferences } from '../components/common/StudioPreferences';
import { studioText } from '../../utils/studioTranslations';
import { formatWorkspaceTime } from '../../utils/workspaceLocale';
import { studioImageUrl } from '../../utils/studioIdentity';
import NativeDeviceSettings from '../../native/NativeDeviceSettings';
import SecurityRecoveryPanel from '../components/settings/SecurityRecoveryPanel';
import { settingsWithDefaults, changedSettingsSections, settingsSectionKeys, restoreSettingsSection } from '../../utils/settingsEditorState';
import './studioSettings.css';
import './settingsGrouped.css';

const sections = [
  ['workspace', 'My workspace', 'Appearance, motion and your overview.', SlidersHorizontal, 'violet', 'Personal', 'dark light daylight system theme animations reduced motion homepage landing dashboard cards order reset'],
  ['language', 'Language & region', 'Choose your language, date formats and time zone.', Languages, 'blue', 'Personal', 'Indian Hindi Bengali Marathi Telugu Tamil Gujarati Urdu Kannada Odia Malayalam English country region locale timezone date time numbers'],
  ['notifications', 'Sound & notifications', 'Choose what gets your attention and when.', Volume2, 'rose', 'Personal', 'sound volume tone chime bell notification badge banner quiet hours do not disturb alerts mute'],
  ['device', 'App & device', 'Privacy lock, push alerts and offline drafts.', Smartphone, 'blue', 'Personal', 'Face ID Touch ID passcode offline drafts push iPhone app privacy'],
  ['profile', 'Studio profile', 'Your business identity and contact details.', Building2, 'blue', 'Studio', 'name legal GSTIN tax photo address phone email website whatsapp instagram facebook social'],
  ['branding', 'Brand & documents', 'Make every client document feel like your studio.', Palette, 'violet', 'Studio', 'logo cover image colour color typography font preview'],
  ['billing', 'Billing & payments', 'Document references, amounts and payment plans.', Wallet, 'green', 'Studio', 'invoice quotation numbering prefix discount tax GST bank UPI installments milestones financial year due date'],
  ['automation', 'Reminders & alerts', 'Keep clients and your team up to date.', Bell, 'amber', 'Workflow', 'auto create invoice approval quotation validity expiry notifications briefing daily digest payment reminder'],
  ['communication', 'Email & messages', 'A consistent voice for every client conversation.', Mail, 'cyan', 'Workflow', 'sender reply subject support hours terms deliverables mail test SMTP'],
  ['production', 'Production templates', 'Reusable checklists for thoughtful delivery.', Workflow, 'indigo', 'Workflow', 'photos album traditional video cinematic film stages tasks deadlines'],
  ['client', 'Client smart links', 'Choose what clients see in new shared documents.', Eye, 'rose', 'Workflow', 'visibility crew progress deliverables payment invoice schedule support chat expire link'],
  ['connections', 'Connections', 'Find your studio channels and connected tools.', Plug, 'violet', 'Workspace management', 'Gmail Google Calendar integrations website enquiry webhook whatsapp team'],
  ['security', 'Security & access', 'Control access and manage signed-in devices.', ShieldCheck, 'slate', 'Workspace management', 'permissions password sessions devices sign out timeout owner policy'],
  ['backups', 'Backups & recovery', 'Protect your records and recover deleted work.', Database, 'blue', 'Workspace management', 'restore export download retention bin trash'],
].map(([id, title, description, icon, tone, group, keywords]) => ({ id, title, description, icon, tone, group, keywords }));

export default function Settings() {
  const { data, loading, error, reload } = useWorkspaceData(['/api/studio/settings']);
  const { user } = useAuth();
  const { preferences, resolvedTheme, update } = useStudioPreferences();
  const t = text => studioText(preferences.language, text);
  const [params, setParams] = useSearchParams(), navigate = useNavigate();
  const [form, setForm] = useState(null), [baseline, setBaseline] = useState(null);
  const [busy, setBusy] = useState(false), [saveError, setSaveError] = useState('');
  const [query, setQuery] = useState(''), [confirmation, setConfirmation] = useState(null), [savedAt, setSavedAt] = useState(null);
  const saveLock = useRef(false), heading = useRef(null), pageTop = useRef(null);
  const saved = data[0], original = baseline || (saved ? settingsWithDefaults(saved) : null), values = form || original;
  const changed = values && original ? changedSettingsSections(values, original) : [];
  const dirty = changed.length > 0;
  const tab = sections.some(section => section.id === params.get('section')) ? params.get('section') : null;
  const current = sections.find(section => section.id === tab);
  const personalSection = current?.group === 'Personal';
  const matching = sections.filter(section => query.trim().toLowerCase().split(/\s+/).every(word => (section.title + ' ' + t(section.title) + ' ' + section.description + ' ' + section.keywords).toLowerCase().includes(word)));
  const change = (key, value) => { if (!saveLock.current) setForm(previous => ({ ...(previous || original), [key]: value })); };
  const changeNested = (group, key, value) => { if (!saveLock.current) setForm(previous => { const base = previous || original; return { ...base, [group]: { ...base[group], [key]: value } }; }); };
  const selectSection = id => {
    setParams(previous => { const next = new URLSearchParams(previous); if (id) next.set('section', id); else next.delete('section'); return next; }, { replace: true });
    setQuery('');
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      pageTop.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    const guardLink = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === '/admin/settings') return;
      event.preventDefault(); event.stopPropagation();
      if (!saveLock.current) setConfirmation({ kind: 'leave', destination: url.pathname + url.search + url.hash });
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLink, true); };
  }, [dirty]);
  const saveSettings = async event => {
    event?.preventDefault();
    if (saveLock.current || !values) return false;
    if (!dirty) return values;
    saveLock.current = true; setBusy(true); setSaveError('');
    try {
      const payload = { ...values, quotationValidityDays: Number(values.quotationValidityDays) };
      // Never silently drop edited policies. The server authorizes protected groups.
      for (const group of ['security', 'backups']) if (!changed.includes(group)) delete payload[group];
      const result = await workspaceRequest('put', '/api/studio/settings', payload);
      if (typeof result?.studioName !== 'string') throw new Error('The studio did not confirm your settings. Please retry.');
      const normalized = settingsWithDefaults(result);
      setForm(normalized); setBaseline(normalized); setSavedAt(new Date());
      window.dispatchEvent(new CustomEvent('studio-settings-updated', { detail: result }));
      toast.success(user?.isPreview ? 'Saved in this sample session' : 'Studio settings saved');
      return result;
    } catch (failure) { setSaveError(recordError(failure)); throw failure; }
    finally { saveLock.current = false; setBusy(false); }
  };
  const discard = () => {
    if (confirmation.kind === 'section') setForm(restoreSettingsSection(values, original, confirmation.section));
    else { setForm(original); if (confirmation.kind === 'leave') navigate(confirmation.destination); }
    setSaveError(''); setConfirmation(null);
  };
  const groupNames = ['Personal', 'Studio', 'Workflow', 'Workspace management'];
  const browsing = !current || Boolean(query.trim());
  const rowValues = { workspace: preferences.theme === 'system' ? 'Device' : resolvedTheme === 'dark' ? 'Dark' : 'Daylight', notifications: preferences.notificationSound ? 'Sound on' : 'Silent' };
  const accountName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const sectionLink = (section, compact = false) => <button type="button" key={section.id} className={'settings-directory-link' + (compact ? ' is-compact' : '') + (tab === section.id ? ' is-current' : '')} aria-current={tab === section.id ? 'page' : undefined} onClick={() => selectSection(section.id)}>
    {!compact && <StudioAppIcon icon={section.icon} tone={section.tone} size={34} />}
    <span className="settings-row-label"><strong lang={preferences.language} dir="auto">{t(section.title)}</strong>{!compact && <small>{section.description}</small>}</span>
    {!compact && rowValues[section.id] && <span className="settings-row-value">{rowValues[section.id]}</span>}
    {changed.includes(section.id) && <span className="settings-unsaved-dot" aria-label="Unsaved changes" />}
    <ChevronRight size={16} aria-hidden="true" />
  </button>;
  const saveAll = () => {
    const activeForm = document.getElementById('studio-settings-form');
    if (activeForm && !activeForm.reportValidity()) return;
    if (!activeForm) {
      for (const input of document.querySelectorAll('.settings-content .settings-edit-fields input, .settings-content .settings-edit-fields select')) if (!input.reportValidity()) return;
    }
    saveSettings().catch(() => {});
  };
  return <div className={'studio-settings-page settings-grouped' + (browsing ? ' is-browsing' : ' is-editing')} ref={pageTop}>
    <header className="settings-page-title"><h1>{t("Settings")}</h1><p>Your studio. Your way.</p></header>
    {values && !current && !query.trim() && <button type="button" className="settings-profile-tile" onClick={() => selectSection('profile')}>
      <img src={studioImageUrl(values.profilePhotoUrl || values.logoUrl)} alt="" />
      <span><strong>{values.studioName || 'Your studio'}</strong><small>{accountName || 'Studio account'} · Studio profile</small></span><ChevronRight size={21} aria-hidden="true" />
    </button>}
    <div className="settings-search-row"><label className="settings-search"><Search size={20} aria-hidden="true" /><input type="search" aria-label="Find a setting" placeholder="Search settings" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear settings search" onClick={() => setQuery('')}><X size={18} /></button>}</label></div>
    <WorkspaceError error={error} retry={reload} />
    {loading || !values ? <WorkspaceEmpty loading={loading} title="Settings unavailable" description="Retry loading your studio preferences." /> : <>
      {browsing ? <section className="settings-directory" aria-label="All settings" ref={heading} tabIndex={-1}>
        {query.trim() ? <div className="settings-results">
          <div className="settings-results-heading"><h2>Search results</h2><span role="status">{matching.length} {matching.length === 1 ? 'section' : 'sections'} found</span></div>
          {matching.length ? <div className="settings-results-list">{matching.map(section => sectionLink(section))}</div> : <div className="settings-search-empty"><Search size={24} /><h3>No matching settings</h3><p>Try “payments”, “logo”, “notifications” or “language”.</p><button type="button" className="studio-button" onClick={() => setQuery('')}>Browse all settings</button></div>}
        </div> : <>
          <div className="settings-directory-grid">{groupNames.map(group => <section className="settings-category" key={group}>
            <header><h2>{t(group)}</h2></header>
            <div className="settings-grouped-rows">{group === 'Personal' && <label className="settings-quick-theme studio-switch-control">
              <StudioAppIcon icon={Moon} tone="indigo" size={34} /><span className="settings-row-label"><strong>Dark mode</strong></span>
              <input type="checkbox" role="switch" aria-label="Dark mode" checked={resolvedTheme === 'dark'} onChange={event => update({ theme: event.target.checked ? 'dark' : 'light' }, { origin: event.currentTarget.closest('label') })} /><span className="studio-switch-track" aria-hidden="true" />
            </label>}{sections.filter(section => section.group === group).map(section => sectionLink(section))}</div>
          </section>)}</div>
          <p className="settings-directory-note">Personal preferences apply to your account. Studio settings are shared with your team.</p>
        </>}
      </section> : <>
        <div className="settings-detail-toolbar"><button type="button" className="settings-back-button" onClick={() => selectSection(null)}><ArrowLeft size={17} />All settings</button><span className="settings-scope-note">{personalSection ? 'Applies to you' : 'Shared with your studio'}</span></div>
        <div className="settings-layout">
          <aside className="settings-rail"><nav aria-label={current.group + ' settings'}><p className="settings-rail-title">{t(current.group)}</p>{sections.filter(section => section.group === current.group).map(section => sectionLink(section, true))}</nav><button type="button" className="settings-rail-browse" onClick={() => selectSection(null)}>Browse all settings<ChevronRight size={14} /></button></aside>
          <div className="settings-content">
            <header className="settings-section-heading"><StudioAppIcon icon={current.icon} tone={current.tone} size={40} /><div><span className="settings-section-eyebrow">{t(current.group)}</span><h2 tabIndex={-1} ref={heading} lang={preferences.language} dir="auto">{t(current.title)}</h2><p>{current.description}</p></div></header>
            <SettingsDisclosures key={tab}>
              {tab === 'device' ? <NativeDeviceSettings /> : tab === 'workspace' ? <WorkspacePreferences /> : tab === 'language' ? <LocalePreferences studioTimezone={values.timezone} /> : tab === 'notifications' ? <NotificationPreferences /> : ['security', 'backups'].includes(tab) ? <fieldset className="settings-edit-fields" disabled={busy}><SecurityRecoveryPanel mode={tab} settings={values} onChange={changeNested} /></fieldset> : <form id="studio-settings-form" onSubmit={event => { saveSettings(event).catch(() => {}); }} className="settings-editor"><fieldset className="settings-edit-fields" disabled={busy}><SettingsEditor tab={tab} values={values} change={change} changeNested={changeNested} /></fieldset></form>}
            </SettingsDisclosures>
            {settingsSectionKeys[tab] && <div className="settings-section-tools"><span>{changed.includes(tab) ? 'This section has unsaved changes.' : savedAt ? 'Saved at ' + formatWorkspaceTime(savedAt, preferences, values.timezone) : 'Changes apply after saving.'}</span><button type="button" className="settings-text-button" disabled={busy || !changed.includes(tab)} onClick={() => setConfirmation({ kind: 'section', section: tab })}><RotateCcw size={13} />Revert section</button></div>}
          </div>
        </div>
      </>}
      <WorkspaceError error={saveError} />
      {dirty && <footer className="settings-save-bar has-changes"><div role="status"><span className="settings-save-symbol"><span className="settings-unsaved-dot" /></span><span><strong>{busy ? 'Saving changes…' : changed.length + (changed.length === 1 ? ' section' : ' sections') + ' with unsaved changes'}</strong><small>{changed.map(id => sections.find(section => section.id === id)?.title).join(' · ')}</small></span></div><div className="settings-save-actions"><button type="button" className="studio-button" disabled={busy} onClick={() => setConfirmation({ kind: 'all' })}>{t("Discard")}</button><StudioButton type="button" variant="primary" icon={Save} loading={busy} onClick={saveAll} loadingLabel="Saving all studio settings">Save all changes</StudioButton></div></footer>}
    </>}
    {confirmation && <OperationsModal title={confirmation.kind === 'leave' ? 'Leave without saving?' : confirmation.kind === 'section' ? 'Revert this section?' : 'Discard unsaved changes?'} onClose={() => setConfirmation(null)} footer={<><button type="button" className="studio-button" onClick={() => setConfirmation(null)}>Keep editing</button><button type="button" className="studio-button primary" onClick={discard}>{confirmation.kind === 'leave' ? 'Discard & leave' : 'Discard changes'}</button></>}><p className="studio-muted">{confirmation.kind === 'section' ? 'Restore ' + (sections.find(section => section.id === confirmation.section)?.title || 'this section').toLowerCase() + ' to its last saved values. Changes in other sections will stay.' : 'Only unsaved studio settings will be discarded. Your saved settings, personal preferences and project records will stay.'}</p></OperationsModal>}
  </div>;
}
