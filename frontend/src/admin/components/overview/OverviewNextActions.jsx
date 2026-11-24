import { ArrowRight, CalendarDays, CheckCheck, ChevronDown, MessageSquare, ListChecks, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { overviewNextActions } from '../../../utils/overviewNextActions';
import StudioAppIcon from '../common/StudioAppIcon';
import './overviewNextActions.css';

const icons = {
  task: { icon: ListChecks, tone: 'violet' },
  enquiry: { icon: MessageSquare, tone: 'cyan' },
  event: { icon: CalendarDays, tone: 'rose' },
  invoice: { icon: ReceiptText, tone: 'green' },
};

function actionTiming(action, date, time) {
  if (action.timing === 'new') return 'New enquiry';
  if (action.timing === 'review') return 'Ready for studio review';
  if (action.kind === 'event') {
    if (action.timing === 'ongoing') return 'In progress now';
    if (action.timing === 'soon') return 'Starts soon · ' + time(action.at);
    const day = action.timing === 'today' ? 'Today' : date(action.day, { day: 'numeric', month: 'short' });
    return action.allDay ? day + ' · All day' : day + ' · ' + time(action.at);
  }
  if (action.timing === 'undated') return 'No due date';
  if (action.timing === 'today') return 'Due today';
  const due = date(action.day, { day: 'numeric', month: 'short' });
  return action.timing === 'overdue' ? 'Overdue · ' + due : 'Due ' + due;
}

export default function OverviewNextActions({ overview, now, timezone, date, time, canCreateEnquiry }) {
  const [first, ...others] = overviewNextActions(overview, now, timezone).slice(0, 3);
  const description = action => [actionTiming(action, date, time), action.context].filter(Boolean).join(' · ');

  return <section className="studio-card sx-up-next" aria-labelledby="sx-up-next-title" aria-busy={!overview}>
    <h2 id="sx-up-next-title">Up next</h2>
    {!overview ? <p className="sx-up-next-meta">Loading your next action…</p> : first ? <>
      <div className="sx-up-next-lead">
        <StudioAppIcon {...icons[first.kind]} size={40} />
        <div><h3>{first.title}</h3><p className="sx-up-next-meta">{description(first)}</p></div>
        <Link to={first.to} className="studio-button primary" aria-label={first.label + ': ' + first.title}>{first.label}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {others.length > 0 && <details className="sx-up-next-more">
        <summary>See {others.length} more {others.length === 1 ? 'action' : 'actions'}<ChevronDown size={16} aria-hidden="true" /></summary>
        <ul>{others.map(action => <li key={action.to}><Link to={action.to}>
          <div><strong>{action.title}</strong><span className="sx-up-next-meta">{description(action)}</span></div>
          <ArrowRight size={16} aria-hidden="true" />
        </Link></li>)}</ul>
      </details>}
    </> : <div className="sx-up-next-lead">
      <StudioAppIcon icon={CheckCheck} tone="green" size={40} />
      <div><h3>No suggested action right now</h3><p className="sx-up-next-meta">Check back for follow-ups, pending tasks and upcoming events.</p></div>
      {canCreateEnquiry && <Link className="studio-button" to="/admin/crm?new=1">Add enquiry<ArrowRight size={16} aria-hidden="true" /></Link>}
    </div>}
  </section>;
}
