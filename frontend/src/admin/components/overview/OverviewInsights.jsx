import StudioAppIcon from '../common/StudioAppIcon';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Camera, Check, Clock3, Flame, Grid3X3, TrendingUp, RefreshCw } from 'lucide-react';
import { nextOverviewIdea } from '../../../utils/overviewInspiration';
import './overviewInspiration.css';

const inspirationKey = 'studio-overview-last-idea';
const initialIdea = () => {
  try { return nextOverviewIdea(sessionStorage.getItem(inspirationKey)); }
  catch { return nextOverviewIdea(); }
};

const dayLabel = date => new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const fullDate = date => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const number = value => Math.max(0, Number(value) || 0);
const curve = points => points.map((point, index) => {
  if (!index) return `M${point.x},${point.y}`;
  const previous = points[index - 1], middle = (previous.x + point.x) / 2;
  return `C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
}).join(' ');
function CardHeader({ icon, title, subtitle, period = 'Last 7 days' }) {
  return <header className="ov-card-heading"><StudioAppIcon className="ov-card-icon" icon={icon} tone={icon === TrendingUp ? "amber" : icon === BarChart3 ? "violet" : "cyan"} size={34} /><div><h2>{title}</h2><p>{subtitle}</p></div>{period && <span className="ov-period"><Clock3 size={11} />{period}</span>}</header>;
}
function Missing({ loading }) { return <div className="ov-chart-empty" role="status">{loading ? 'Loading your studio insights…' : 'Insights are unavailable. Refresh to try again.'}</div>; }

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
    <div className="ov-welcome-note"><small>{date}</small><strong>More creating.<br />Less chasing.</strong><span>{todayCount ?? '—'} events today · {pending ?? '—'} tasks to do</span></div>
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
    {insights ? <div className="ov-area-chart"><svg viewBox="0 0 480 125" role="img" aria-label={`New enquiries over 7 days: ${values.map(day => `${fullDate(day.date)}, ${day.count}`).join('; ')}`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff823d" stopOpacity=".43" /><stop offset="100%" stopColor="#ff823d" stopOpacity=".025" /></linearGradient></defs>
      <path d={`${line} L468,121 L12,121 Z`} fill={`url(#${gradient})`} /><path className="ov-draw-line" d={line} fill="none" stroke="#f36a27" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={values[index].date} cx={point.x} cy={point.y} r={selected === index ? 5 : 2.5} fill="#f36a27" />)}
    </svg><div className="ov-chart-days">{values.map((day, index) => <button key={day.date} type="button" aria-label={`${fullDate(day.date)}: ${day.count} new ${day.count === 1 ? "enquiry" : "enquiries"}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{dayLabel(day.date)}</button>)}</div></div> : <Missing loading={loading} />}
    <Link className="ov-card-bottom" to="/admin/crm"><span><b>{conversion === null ? '—' : `${conversion}%`}</b> booked · {booked} of {total} enquiries, all time</span><ArrowUpRight size={14} /></Link>
  </section>;
}

export function RhythmInsight({ insights, loading, remove }) {
  const [metric, setMetric] = useState('events');
  const days = insights?.rhythm?.daily || [];
  const maximum = Math.max(2, ...days.map(day => Math.max(number(day[metric]), number(day.tasksDue))));
  const points = days.map((day, index) => ({ x: 35 + index * 75, y: 114 - number(day[metric]) / maximum * 89 }));
  const count = days.reduce((sum, day) => sum + number(day[metric]), 0);
  return <section className="ov-card ov-rhythm" data-overview-card="productionPulse">
    {remove}<CardHeader icon={BarChart3} title="Studio rhythm" subtitle="A little clarity for every busy day" />
    <div className="ov-chart-toolbar"><span><b>{insights ? count : '—'}</b> {metric === 'events' ? 'scheduled events' : 'new enquiries'}</span><div className="ov-chart-selector" aria-label="Chart series"><button type="button" aria-pressed={metric === 'events'} onClick={() => setMetric('events')}>Events</button><button type="button" aria-pressed={metric === 'enquiries'} onClick={() => setMetric('enquiries')}>Enquiries</button></div></div>
    {insights ? <><svg className="ov-rhythm-chart" viewBox="0 0 535 128" preserveAspectRatio="none" role="img" aria-label={days.map(day => `${fullDate(day.date)}: ${day[metric]} ${metric}, ${day.tasksDue} tasks due, ${day.completedTasksDue} now completed`).join('; ')}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="25" x2="520" y1={114 - 89 * fraction} y2={114 - 89 * fraction} stroke="var(--studio-border)" strokeDasharray="2 5" /><text x="1" y={118 - 89 * fraction} className="ov-axis-label">{Math.round(maximum * fraction)}</text></g>)}
      {days.map((day, index) => <g key={day.date}><rect x={25 + index * 75} y={114 - number(day.tasksDue) / maximum * 89} width="22" height={number(day.tasksDue) / maximum * 89} rx="3" fill="var(--ov-bar)" /><rect x={25 + index * 75} y={114 - number(day.completedTasksDue) / maximum * 89} width="22" height={number(day.completedTasksDue) / maximum * 89} rx="3" fill="#ff8d55" /></g>)}
      <path className="ov-draw-line" d={curve(points)} fill="none" stroke="var(--studio-text)" strokeWidth="1.6" strokeLinejoin="round" />
      {days.map((day, index) => <circle key={day.date} cx={35 + index * 75} cy={114 - number(day[metric]) / maximum * 89} r="3.5" fill="#f87938"><title>{fullDate(day.date)}: {day[metric]} {metric}</title></circle>)}
    </svg><div className="ov-chart-days ov-rhythm-days" aria-hidden="true">{days.map(day => <span key={day.date}>{dayLabel(day.date)}</span>)}</div></> : <Missing loading={loading} />}
    <footer className="ov-chart-legend"><span><i className="is-line" />{metric === 'events' ? 'Scheduled events' : 'New enquiries'}</span><span><i />Tasks due</span><span><i className="is-orange" />Now completed</span><Link to="/admin/calendar">Calendar<ArrowUpRight size={12} /></Link></footer>
  </section>;
}

export function ActivityInsight({ insights, loading, remove }) {
  const [selected, setSelected] = useState(null);
  const days = insights?.activity?.days || [];
  const max = Math.max(1, ...days.flatMap(day => day.hours));
  const active = days[selected];
  return <section className="ov-card ov-activity" data-overview-card="activityMap">
    {remove}<CardHeader icon={Grid3X3} title="Activity map" subtitle="When your studio comes to life" />
    {insights ? <><div className="ov-heatmap" role="img" aria-label="Hourly activity for the last 7 days. Each group shows 24 hours, left to right, top to bottom. Use the day buttons for totals.">{days.map(day => <div className="ov-heatmap-day" key={day.date}>{day.hours.map((count, hour) => <i key={hour} data-level={count ? Math.max(1, Math.ceil(count / max * 3)) : 0} title={`${fullDate(day.date)}, ${String(hour).padStart(2, '0')}:00 · ${count} activities`} />)}</div>)}</div>
      <div className="ov-chart-days">{days.map((day, index) => <button type="button" key={day.date} aria-pressed={selected === index} aria-label={`${fullDate(day.date)}, ${day.hours.reduce((sum, count) => sum + count, 0)} activities`} onClick={() => setSelected(index)}>{dayLabel(day.date)}</button>)}</div>
      <div className="ov-heatmap-foot"><p aria-live="polite">{active ? `${fullDate(active.date)} · ${active.hours.reduce((sum, count) => sum + count, 0)} activities` : `24 hours per day · ${insights.timezone}`}</p><span>Less <i data-level="0" /><i data-level="1" /><i data-level="2" /><i data-level="3" /> More</span></div>
      <details className="ov-chart-data"><summary>View activity data</summary><p>{insights.activity.source}. Hours run 00–23 in each day’s grid.</p><table><caption>Daily activity totals</caption><tbody>{days.map(day => <tr key={day.date}><th scope="row">{fullDate(day.date)}</th><td>{day.hours.reduce((sum, count) => sum + count, 0)}</td></tr>)}</tbody></table></details></> : <Missing loading={loading} />}
  </section>;
}

export function PipelineRings({ pipeline, loading, remove }) {
  const total = pipeline.reduce((sum, item) => sum + number(item.count), 0);
  const booked = number(pipeline.find(item => item.status === 'Converted')?.count);
  const archived = number(pipeline.find(item => item.status === 'Archived')?.count);
  const rings = [{ label: 'Booked', count: booked, tone: '#57b690', path: '/admin/crm?stage=Converted' }, { label: 'Active', count: Math.max(0, total - booked - archived), tone: '#8b8e95', path: '/admin/crm' }, { label: 'Archived', count: archived, tone: '#ff742a', path: '/admin/crm?stage=Archived' }];
  return <section className="ov-card ov-performance" data-overview-card="enquiryPipeline">{remove}<CardHeader icon={TrendingUp} title="Pipeline performance" subtitle="Every enquiry, accounted for" period="All time" />
    <div className="ov-rings">{rings.map(ring => { const rate = total ? Math.round(ring.count / total * 100) : null; return <Link to={ring.path} key={ring.label} aria-label={`${ring.label}: ${loading ? 'Loading' : ring.count} enquiries`}><div className="ov-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--ov-track)" strokeWidth="4" /><circle opacity={rate ? 1 : 0} className="ov-ring-progress" cx="50" cy="50" r="44" fill="none" stroke={ring.tone} strokeWidth="4" pathLength="100" strokeDasharray={`${rate || 0} 100`} strokeLinecap="round" transform="rotate(-90 50 50)" /></svg><div><strong>{loading || rate === null ? '—' : `${rate}%`}</strong><small>{ring.label}</small></div></div><span>{loading ? '—' : ring.count} enquiries</span></Link>; })}</div>
    <p className="ov-ring-caption">{loading ? 'Loading your enquiry pipeline…' : total ? `${total} enquiries across your studio. Select a ring to explore.` : 'Your first enquiry will bring this picture to life.'}</p></section>;
}

export function WeekStrip({ insights }) {
  const days = insights?.rhythm?.daily || [];
  const activeDays = days.filter(day => day.events + day.enquiries + day.tasksDue > 0).length;
  return <section className="ov-week-strip"><StudioAppIcon className="ov-card-icon" icon={Flame} tone="amber" size={32} /><div><h2>{insights ? `${activeDays} active days. One connected studio.` : 'Your week, beautifully connected.'}</h2><p>Enquiries, events and due work · last 7 days</p></div><div className="ov-week-days">{days.map(day => <span key={day.date} title={`${fullDate(day.date)} · ${day.events} events, ${day.enquiries} enquiries, ${day.tasksDue} tasks due`}><i className={day.events + day.enquiries + day.tasksDue > 0 ? 'is-active' : ''}>{day.events + day.enquiries + day.tasksDue > 0 ? <Flame size={15} /> : <Check size={13} />}</i><small>{dayLabel(day.date)}</small></span>)}</div><Link to="/admin/post-production">Keep things moving<ArrowUpRight size={15} /></Link></section>;
}
