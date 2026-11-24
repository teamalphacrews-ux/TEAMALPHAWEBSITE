import { useLayoutEffect, useRef } from 'react';
import './sectionSelection.css';

// Move each edge separately. The leading edge reaches the new tab first.
export default function SectionSelectionIndicator({ selection }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const indicator = ref.current;
    const list = indicator.parentElement;
    const current = list.querySelector('button[aria-pressed="true"],button[aria-current="page"],[role="tab"][aria-selected="true"]');
    if (!current) { indicator.hidden = true; return; }
    const measure = (travel = false) => {
      const start = current.offsetLeft;
      const end = start + current.offsetWidth;
      if (list.hasAttribute('data-wrap-sections')) {
        // A wrapped tab keeps its underline on the same row at narrow widths.
        indicator.style.setProperty('--section-rule-y', current.offsetTop + current.offsetHeight - 3 + 'px');
      }
      const oldStart = Number(indicator.dataset.start);
      indicator.dataset.direction = !travel || indicator.hidden || oldStart === start ? 'none' : start > oldStart ? 'right' : 'left';
      indicator.dataset.start = String(start);
      indicator.dataset.width = String(current.offsetWidth);
      indicator.style.left = start + 'px';
      indicator.style.right = 'calc(100% - ' + end + 'px)';
      indicator.hidden = false;
    };
    measure(true);
    const observer = new ResizeObserver(() => {
      const shiftedRow = list.hasAttribute('data-wrap-sections') &&
        indicator.style.getPropertyValue('--section-rule-y') !== current.offsetTop + current.offsetHeight - 3 + 'px';
      if (shiftedRow || current.offsetLeft !== Number(indicator.dataset.start) || current.offsetWidth !== Number(indicator.dataset.width)) {
        measure();
      }
    });
    for (const element of [list, ...list.querySelectorAll('button')]) observer.observe(element);
    return () => observer.disconnect();
  }, [selection]);
  return <span aria-hidden="true" ref={ref} hidden className="sx-section-selection" />;
}
