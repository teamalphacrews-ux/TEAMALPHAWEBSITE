import StudioSelect from '../common/StudioSelect';
import { Globe2 } from 'lucide-react';
import { useStudioPreferences } from '../common/StudioPreferences';
import { LANGUAGE_OPTIONS, REGION_OPTIONS } from '../../../utils/personalPreferences';
import { formatWorkspaceDate, formatWorkspaceNumber, formatWorkspaceTime, resolveWorkspaceTimezone } from '../../../utils/workspaceLocale';
import { studioText } from '../../../utils/studioTranslations';
import { SettingsGroup } from './SettingsDisclosures';

const zones = [
  ['Asia/Kolkata', 'India · Kolkata (IST)'], ['Asia/Dubai', 'United Arab Emirates · Dubai'],
  ['Asia/Singapore', 'Singapore'], ['Asia/Kathmandu', 'Nepal · Kathmandu'], ['Asia/Colombo', 'Sri Lanka · Colombo'],
  ['Europe/London', 'United Kingdom · London'], ['Europe/Paris', 'France · Paris'],
  ['America/New_York', 'United States · New York'], ['America/Los_Angeles', 'United States · Los Angeles'],
  ['America/Toronto', 'Canada · Toronto'], ['Australia/Sydney', 'Australia · Sydney'],
];
const syncCopy = {
  loading: 'Loading your preferences…', saving: 'Saving your preferences…', saved: 'Saved to your Studio OS account.',
  local: 'Saved on this device. Account sync is unavailable.', memory: 'Applied for now. Saving is unavailable; retry before leaving.', preview: 'Saved on this device for this sample preview.',
};

export default function LocalePreferences({ studioTimezone }) {
  const { preferences, update, syncState, retrySave } = useStudioPreferences();
  const t = text => studioText(preferences.language, text);
  const selected = LANGUAGE_OPTIONS.find(language => language.value === preferences.language);
  const zone = resolveWorkspaceTimezone(preferences, studioTimezone);
  const customZone = preferences.timezone !== 'studio' && !zones.some(([value]) => value === preferences.timezone);
  const example = '2026-12-18T09:00:00Z';
  const field = (label, name, options) => <label className="studio-field" key={name}><span>{t(label)}</span><StudioSelect title={t(label)} className="studio-input" value={preferences[name]} onChange={event => update({ [name]: event.target.value })}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</StudioSelect></label>;
  return <div className="settings-pref-panel settings-locale-panel">
    <div className="settings-pref-status" role="status"><Globe2 size={17} aria-hidden="true" /><span>{syncCopy[syncState]}</span>{['local', 'memory'].includes(syncState) && <button type="button" className="studio-button small" onClick={retrySave}>Retry sync</button>}</div>
    <SettingsGroup defaultOpen className="settings-pref-section" title="Language & region" description="English and ten widely spoken Indian languages.">
      <div className="studio-form-grid">{field('Language', 'language', LANGUAGE_OPTIONS.map(language => ({ value: language.value, label: language.value === 'en' ? 'English' : `${language.nativeName} · ${language.label}` })))}{field('Region', 'region', REGION_OPTIONS)}</div>
      <div className="settings-locale-language-preview"><span lang={selected?.value} dir="auto">{t('Studio overview')}</span><small>{selected?.label} · {REGION_OPTIONS.find(region => region.value === preferences.region)?.label}</small></div>
      <p className="settings-help">Navigation, settings section names and overview headings use your selected language. Other interface text currently uses English. Client names, messages and documents keep their original language.</p>
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Date, time & number formats" description="Personal display formats and your time zone.">
      <div className="studio-form-grid">
        {field('Time zone', 'timezone', [{ value: 'studio', label: 'Use studio time zone · ' + (studioTimezone || 'Asia/Kolkata') }, ...zones.map(([value, label]) => ({ value, label })), ...(customZone ? [{ value: preferences.timezone, label: preferences.timezone }] : [])])}
        {field('Date format', 'dateFormat', [{ value: 'day-first', label: 'DD/MM/YYYY · 18/12/2026' }, { value: 'month-first', label: 'MM/DD/YYYY · 12/18/2026' }, { value: 'iso', label: 'YYYY-MM-DD · 2026-12-18' }])}
        {field('Time format', 'timeFormat', [{ value: '12h', label: '12-hour · 2:30 PM' }, { value: '24h', label: '24-hour · 14:30' }])}
        {field('Number format', 'numberFormat', [{ value: 'indian', label: 'Indian · 12,34,567.89' }, { value: 'international', label: 'International · 1,234,567.89' }])}
      </div>
      <aside className="settings-locale-preview" aria-label="Regional format preview"><div><span>Date</span><strong>{formatWorkspaceDate(example, preferences, studioTimezone)}</strong></div><div><span>Time · {zone}</span><strong>{formatWorkspaceTime(example, preferences, studioTimezone)}</strong></div><div><span>Number</span><strong>{formatWorkspaceNumber(1234567.89, preferences)}</strong></div></aside>
      <p className="settings-help">Calendar entries are shown and edited in the selected time zone. Changing this preference does not move an existing event.</p>
    </SettingsGroup>
  </div>;
}
