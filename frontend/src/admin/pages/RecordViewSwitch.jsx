import { useEffect, useLayoutEffect, useRef } from 'react';
import useReducedStudioMotion from '../components/operations/useReducedStudioMotion';
import SectionSelectionIndicator from './SectionSelectionIndicator';

function cancelExit(transition) {
  if (!transition) return;
  clearTimeout(transition.timeout);
  transition.exit.cancel();
}

export default function RecordViewSwitch({ value, onChange, views, label, className = '', surfaceSelector }) {
  const controls = useRef(null);
  const pending = useRef(null);
  const outgoing = useRef(null);
  const reduced = useReducedStudioMotion();

  useLayoutEffect(() => {
    outgoing.current?.cancel();
    outgoing.current = null;
  }, [value]);

  useEffect(() => () => {
    outgoing.current?.cancel();
    cancelExit(pending.current);
    pending.current = null;
  }, []);
  useEffect(() => {
    if (reduced && pending.current) {
      const { commit } = pending.current;
      cancelExit(pending.current);
      pending.current = null;
      commit();
    }
  }, [reduced]);

  const select = next => {
    cancelExit(pending.current);
    pending.current = null;
    if (reduced || document.hidden) { onChange(next); return; }
    if (value === next) return;
    const region = controls.current.closest('.record-desk,.record-enquiries,.sx-task-page');
    const surface = [...region.querySelectorAll(surfaceSelector)].find(element => element.getClientRects().length);
    if (!surface?.animate) { onChange(next); return; }
    const exit = surface.animate([{ opacity: 1, transform: 'none' }, { opacity: .1, transform: 'translateY(8px) scale(.985)' }], {
      id: 'studio-record-exit', duration: 180, easing: 'cubic-bezier(.45,0,.65,.45)', fill: 'forwards',
    });
    const commit = () => onChange(next);
    const finish = () => {
      if (pending.current?.exit !== exit) return;
      clearTimeout(pending.current.timeout);
      pending.current = null;
      outgoing.current = exit;
      commit();
    };
    // WebKit freezes the document timeline when a window is occluded during an exit.
    pending.current = { exit, commit, timeout: setTimeout(finish, 230) };
    exit.finished.then(finish, () => {});
  };

  return <div ref={controls} data-section-selector="line" className={'record-views ' + className} role="group" aria-label={label}>
    {views.map(option => {
      const Icon = option.icon;
      return <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => select(option.id)}><Icon size={15} aria-hidden="true" />{option.label}</button>;
    })}
    <SectionSelectionIndicator selection={value} />
  </div>;
}
