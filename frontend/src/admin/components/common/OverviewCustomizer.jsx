import { useEffect, useId, useRef, useState } from 'react';
import { motion as Motion, Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { ArrowUp, ArrowDown, RotateCcw, GripVertical, Eye, LayoutGrid, CalendarDays, MessageSquare, Folder, TrendingUp, BarChart3, Wallet, ListChecks, Activity, PieChart, Zap, Check } from 'lucide-react';
import { OperationsModal } from '../operations/OperationsUI';
import { OVERVIEW_CARDS, useStudioPreferences } from './StudioPreferences';
import StudioAppIcon from './StudioAppIcon';
import { moveOverviewCard, reorderVisibleOverviewCards } from '../../../utils/overviewPreferences';
import './overviewCustomization.css';

const symbols = {
  openEnquiries: [MessageSquare, 'blue'], bookedProjects: [Folder, 'indigo'], upcomingEvents: [CalendarDays, 'rose'], pendingTasks: [ListChecks, 'amber'],
  bookingMomentum: [TrendingUp, 'green'], productionPulse: [BarChart3, 'violet'], financePulse: [Wallet, 'blue'], upcomingSchedule: [CalendarDays, 'rose'],
  actionQueue: [ListChecks, 'amber'], activityMap: [Activity, 'cyan'], enquiryPipeline: [PieChart, 'indigo'], recentEnquiries: [MessageSquare, 'blue'], quickActions: [Zap, 'amber'],
};
const cardFor = id => OVERVIEW_CARDS.find(card => card.id === id);

function ArrangeRow({ id, index, count, move, start, finish, reduced, instructions }) {
  const controls = useDragControls();
  const card = cardFor(id), [icon, tone] = symbols[id];
  return <Reorder.Item as="li" value={id} layout="position" dragListener={false} dragControls={controls} dragMomentum={false}
    onDragStart={() => start(id)} onDragEnd={() => finish(id)}
    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }}
    whileDrag={{ zIndex: 2, boxShadow: '0 12px 35px rgba(0,0,0,.22)' }} className="overview-arrange-row" data-arrange-card={id}>
    <StudioAppIcon icon={icon} tone={tone} size={38} />
    <span className="overview-arrange-label"><strong>{card.label}</strong><small>Position {index + 1} of {count}</small></span>
    <span className="overview-arrange-arrows">
      <button type="button" aria-label={'Move ' + card.label + ' up'} disabled={index === 0} onClick={() => move(id, -1)}><ArrowUp size={15} /></button>
      <button type="button" aria-label={'Move ' + card.label + ' down'} disabled={index === count - 1} onClick={() => move(id, 1)}><ArrowDown size={15} /></button>
    </span>
    <button type="button" className="overview-drag-handle" aria-label={'Drag ' + card.label} aria-describedby={instructions}
      onPointerDown={event => controls.start(event)} onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(id, event.key === 'ArrowUp' ? -1 : 1); }
      }}><GripVertical size={21} /></button>
  </Reorder.Item>;
}

