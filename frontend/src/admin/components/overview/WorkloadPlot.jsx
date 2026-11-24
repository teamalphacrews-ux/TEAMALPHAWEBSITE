import { useLayoutEffect, useRef } from 'react';
import useReducedStudioMotion from '../operations/useReducedStudioMotion';
import { workloadTransition } from './workloadTransition';

function linePath(levels) {
  return levels.map((level, i) => (i ? 'L' : 'M') + (i + .5) * 100 / levels.length + ',' + (100 - level * 100)).join(' ');
}

// Bars, markers and the line share one coordinate system. The only animated
// values are measured-data heights; polling with identical values is a no-op.
export default function WorkloadPlot({ buckets, values, label, format, series }) {
  const reduced = useReducedStudioMotion();
  const field = useRef(null);
  const line = useRef(null);
  const frame = useRef({ levels: [], started: false });
  // Keep the same scale across series so a session can be compared with a task deadline.
  const peak = Math.max(1, ...buckets.map(row => row.tasks + row.sessions));
  const levels = values.map(value => value / peak * .85);
  const levelKey = levels.join(',');
  useLayoutEffect(() => {
    const targets = levelKey.split(',').map(Number);
    const bars = field.current.children;
    const path = line.current;
    const initial = !frame.current.started;
    const from = targets.map((_, i) => frame.current.levels[i] || 0);
    let animation = 0;
    function paint(next) {
      frame.current.levels = next;
      next.forEach((height, index) => bars[index].style.setProperty('--desk-level', height));
      path.setAttribute('d', linePath(next));
    }
    function finish() {
      cancelAnimationFrame(animation);
      paint(targets);
      frame.current.started = true;
    }
    if (reduced || document.hidden || (!initial && from.every((x, i) => x === targets[i]))) {
      finish();
      return;
    }
    paint(from);
    let start;
    const transition = workloadTransition(from, targets, initial);
    function step(time) {
      if (document.hidden) { finish(); return; }
      start ??= time;
      const elapsed = time - start;
      if (elapsed >= transition.end) { finish(); return; }
      if (elapsed >= transition.delay) {
        frame.current.started = true;
        paint(transition.sample(elapsed));
      }
      animation = requestAnimationFrame(step);
    }
    const onVisibility = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', onVisibility);
    animation = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animation);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [levelKey, reduced]);

  return <div className="sx-desk-plot" aria-label="Upcoming studio workload">
    <div className="sx-desk-plot-field">
      <div className="sx-desk-plot-bars" ref={field}>
        {buckets.map((row, i) => <div key={i} className="sx-desk-column" style={{ '--desk-step': i, '--desk-level': levels[i] }}
          title={label(row.start) + ' · ' + format(values[i]) + ' ' + series}>
          <div className="sx-desk-column-track"><div className="sx-desk-column-value" data-current={i === 0}/></div>
          <span className="sx-desk-marker"><b>{format(values[i])}</b></span>
        </div>)}
      </div>
      <svg aria-hidden="true" className="sx-desk-plot-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path ref={line} d={linePath(levels)} pathLength="1" vectorEffect="non-scaling-stroke"/>
      </svg>
    </div>
    <div className="sx-desk-plot-axis">{buckets.map(row => <small key={row.start}>{label(row.start)}</small>)}</div>
  </div>;
}
