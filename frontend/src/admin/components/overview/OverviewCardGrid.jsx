import { motion as Motion } from 'framer-motion';
import useReducedStudioMotion from '../operations/useReducedStudioMotion';

export default function OverviewCardGrid({ items, todayMode, reduceMotion, renderCard }) {
  const systemReduced = useReducedStudioMotion();
  const reduced = reduceMotion || systemReduced;
  const revision = (todayMode ? 'today:' : 'insights:') + items.map(item => item.id).join(',');
  return <div className={'ov-reference-grid' + (todayMode ? ' is-today' : '')}>
    {items.map(({ id, spans }) => <Motion.div
      key={id}
      className={'ov-layout-slot ' + (id === 'inspiration' ? 'ov-welcome-slot' : id === 'activityStreak' ? 'ov-week-slot' : 'ov-reference-slot ov-slot-' + id)}
      data-overview-slot={id}
      style={{ '--ov-span-desktop': spans.desktop, '--ov-span-tablet': spans.tablet, '--ov-span-phone': spans.phone }}
      layout={reduced ? false : 'position'}
      layoutDependency={revision}
      initial={false}
      transition={{ layout: { duration: reduced ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] } }}
    >{renderCard(id)}</Motion.div>)}
  </div>;
}