export default function OverviewCustomizer({ onClose, initialTab = 'arrange' }) {
  const { preferences, toggleCard, update, resetCards, syncState, retrySave } = useStudioPreferences();
  const [tab, setTab] = useState(initialTab);
  const [order, setOrder] = useState(() => preferences.cardOrder.filter(id => preferences.visibleCards.includes(id)));
  const [announcement, setAnnouncement] = useState('');
  const orderRef = useRef(order), dragging = useRef(false);
  const instructions = useId();
  const systemReduced = useReducedMotion();
  const reduced = preferences.reduceMotion || systemReduced;
  useEffect(() => {
    if (dragging.current) return;
    const next = preferences.cardOrder.filter(id => preferences.visibleCards.includes(id));
    orderRef.current = next; setOrder(next);
  }, [preferences.cardOrder, preferences.visibleCards]);
  const changeOrder = next => { orderRef.current = next; setOrder(next); };
  const commit = (next, id) => {
    update({ cardOrder: reorderVisibleOverviewCards(preferences.cardOrder, preferences.visibleCards, next) });
    setAnnouncement(cardFor(id).label + ' moved to position ' + (next.indexOf(id) + 1) + '.');
  };
  const move = (id, direction) => {
    const next = moveOverviewCard(orderRef.current, id, direction);
    changeOrder(next); commit(next, id);
  };
  const start = id => { dragging.current = true; setAnnouncement('Moving ' + cardFor(id).label + '.'); };
  const finish = id => { dragging.current = false; commit(orderRef.current, id); };
  const reset = () => { dragging.current = false; resetCards(); setAnnouncement('Default cards and order restored.'); };
  return <OperationsModal title="Make it yours" description="Arrange your Insights cards. Today keeps schedules and urgent work first." onClose={onClose} footer={<>
    <button type="button" className="studio-button" onClick={reset}><RotateCcw size={16} />Reset layout</button>
    <button type="button" className="studio-button primary" onClick={onClose}><Check size={16} />Done</button>
  </>}>
    <div className="overview-layout-tabs" role="group" aria-label="Customize overview">
      <button type="button" aria-pressed={tab === 'arrange'} onClick={() => setTab('arrange')}><GripVertical size={17} />Rearrange</button>
      <button type="button" aria-pressed={tab === 'visibility'} onClick={() => setTab('visibility')}><Eye size={17} />Show or hide</button>
    </div>
    {tab === 'arrange' ? <>
      <div className="overview-arrange-intro"><span><LayoutGrid size={17} />{order.length} cards in your overview</span><p id={instructions}>Drag the grip to change the order. You can also use the arrow buttons or arrow keys.</p></div>
      {order.length ? <Motion.div className="overview-arrange-scroll" layoutScroll>
        <Reorder.Group as="ol" axis="y" values={order} onReorder={changeOrder} className="overview-arrange-list" aria-label="Overview card order">
          {order.map((id, index) => <ArrangeRow key={id} id={id} index={index} count={order.length} move={move} start={start} finish={finish} reduced={reduced} instructions={instructions} />)}
        </Reorder.Group>
      </Motion.div> : <div className="overview-layout-empty"><LayoutGrid size={28} /><p>No visible cards yet.</p><button type="button" className="studio-button" onClick={() => setTab('visibility')}>Choose cards</button></div>}
      <p className="overview-layout-hint">Your welcome banner stays at the top. Hidden cards keep their place for later.</p>
    </> : <div className="overview-visibility-list">
      {['At a glance', 'Featured cards', 'Workspace cards'].map(group => <fieldset key={group}><legend>{group}</legend>
        {OVERVIEW_CARDS.filter(card => card.group === group).map(card => {
          const visible = preferences.visibleCards.includes(card.id), [icon, tone] = symbols[card.id];
          return <label className="overview-visibility-row overview-card-toggle studio-switch-control" key={card.id}>
            <StudioAppIcon icon={icon} tone={tone} size={34} /><span className="overview-visibility-label">{card.label}</span>
            <input type="checkbox" role="switch" aria-label={card.label} checked={visible} onChange={() => toggleCard(card.id)} /><span className="studio-switch-track" aria-hidden="true" />
          </label>;
        })}
      </fieldset>)}
    </div>}
    <span className="studio-sr-only" role="status" aria-live="polite">{announcement}</span>
    <p className="overview-preference-status" role="status">{syncState === 'loading' ? 'Loading your account preferences…' : syncState === 'saving' ? 'Saving your preferences…' : syncState === 'memory' ? 'Applied for now. Preferences could not be saved; retry before leaving.' : syncState === 'local' ? 'Saved on this device. Account sync is unavailable.' : syncState === 'preview' ? 'Saved on this device for this sample preview.' : 'Saved to your Studio OS account.'}{['local', 'memory'].includes(syncState) && <button type="button" onClick={retrySave}>Retry sync</button>}</p>
  </OperationsModal>;
}
