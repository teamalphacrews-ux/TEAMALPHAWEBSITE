import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Bell, Check, CheckCheck, Clock, RefreshCw, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { WorkspaceDialog, WorkspaceEmpty, WorkspaceError, WorkspaceHeader } from '../components/operations/WorkspaceUI';
import API from '../../utils/apiConfig';
import './studioSettings.css';

const timeLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : formatDistanceToNow(date, { addSuffix: true });
};
export default function ActivityLog() {
  const [notifications, setNotifications] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(''), [confirmClear, setConfirmClear] = useState(false);
  const request = useCallback((method, path, data, signal) => axios({ method, url: API + '/api/notifications' + path, data, signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }), []);
  const load = useCallback(signal => request('get', '', undefined, signal)
    .then(result => { if (!Array.isArray(result.data)) throw new Error(); setNotifications(result.data); setError(''); })
    .catch(failure => { if (!axios.isCancel(failure)) setError('Studio activity could not be loaded. Please retry.'); })
    .finally(() => { if (!signal?.aborted) setLoading(false); }), [request]);
  useEffect(() => {
    const controller = new AbortController(); load(controller.signal);
    const interval = setInterval(() => { if (document.visibilityState === 'visible') load(controller.signal); }, 30000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [load]);
  const update = async (action, id) => {
    if (busy) return;
    setBusy(id || action); setError('');
    try {
      await request(action === 'read' ? 'patch' : action === 'allRead' ? 'post' : 'delete', action === 'read' ? '/' + id + '/read' : action === 'allRead' ? '/mark-all-read' : action === 'clear' ? '/clear-all' : '/' + id, action === 'read' || action === 'allRead' ? {} : undefined);
      setNotifications(previous => action === 'clear' ? [] : action === 'delete' ? previous.filter(item => item._id !== id) : previous.map(item => action === 'allRead' || item._id === id ? { ...item, isRead: true } : item));
      if (action === 'clear') setConfirmClear(false);
    } catch { setError('This activity change could not be saved. Please try again.'); }
    finally { setBusy(''); }
  };
  const unread = notifications.filter(item => !item.isRead).length;
  return <div className="studio-activity-page">
    <WorkspaceHeader title="Studio activity" description="Recent updates, reminders and work that needs your attention.">
      <button type="button" className="studio-button" disabled={Boolean(busy) || !unread} onClick={() => update('allRead')}><CheckCheck size={15} />Mark all read</button>
      <button type="button" className="studio-icon-button" aria-label="Refresh activity" disabled={loading || Boolean(busy)} onClick={() => load()}><RefreshCw size={16} /></button>
    </WorkspaceHeader>
    <WorkspaceError error={error} retry={() => load()} />
    <section className="studio-card studio-activity-card">
      <div className="studio-card-heading"><div><h2>Recent activity {unread > 0 && <span className="studio-inline-count">{unread} unread</span>}</h2><p className="studio-card-subtitle">The latest 20 notifications, shared with your studio team.</p></div><button type="button" className="studio-button small" disabled={Boolean(busy) || !notifications.length} onClick={() => setConfirmClear(true)}><Trash2 size={14} />Clear activity</button></div>
      {loading ? <WorkspaceEmpty loading /> : notifications.length ? <div className="studio-activity-list">{notifications.map(item => <article key={item._id} className={'studio-activity-row' + (item.isRead ? '' : ' is-unread')}>
        <span className="studio-activity-symbol" aria-hidden="true"><Bell size={18} /></span><div className="studio-activity-content"><h3>{item.title}{!item.isRead && <span className="studio-unread-dot" aria-label="Unread" />}</h3><p>{item.description}</p><time dateTime={Number.isNaN(new Date(item.createdAt).getTime()) ? undefined : new Date(item.createdAt).toISOString()}><Clock size={12} />{timeLabel(item.createdAt)}</time></div>
        <div className="studio-activity-actions">{!item.isRead && <button type="button" className="studio-icon-button" disabled={Boolean(busy)} aria-label={'Mark ' + (item.title || 'notification') + ' as read'} onClick={() => update('read', item._id)}><Check size={16} /></button>}<button type="button" className="studio-icon-button" disabled={Boolean(busy)} aria-label={'Delete ' + (item.title || 'notification')} onClick={() => update('delete', item._id)}><Trash2 size={16} /></button></div>
      </article>)}</div> : <WorkspaceEmpty title="You’re all caught up" description="New studio updates and reminders will appear here." />}
    </section>
    {confirmClear && <WorkspaceDialog title="Clear studio activity?" busy={Boolean(busy)} onClose={() => !busy && setConfirmClear(false)} footer={<><button type="button" className="studio-button" disabled={Boolean(busy)} onClick={() => setConfirmClear(false)}>Keep activity</button><button type="button" className="studio-button danger" disabled={Boolean(busy)} onClick={() => update('clear')}>{busy ? 'Clearing…' : 'Clear all activity'}</button></>}><p>This clears all notifications for the studio team. Your enquiries, projects, documents and payments are kept.</p><WorkspaceError error={error} /></WorkspaceDialog>}
  </div>;
}
