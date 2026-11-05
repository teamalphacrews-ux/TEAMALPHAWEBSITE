import StudioSelect from '../common/StudioSelect';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, RefreshCw, Volume2, Moon, ArrowUpRight } from 'lucide-react';
import { useStudioPreferences } from '../common/StudioPreferences';
import { SettingsToggle } from './SettingsEditor';
import { SettingsGroup } from './SettingsDisclosures';
import { useStudioIdentity } from '../../../utils/studioIdentity';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_TONES, notificationTimezone, notificationVolume, playNotificationSound } from '../../../utils/studioNotifications';
import './NotificationPreferences.css';

const syncMessages = { loading: 'Loading your personal preferences…', saving: 'Saving your personal preferences…', saved: 'Saved to your Studio OS account.', local: 'Saved on this device. Account sync is unavailable.', preview: 'Saved on this device for this sample preview.', memory: 'Applied for now. Preferences could not be saved; retry before closing.' };

export default function NotificationPreferences() {
  const { preferences, update, syncState, retrySave } = useStudioPreferences();
  const { identity } = useStudioIdentity();
  const [testing, setTesting] = useState(false), [notice, setNotice] = useState('');
  const selected = preferences.notificationCategories || NOTIFICATION_CATEGORIES.map(item => item.id);
  const timezone = notificationTimezone(preferences, identity?.timezone);
  const volume = notificationVolume(preferences.notificationVolume);
  const testSound = async () => {
    setTesting(true); setNotice('');
    const played = await playNotificationSound(preferences.notificationTone, volume, { userGesture: true });
    setNotice(played ? 'Test sound played. New alerts can play while this workspace is open.' : 'Sound could not play. Check your browser sound permission and device volume, then try again.');
    setTesting(false);
  };
  return <div className="settings-pref-panel settings-notifications">
    <div className="settings-pref-status" role="status"><Cloud size={17} aria-hidden="true" /><span>{syncMessages[syncState] || syncMessages.loading}</span>{['local', 'memory'].includes(syncState) && <button type="button" className="studio-button small" onClick={retrySave}><RefreshCw size={14} />Retry sync</button>}</div>
    <SettingsGroup defaultOpen className="settings-pref-section" title="Notification display" description="Badges and banners while Studio OS is open.">
      <SettingsToggle label="Unread badge" description="Show an unread indicator on the notification bell for your selected categories." value={preferences.notificationBadges !== false} onChange={notificationBadges => update({ notificationBadges })} />
      <SettingsToggle label="In-app banners" description="Show a brief banner when a new notification arrives. Existing notifications do not trigger a banner." value={preferences.notificationToasts !== false} onChange={notificationToasts => update({ notificationToasts })} />
      <p className="settings-help">Your full notification history remains available in the bell and Activity, even when alerts are muted. New activity is checked about once a minute. No desktop notifications or emails are sent by these controls.</p>
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Sounds & volume" description="Choose an alert tone and test it on this device.">
      <SettingsToggle label="Notification sounds" description="Play a short sound for new notifications in your selected categories." value={preferences.notificationSound === true} onChange={notificationSound => update({ notificationSound })} />
      <div className="settings-notification-controls">
        <label className="studio-field"><span>Alert sound</span><StudioSelect title="Alert sound" className="studio-input" value={preferences.notificationTone || 'chime'} onChange={event => update({ notificationTone: event.target.value })}>{NOTIFICATION_TONES.map(tone => <option key={tone.value} value={tone.value}>{tone.label}</option>)}</StudioSelect></label>
        <label className="studio-field settings-notification-volume"><span>Volume <output>{volume}%</output></span><input type="range" min="0" max="100" step="5" value={volume} aria-label="Notification volume" onChange={event => update({ notificationVolume: Number(event.target.value) })} /></label>
      </div>
      <div className="settings-notification-test"><button type="button" className="studio-button" onClick={testSound} disabled={testing || volume === 0}><Volume2 size={16} />{testing ? 'Playing…' : 'Play test sound'}</button><span>{volume === 0 ? 'Volume is muted.' : 'A test plays once, even when alerts or quiet hours are off.'}</span></div>
      <p className="settings-help">Browsers require interaction before sound can play. Use “Play test sound” to check audio on this device. Your device’s volume and silent settings still apply.</p>
      {notice && <p className="settings-pref-notice" role="status">{notice}</p>}
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Alert categories" description="Choose which studio activity reaches you.">{NOTIFICATION_CATEGORIES.map(category => <SettingsToggle key={category.id} label={category.label} description={category.description} value={selected.includes(category.id)} onChange={enabled => update({ notificationCategories: enabled ? [...new Set([...selected, category.id])] : selected.filter(id => id !== category.id) })} />)}
      {!selected.length && <p className="settings-help">All categories are muted. Your history is still available.</p>}
    </SettingsGroup>
    <SettingsGroup className="settings-pref-section" title="Quiet hours" description="Schedule a break from banners and sounds.">
      <SettingsToggle label="Schedule quiet hours" description="Mute new banners and sounds during the time range below." value={preferences.quietHoursEnabled === true} onChange={quietHoursEnabled => update({ quietHoursEnabled })} />
      <div className="settings-notification-controls"><label className="studio-field"><span>Start time</span><input className="studio-input" type="time" value={preferences.quietHoursStart || '22:00'} onChange={event => { if (event.target.value) update({ quietHoursStart: event.target.value }); }} /></label><label className="studio-field"><span>End time</span><input className="studio-input" type="time" value={preferences.quietHoursEnd || '08:00'} onChange={event => { if (event.target.value) update({ quietHoursEnd: event.target.value }); }} /></label></div>
      <p className="settings-notification-zone"><Moon size={14} aria-hidden="true" /><span>{timezone} · Overnight ranges are supported. Matching start and end times mute alerts all day.</span></p>
      <Link className="settings-text-button" to="/admin/settings?section=language">Manage language & region<ArrowUpRight size={13} /></Link>
    </SettingsGroup>
    <Link className="settings-text-button" to="/admin/settings?section=automation">Manage shared team reminders & alerts<ArrowUpRight size={13} /></Link>
  </div>;
}
