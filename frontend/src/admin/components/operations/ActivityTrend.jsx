import { studioDayKey, shiftDayKey } from '../../../utils/studioTime';
import { formatWorkspaceDate, resolveWorkspaceTimezone } from '../../../utils/workspaceLocale';
import { useStudioPreferences } from '../common/StudioPreferences';
import { useStudioIdentity } from '../../../utils/studioIdentity';

export default function ActivityTrend({ notifications }) {
  const { preferences } = useStudioPreferences();
  const { identity } = useStudioIdentity();
  const timezone = resolveWorkspaceTimezone(preferences, identity?.timezone);
  const counts = new Map();
  for (const entry of notifications) {
    const day = studioDayKey(entry.createdAt, timezone);
    if (day) counts.set(day, (counts.get(day) || 0) + 1);
  }
  const latest = [...counts.keys()].sort().at(-1);
  if (!latest) return null;
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDayKey(latest, index - 6);
    return { day, count: counts.get(day) || 0 };
  });
  const total = days.reduce((sum, item) => sum + item.count, 0);
  const peak = Math.max(1, ...days.map(item => item.count));
  const date = (key, options) => formatWorkspaceDate(key, preferences, identity?.timezone, options);
  return <section className="studio-card sx-activity-trend" aria-labelledby="sx-activity-trend-title">
    <div className="sx-activity-trend-heading">
      <div><h2 id="sx-activity-trend-title">Updates by day</h2><p>Recent studio activity for the week ending {date(latest, { day: 'numeric', month: 'short', year: 'numeric' })}.</p></div>
      <span><strong>{total}</strong> {total === 1 ? 'update' : 'updates'}</span>
    </div>
    <ol className="sx-activity-bars">{days.map(({ day, count }) => <li key={day}>
      <span className="sx-activity-amount">{count}</span>
      <div className="sx-activity-bar-well" aria-hidden="true"><i style={{ height: count / peak * 100 + '%' }} /></div>
      <time dateTime={day}>{date(day, { weekday: 'short', day: undefined, month: undefined, year: undefined })}<b>{Number(day.slice(-2))}</b></time>
    </li>)}</ol>
  </section>;
}
