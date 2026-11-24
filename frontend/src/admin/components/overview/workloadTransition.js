function expoOut(t) {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

function expoInOut(t) {
  if (t === 0 || t === 1) return t;
  return t < .5 ? 2 ** (20 * t - 10) / 2 : 1 - 2 ** (-20 * t + 10) / 2;
}

export function workloadTransition(from, targets, initial) {
  const duration = initial ? 1100 : 800;
  const delay = initial ? 350 : 0;
  const stagger = initial ? 60 : 30;
  const ease = initial ? expoOut : expoInOut;
  return {
    delay,
    end: delay + duration + Math.max(0, targets.length - 1) * stagger,
    sample(elapsed) {
      return targets.map((target, index) => {
        const progress = Math.max(0, Math.min(1, (elapsed - delay - stagger * index) / duration));
        const start = from[index] || 0;
        return start + (target - start) * ease(progress);
      });
    },
  };
}
