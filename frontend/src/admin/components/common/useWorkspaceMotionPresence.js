import { useEffect, useState } from 'react';
import { workspaceMotionAllowed } from './workspaceMotion';

// Closing releases focus and interaction immediately. Keep only the inert
// visual surface for its exit; reopening cancels the pending removal.
export default function useWorkspaceMotionPresence(open, duration, enabled = true) {
  const [previous, setPrevious] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (previous !== open) {
    setPrevious(open);
    setLeaving(!open && enabled && workspaceMotionAllowed());
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(false), duration);
    return () => window.clearTimeout(timer);
  }, [leaving, duration]);
  return { present: open || leaving, leaving };
}
