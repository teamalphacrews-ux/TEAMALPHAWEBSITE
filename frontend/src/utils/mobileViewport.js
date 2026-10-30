const editableSelector = 'textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=range]):not([type=color]), [contenteditable=true]';
const properties = ['--studio-visible-height', '--studio-visible-top'];
const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

/** Track occlusion without treating hardware-keyboard focus or pinch zoom as a keyboard. */
export function installStudioMobileViewport(win, doc) {
  const viewport = win.visualViewport;
  const root = doc.documentElement;
  const previous = properties.map(name => root.style.getPropertyValue(name));
  const previousKeyboard = root.hasAttribute('data-studio-keyboard');
  let width = positive(win.innerWidth, root.clientWidth || 390);
  let baseline = Math.max(positive(win.innerHeight, root.clientHeight || 1), positive(viewport?.height, 1));
  let keyboard = false, frame = null, settle = null, disposed = false, resetBaseline = false;
  const publish = (name, value) => {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  };
  const update = () => {
    frame = null;
    if (disposed) return;
    const nextWidth = positive(win.innerWidth, root.clientWidth || width);
    const layoutHeight = positive(win.innerHeight, root.clientHeight || baseline);
    const visibleHeight = positive(viewport?.height, layoutHeight);
    const top = Math.max(0, Number(viewport?.offsetTop) || 0);
    const zoomed = Math.abs(positive(viewport?.scale, 1) - 1) > .04;
    const field = doc.activeElement;
    const editing = Boolean(field && !field.disabled && !field.readOnly && (field.isContentEditable || field.matches?.(editableSelector)));
    // Rotation must not compare a new landscape height with the portrait baseline.
    if (resetBaseline || Math.abs(nextWidth - width) > 80) {
      baseline = Math.max(layoutHeight, visibleHeight);
      keyboard = false;
      resetBaseline = false;
    }
    width = nextWidth;
    const occlusion = Math.max(layoutHeight - visibleHeight, baseline - visibleHeight);
    const obscured = occlusion > Math.max(120, baseline * .15);
    // Focusout can precede the end of the keyboard's closing animation.
    keyboard = width <= 768 && !zoomed && obscured && (editing || keyboard);
    if (!keyboard && !editing && !zoomed) baseline = Math.max(layoutHeight, visibleHeight);
    root.toggleAttribute('data-studio-keyboard', keyboard);
    publish('--studio-visible-height', `${Math.round(visibleHeight)}px`);
    publish('--studio-visible-top', `${Math.round(top)}px`);
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = win.requestAnimationFrame(update);
  };
  const afterFocus = () => {
    schedule();
    win.clearTimeout(settle);
    settle = win.setTimeout(schedule, 350);
  };
  const orientation = () => { resetBaseline = true; afterFocus(); };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', orientation);
  doc.addEventListener('focusin', afterFocus);
  doc.addEventListener('focusout', afterFocus);
  update();
  return () => {
    if (disposed) return;
    disposed = true;
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', orientation);
    doc.removeEventListener('focusin', afterFocus);
    doc.removeEventListener('focusout', afterFocus);
    if (frame !== null) win.cancelAnimationFrame(frame);
    win.clearTimeout(settle);
    root.toggleAttribute('data-studio-keyboard', previousKeyboard);
    properties.forEach((name, index) => {
      if (previous[index]) root.style.setProperty(name, previous[index]);
      else root.style.removeProperty(name);
    });
  };
}
