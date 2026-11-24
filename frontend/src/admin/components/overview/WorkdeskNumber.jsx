import { useLayoutEffect, useRef } from 'react';
import useReducedStudioMotion from '../operations/useReducedStudioMotion';
import { formatWorkspaceNumber } from '../../../utils/workspaceLocale';

export default function WorkdeskNumber({ value, numberFormat, currency, suffix = '' }) {
  const reduced = useReducedStudioMotion();
  const visual = useRef(null);
  const current = useRef(0);
  const valid = typeof value === 'number' && Number.isFinite(value);
  const formatted = formatWorkspaceNumber(value, { numberFormat }, currency
    ? { style: 'currency', currency, maximumFractionDigits: 0 } : {}) + (valid ? suffix : '');

  useLayoutEffect(() => {
    if (!valid) { current.current = 0; return; }
    const node = visual.current;
    const from = current.current;
    let animation = 0;
    let start;
    let displayed = node.textContent;
    function display(text) {
      if (text === displayed) return;
      node.textContent = text;
      displayed = text;
    }
    function finish() {
      cancelAnimationFrame(animation);
      current.current = value;
      display(formatted);
    }
    if (from === value || reduced || document.hidden) { finish(); return; }
    const formatter = new Intl.NumberFormat(numberFormat === 'international' ? 'en-US' : 'en-IN', {
      maximumFractionDigits: 0, ...(currency ? { style: 'currency', currency } : {}),
    });
    function paint(next) {
      current.current = next;
      display(formatter.format(next) + suffix);
    }
    paint(from);
    function step(time) {
      start ??= time;
      const progress = Math.min(1, (time - start) / 1200);
      if (progress === 1 || document.hidden) { finish(); return; }
      paint(from + (value - from) * (1 - (1 - progress) ** 4));
      if (displayed === formatted) { finish(); return; }
      animation = requestAnimationFrame(step);
    }
    const onVisibility = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', onVisibility);
    animation = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animation);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [value, valid, formatted, suffix, numberFormat, currency, reduced]);
  return <span className="sx-desk-figure"><span ref={visual} aria-hidden="true">{formatted}</span><span className="sr-only">{formatted}</span></span>;
}
