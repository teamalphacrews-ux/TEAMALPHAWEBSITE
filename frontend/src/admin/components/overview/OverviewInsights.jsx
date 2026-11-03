import StudioAppIcon from '../common/StudioAppIcon';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Camera, Check, Clock3, Flame, Grid3X3, TrendingUp, RefreshCw } from 'lucide-react';
import { nextOverviewIdea } from '../../../utils/overviewInspiration';
import { hourlyActivityRows, rhythmScaleMaximum, roundedPercentageShares } from '../../../utils/overviewChartData';
import './overviewInspiration.css';

const inspirationKey = 'studio-overview-last-idea';
const initialIdea = () => {
  try { return nextOverviewIdea(sessionStorage.getItem(inspirationKey)); }
  catch { return nextOverviewIdea(); }
};

const dayLabel = date => new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const fullDate = date => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const curve = points => points.map((point, index) => {
  if (!index) return `M${point.x},${point.y}`;
  const previous = points[index - 1], middle = (previous.x + point.x) / 2;
  return `C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
}).join(' ');
function CardHeader({ icon, title, subtitle, period = 'Last 7 days' }) {
  return <header className="ov-card-heading"><StudioAppIcon className="ov-card-icon" icon={icon} tone={icon === TrendingUp ? "amber" : icon === BarChart3 ? "violet" : "cyan"} size={34} /><div><h2>{title}</h2><p>{subtitle}</p></div>{period && <span className="ov-period"><Clock3 size={12} />{period}</span>}</header>;
}
function Missing({ loading, empty }) { return <div className="ov-chart-empty" role="status">{loading ? 'Loading your studio insights…' : empty || 'Insights could not load. Refresh the overview to try again.'}</div>; }

export function OverviewWelcome({ name, greeting, date, todayCount, pending }) {
  const [idea, setIdea] = useState(initialIdea);
  useEffect(() => {
    try { sessionStorage.setItem(inspirationKey, idea.id); } catch { /* Reading ideas also works without storage. */ }
  }, [idea.id]);
  return <section className="ov-welcome" aria-labelledby="ov-welcome-title">
    <img className="ov-welcome-photo" src="/assets/banner/dsc05646-1280.webp" alt="" />
    <div className="ov-welcome-light" aria-hidden="true" />
    <div className="ov-welcome-copy"><span>{greeting}, {name}</span>
      <div className="ov-inspiration-content" aria-live="polite" aria-atomic="true"><div className="ov-inspiration-story" key={idea.id}><span className="ov-inspiration-category">{idea.category}</span><h2 id="ov-welcome-title">{idea.title}</h2><p>{idea.detail}</p></div></div>
      <div className="ov-inspiration-actions"><Link to={idea.to}>{idea.action}<ArrowUpRight size={15} /></Link><button type="button" aria-label="Show another studio idea" onClick={() => setIdea(current => nextOverviewIdea(current.id))}><RefreshCw size={14} /><span>Another idea</span></button></div>
    </div>
    <div className="ov-welcome-glass" aria-hidden="true"><Camera size={30} strokeWidth={1.4} /></div>
    <div className="ov-welcome-note"><small>{date}</small><strong>More creating.<br />Less chasing.</strong><span>{todayCount ?? '—'} {todayCount === 1 ? 'event' : 'events'} remaining today · {pending ?? '—'} {pending === 1 ? 'task' : 'tasks'} to do</span></div>
  </section>;
}

export function BookingInsight({ insights, loading, conversion, total, booked, remove }) {
  const gradient = useId().replaceAll(':', '');
  const [selected, setSelected] = useState(null);
  const values = insights?.enquiries?.daily || [];
  const maximum = Math.max(1, ...values.map(day => number(day.count)));
  const points = values.map((day, index) => ({ x: 12 + index * 456 / Math.max(1, values.length - 1), y: 105 - number(day.count) / maximum * 76 }));
  const line = curve(points);
  const change = insights?.enquiries?.changePercent;
  const active = values[selected] || null;
  return <section className="ov-card ov-booking" data-overview-card="bookingMomentum">
    {remove}<CardHeader icon={TrendingUp} title="Booking momentum" subtitle="Every conversation is a possibility" />
    <div className="ov-number-row"><strong>{insights ? insights.enquiries.total : '—'}<small>new enquiries</small></strong>{Number.isFinite(change) && <span className={'ov-change' + (change < 0 ? ' is-down' : '')}>{change > 0 ? '+' : ''}{change}%</span>}</div>
    <p className="ov-number-note">{active ? `${fullDate(active.date)} · ${active.count} ${active.count === 1 ? "enquiry" : "enquiries"}` : 'Compared with the previous 7 days'}</p>
    {insights && values.length ? <div className="ov-area-chart"><svg viewBox="0 0 480 125" role="img" aria-label={`New enquiries over 7 days: ${values.map(day => `${fullDate(day.date)}, ${day.count}`).join('; ')}`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff823d" stopOpacity=".43" /><stop offset="100%" stopColor="#ff823d" stopOpacity=".025" /></linearGradient></defs>
      <path d={`${line} L468,121 L12,121 Z`} fill={`url(#${gradient})`} /><path className="ov-draw-line" d={line} fill="none" stroke="#f36a27" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={values[index].date} cx={point.x} cy={point.y} r={selected === index ? 5 : 2.5} fill="#f36a27" />)}
    </svg><div className="ov-chart-days">{values.map((day, index) => <button key={day.date} type="button" aria-label={`${fullDate(day.date)}: ${day.count} new ${day.count === 1 ? "enquiry" : "enquiries"}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{dayLabel(day.date)}</button>)}</div></div> : <Missing loading={loading} empty={insights ? 'No enquiry data for this period.' : null} />}
    <Link className="ov-card-bottom" to="/admin/crm"><span><b>{conversion === null ? '—' : `${conversion}%`}</b> booked · {booked} of {total} enquiries, all time</span><ArrowUpRight size={14} /></Link>
  </section>;
}

export function RhythmInsight({ insights, loading, remove }) {
  const [metric, setMetric] = useState('events');
  const days = insights?.rhythm?.daily || [];
  const maximum = rhythmScaleMaximum(days, metric);
  const points = days.map((day, index) => ({ x: 35 + index * 75, y: 114 - number(day[metric]) / maximum * 89 }));
  const count = days.reduce((sum, day) => sum + number(day[metric]), 0);
  return <section className="ov-card ov-rhythm" data-overview-card="productionPulse">
    {remove}<CardHeader icon={BarChart3} title="Studio rhythm" subtitle="A little clarity for every busy day" />
    <div className="ov-chart-toolbar"><span><b>{insights ? count : '—'}</b> {metric === 'events' ? `scheduled ${count === 1 ? 'event' : 'events'}` : `new ${count === 1 ? 'enquiry' : 'enquiries'}`}</span><div className="ov-chart-selector" aria-label="Chart series"><button type="button" aria-pressed={metric === 'events'} onClick={() => setMetric('events')}>Events</button><button type="button" aria-pressed={metric === 'enquiries'} onClick={() => setMetric('enquiries')}>Enquiries</button></div></div>
    {insights && days.length ? <><div className="ov-rhythm-plot"><div className="ov-rhythm-scale" aria-hidden="true">{[1, .5, 0].map(fraction => <span key={fraction} style={{ top: `${(114 - 89 * fraction) / 128 * 100}%` }}>{maximum * fraction}</span>)}</div><svg className="ov-rhythm-chart" viewBox="0 0 535 128" preserveAspectRatio="none" role="img" aria-label={days.map(day => `${fullDate(day.date)}: ${day[metric]} ${metric}, ${day.tasksDue} tasks due, ${day.completedTasksDue} now completed`).join('; ')}>
      {[0, .5, 1].map(fraction => <line key={fraction} x1="25" x2="520" y1={114 - 89 * fraction} y2={114 - 89 * fraction} stroke="var(--studio-border)" strokeDasharray="2 5" />)}
      {days.map((day, index) => <g key={day.date}><rect x={25 + index * 75} y={114 - number(day.tasksDue) / maximum * 89} width="22" height={number(day.tasksDue) / maximum * 89} rx="3" fill="var(--ov-bar)" /><rect x={25 + index * 75} y={114 - number(day.completedTasksDue) / maximum * 89} width="22" height={number(day.completedTasksDue) / maximum * 89} rx="3" fill="var(--ov-completed)" stroke="var(--ov-accent-edge)" strokeWidth="1" strokeOpacity={number(day.completedTasksDue) ? 1 : 0} /></g>)}
      <path className="ov-draw-line" d={curve(points)} fill="none" stroke="var(--studio-text)" strokeWidth="1.6" strokeLinejoin="round" />
      {days.map((day, index) => <circle key={day.date} cx={35 + index * 75} cy={114 - number(day[metric]) / maximum * 89} r="3.5" fill="#f87938"><title>{fullDate(day.date)}: {day[metric]} {metric}</title></circle>)}
    </svg></div><div className="ov-chart-days ov-rhythm-days" aria-hidden="true">{days.map(day => <span key={day.date}>{dayLabel(day.date)}</span>)}</div></> : <Missing loading={loading} empty={insights ? 'No rhythm data for this period.' : null} />}
    <footer className="ov-chart-legend"><span><i className="is-line" />{metric === 'events' ? 'Scheduled events' : 'New enquiries'}</span><span><i />Tasks due</span><span><i className="is-orange" />Now completed</span><Link to="/admin/calendar">Calendar<ArrowUpRight size={12} /></Link></footer>
    {!!days.length && <details className="ov-chart-data"><summary>View rhythm data</summary><table><caption>Daily studio rhythm</caption><thead><tr><th scope="col">Date</th><th scope="col">{metric === 'events' ? 'Events' : 'Enquiries'}</th><th scope="col">Tasks due</th><th scope="col">Completed</th></tr></thead><tbody>{days.map(day => <tr key={day.date}><th scope="row">{fullDate(day.date)}</th><td>{number(day[metric])}</td><td>{number(day.tasksDue)}</td><td>{number(day.completedTasksDue)}</td></tr>)}</tbody></table></details>}
  </section>;
}

export function ActivityInsight({ insights, loading, remove }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const id = useId();
  const days = (insights?.activity?.days || []).map(day => ({ ...day, hours: hourlyActivityRows(day).map(row => row.count) }));
  const max = Math.max(1, ...days.flatMap(day => day.hours));
  const active = days.find(day => day.date === selectedDate) || days.at(-1);
  const hours = hourlyActivityRows(active);
  const selectedTotal = hours.reduce((sum, row) => sum + row.count, 0);
  const timezone = insights?.timezone || 'Studio time';
  return <section className="ov-card ov-activity" data-overview-card="activityMap">
    {remove}<CardHeader icon={Grid3X3} title="Activity map" subtitle="Enquiries added, tasks created and event starts" />
    {insights && days.length ? <><p className="ov-heatmap-orientation">{timezone} · Hours run left to right, four per row</p><div className="ov-heatmap-layout"><div className="ov-heatmap-hour-labels" aria-hidden="true">{[0, 4, 8, 12, 16, 20].map(hour => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="ov-heatmap" role="img" aria-label={`Enquiries added, tasks created and event starts in ${timezone} for the last 7 days. Each day shows 24 hours in six rows of four, starting at midnight. Select a day and open View activity data for hourly counts.`}>{days.map(day => <div className="ov-heatmap-day" key={day.date}>{day.hours.map((count, hour) => <i key={hour} data-level={count ? Math.max(1, Math.ceil(count / max * 3)) : 0} title={`${fullDate(day.date)}, ${String(hour).padStart(2, '0')}:00 · ${count} recorded ${count === 1 ? 'item' : 'items'}`} />)}</div>)}</div></div>
      <div className="ov-chart-days ov-activity-days">{days.map(day => <button type="button" key={day.date} aria-pressed={active?.date === day.date} aria-controls={`${id}-activity-data`} aria-label={`${fullDate(day.date)}, ${day.hours.reduce((sum, count) => sum + count, 0)} recorded items. Select for hourly data.`} onClick={() => setSelectedDate(day.date)}>{dayLabel(day.date)}</button>)}</div>
      <div className="ov-heatmap-foot"><p aria-live="polite">{fullDate(active.date)} · <strong>{selectedTotal} recorded {selectedTotal === 1 ? 'item' : 'items'}</strong></p><span>Less <i data-level="0" /><i data-level="1" /><i data-level="2" /><i data-level="3" /> More</span></div>
      <details className="ov-chart-data" id={`${id}-activity-data`}><summary>View activity data</summary><p>Recorded timestamps, rather than time spent working. Select a day above to inspect each hour in {timezone}.</p><table><caption>{fullDate(active.date)} hourly recorded activity</caption><thead><tr><th scope="col">Hour</th><th scope="col">Recorded items</th></tr></thead><tbody>{hours.map(row => <tr key={row.hour}><th scope="row">{row.hour}</th><td>{row.count}</td></tr>)}</tbody></table></details></> : <Missing loading={loading} empty={insights ? 'No activity data for this period.' : null} />}
  </section>;
}

export function PipelineRings({ pipeline = [], loading, unavailable = false, remove }) {
  const total = pipeline.reduce((sum, item) => sum + number(item.count), 0);
  const booked = number(pipeline.find(item => item.status === 'Converted')?.count);
  const archived = number(pipeline.find(item => item.status === 'Archived')?.count);
  const rings = [{ label: 'Booked', count: booked, tone: 'var(--ov-change-positive)', path: '/admin/crm?stage=Converted' }, { label: 'Active', count: Math.max(0, total - booked - archived), tone: 'var(--ov-bar)', path: '/admin/crm?stage=Active' }, { label: 'Archived', count: archived, tone: 'var(--ov-accent-edge)', path: '/admin/crm?stage=Archived' }];
  const percentages = roundedPercentageShares(rings.map(ring => ring.count));
  if (unavailable) return <section className="ov-card ov-performance" data-overview-card="enquiryPipeline">{remove}<CardHeader icon={TrendingUp} title="Pipeline performance" subtitle="Every enquiry, accounted for" period="All time" /><Missing loading={false} /></section>;
  return <section className="ov-card ov-performance" data-overview-card="enquiryPipeline">{remove}<CardHeader icon={TrendingUp} title="Pipeline performance" subtitle="Every enquiry, accounted for" period="All time" />
    <div className="ov-rings">{rings.map((ring, index) => { const rate = total ? percentages[index] : null; return <Link to={ring.path} key={ring.label} aria-label={`${ring.label}: ${loading ? 'Loading' : ring.count} ${ring.count === 1 ? 'enquiry' : 'enquiries'}${loading || rate === null ? '' : `, ${rate}% of all enquiries`}`}><div className="ov-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--ov-track-edge)" strokeWidth="5" /><circle cx="50" cy="50" r="44" fill="none" stroke="var(--ov-track)" strokeWidth="3" /><circle opacity={rate ? 1 : 0} className="ov-ring-progress" cx="50" cy="50" r="44" fill="none" stroke={ring.tone} strokeWidth="4" pathLength="100" strokeDasharray={`${rate || 0} 100`} strokeLinecap="round" transform="rotate(-90 50 50)" /></svg><div><strong>{loading ? '—' : ring.count}</strong><small>{ring.label}</small></div></div><span>{loading || rate === null ? '—' : `${rate}%`} of enquiries</span></Link>; })}</div>
    <p className="ov-ring-caption">{loading ? 'Loading your enquiry pipeline…' : total ? `${total} ${total === 1 ? 'enquiry' : 'enquiries'} across your studio. Shares rounded to total 100%. Select a ring to explore.` : 'Your first enquiry will bring this picture to life.'}</p></section>;
}

export function WeekStrip({ insights }) {
  const days = insights?.rhythm?.daily || [];
  const activeDays = days.filter(day => day.events + day.enquiries + day.tasksDue > 0).length;
  return <section className="ov-week-strip"><StudioAppIcon className="ov-card-icon" icon={Flame} tone="amber" size={32} /><div><h2>{insights ? `${activeDays} active days. One connected studio.` : 'Your week, beautifully connected.'}</h2><p>Enquiries, events and due work · last 7 days</p></div><div className="ov-week-days">{days.map(day => <span key={day.date} title={`${fullDate(day.date)} · ${day.events} events, ${day.enquiries} enquiries, ${day.tasksDue} tasks due`}><i className={day.events + day.enquiries + day.tasksDue > 0 ? 'is-active' : ''}>{day.events + day.enquiries + day.tasksDue > 0 ? <Flame size={15} /> : <Check size={13} />}</i><small>{dayLabel(day.date)}</small></span>)}</div><Link to="/admin/post-production">Keep things moving<ArrowUpRight size={15} /></Link></section>;
}
