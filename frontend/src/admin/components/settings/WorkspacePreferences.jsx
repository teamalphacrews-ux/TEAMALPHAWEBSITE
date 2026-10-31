import StudioSelect from '../common/StudioSelect';
import { createElement, useId, useState } from 'react';
import { Sun, Moon, Monitor, SlidersHorizontal, RotateCcw, Check, Cloud, RefreshCw } from 'lucide-react';
import { useStudioPreferences } from '../common/StudioPreferences';
import OverviewCustomizer from '../common/OverviewCustomizer';
import { SettingsToggle } from './SettingsEditor';
import { SettingsGroup } from './SettingsDisclosures';
import { Link } from 'react-router-dom';
import { STUDIO_LANDING_PAGES, OVERVIEW_CARDS } from '../../../utils/overviewPreferences';

const themes = [
  { value: 'light', label: 'Daylight', description: 'Clean white surfaces', icon: Sun },
  { value: 'dark', label: 'Dark gray', description: 'A softer evening workspace', icon: Moon },
  { value: 'system', label: 'Use device setting', description: 'Changes with your device', icon: Monitor },
];
const syncMessages = {
  loading: 'Loading your personal preferences…',
  saving: 'Saving your personal preferences…',
  saved: 'Saved to your Studio OS account.',
  local: 'Saved on this device. Account sync is unavailable.',
  preview: 'Saved on this device for this sample preview.',
  memory: 'Applied for now. Preferences could not be saved; keep this page open and retry.',
};

export default function WorkspacePreferences() {
  const { preferences, update, resetPreferences, syncState, retrySave } = useStudioPreferences();
  const [customizing, setCustomizing] = useState(false), [confirmReset, setConfirmReset] = useState(false), [notice, setNotice] = useState('');
  const themeGroup = useId();
  return <div className="settings-pref-panel">
    <div className="settings-pref-status" role="status"><Cloud size={17} aria-hidden="true" /><span>{syncMessages[syncState] || syncMessages.loading}</span>{['local', 'memory'].includes(syncState) && <button type="button" className="studio-button small" onClick={retrySave}><RefreshCw size={14} />Retry sync</button>}</div>
    <SettingsGroup defaultOpen className="settings-pref-section" title="Appearance & motion" description="Choose a theme and how your workspace moves.">
      <fieldset className="settings-pref-themes"><legend className="studio-sr-only">Workspace appearance</legend>{themes.map(({ value, label, description, icon }) => <label key={value} className={'settings-pref-theme' + (preferences.theme === value ? ' is-selected' : '')}>
        <input type="radio" name={themeGroup} value={value} checked={preferences.theme === value} onChange={event => update({ theme: value }, { origin: event.currentTarget.closest('label') })} />
        <span className={'settings-pref-theme-preview is-' + value} aria-hidden="true"><i /><span><i /><i /><i /></span>{createElement(icon, { size: 20 })}</span>
        <span className="settings-pref-theme-label"><strong>{label}</strong>{preferences.theme === value && <Check size={16} aria-hidden="true" />}</span><small>{description}</small>
      </label>)}</fieldset>
      <SettingsToggle label="Reduce motion" description="Keep dashboard cards and transitions still. Your device’s reduced-motion preference is always respected." value={preferences.reduceMotion} onChange={reduceMotion => update({ reduceMotion })} />
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Phone layout & overview" description="Keep your daily workspace focused.">
      <label className="studio-field">Bottom navigation<StudioSelect title="Bottom navigation" className="studio-input" value={preferences.mobileTab} onChange={event => update({mobileTab:event.target.value})}><option value="projects">Show Projects</option><option value="finance">Show Finance</option></StudioSelect></label>
      <label className="studio-field">Overview opens in<StudioSelect title="Overview opens in" className="studio-input" value={preferences.overviewMode} onChange={event => update({overviewMode:event.target.value})}><option value="today">Today · Work and next actions</option><option value="insights">Insights · Charts and custom cards</option></StudioSelect></label>
      <label className="studio-field">Text size<StudioSelect title="Text size" className="studio-input" value={preferences.textSize} onChange={event => update({textSize:event.target.value})}><option value="compact">Compact</option><option value="comfortable">Larger text</option></StudioSelect></label>
      <SettingsToggle label="Photography tips card" description="Show rotating tips and business encouragement in Overview." value={preferences.showInspiration} onChange={showInspiration=>update({showInspiration})}/>
      <SettingsToggle label="Weekly activity strip" description="Show your activity streak between insight cards." value={preferences.showActivityStreak} onChange={showActivityStreak=>update({showActivityStreak})}/>
      <Link className="studio-button" to="/admin/offline-drafts">Open offline drafts</Link>
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Start page" description="Choose the page that opens after sign-in.">
      <div className="settings-pref-row"><label className="studio-field settings-pref-start"><span>Start page</span><StudioSelect title="Start page" className="studio-input" value={preferences.landingPage} onChange={event => update({ landingPage: event.target.value })}>{STUDIO_LANDING_PAGES.map(page => <option value={page.value} key={page.value}>{page.label}</option>)}</StudioSelect></label></div>
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Overview cards" description="Show, hide and reorder your dashboard cards.">
      <div className="settings-pref-row"><div><p>{preferences.visibleCards.length} of {OVERVIEW_CARDS.length} cards visible. Show, hide or reorder your overview cards.</p></div><button type="button" className="studio-button" onClick={() => setCustomizing(true)}><SlidersHorizontal size={16} />Customize overview</button></div>
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section settings-pref-reset" title="Reset preferences" description="Restore the default personal workspace.">
      <div className="settings-pref-row"><div><p>Restore Daylight mode, English, India region, default display formats and notification preferences, the Overview start page and all default cards. Studio settings and records are kept.</p></div><button type="button" className="studio-button" onClick={() => { setConfirmReset(true); setNotice(''); }}><RotateCcw size={15} />Reset personal preferences</button></div>
      {confirmReset && <div className="settings-pref-confirm" role="group" aria-label="Confirm preference reset"><p>Reset your personal workspace preferences?</p><div><button type="button" className="studio-button" onClick={() => setConfirmReset(false)}>Cancel</button><button type="button" className="studio-button primary" onClick={() => { resetPreferences(); setConfirmReset(false); setNotice('Default personal preferences applied.'); }}>Reset preferences</button></div></div>}
      {notice && <p className="settings-pref-notice" role="status">{notice}</p>}
    </SettingsGroup>
    {customizing && <OverviewCustomizer onClose={() => setCustomizing(false)} />}
  </div>;
}
