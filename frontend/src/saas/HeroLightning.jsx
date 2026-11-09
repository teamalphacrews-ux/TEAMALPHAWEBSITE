import { useEffect, useRef } from 'react';
import './heroLightning.css';

const clamp = value => Math.max(0, Math.min(1, value));
const ease = (value, start, end) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

function randomField(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

// Displacement is distributed at several scales, rather than alternating teeth.
// A channel keeps its identity while the leader and return stroke travel through it.
function channel(start, end, amplitude, depth, random) {
  if (!depth) return [start, end];
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const along = .42 + random() * .16;
  const displacement = (random() + random() - 1) * amplitude;
  const midpoint = {
    x: start.x + dx * along - dy / length * displacement,
    y: start.y + dy * along + dx / length * displacement,
  };
  const left = channel(start, midpoint, amplitude * .54, depth - 1, random);
  const right = channel(midpoint, end, amplitude * .54, depth - 1, random);
  return left.slice(0, -1).concat(right);
}

function makeDischarge(width, height) {
  const random = randomField(147139);
  const sources = [
    [{ x: -.045 * width, y: .15 * height }, { x: .575 * width, y: .54 * height }, .84],
    [{ x: 1.035 * width, y: .91 * height }, { x: .455 * width, y: .43 * height }, .68],
  ];
  return sources.map(([start, end, strength], index) => {
    const points = channel(start, end, Math.min(width * .12, height * .51), 7, random);
    const branches = [];
    const forkPositions = index ? [14, 31, 49, 70, 91, 106] : [19, 38, 58, 77, 95, 113];
    forkPositions.forEach((position, fork) => {
      const origin = points[position];
      const next = points[Math.min(position + 5, points.length - 1)];
      const angle = Math.atan2(next.y - origin.y, next.x - origin.x)
        + (fork % 2 ? 1 : -1) * (.5 + random() * .7);
      const length = Math.min(width * .16, height * .64) * (.42 + random() * .58) * (1 - position / points.length * .3);
      const tip = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
      const forkPoints = channel(origin, tip, length * .29, 5, random);
      const onset = position / (points.length - 1);
      const energy = .26 + random() * .25;
      branches.push({ points: forkPoints, onset, energy, width: .58 + random() * .38 });
      if (fork % 2 === 0) {
        const branchOrigin = forkPoints[12 + Math.floor(random() * 7)];
        const branchAngle = angle + (random() < .5 ? -1 : 1) * (.65 + random() * .6);
        const branchLength = length * (.23 + random() * .25);
        branches.push({
          points: channel(branchOrigin, { x: branchOrigin.x + Math.cos(branchAngle) * branchLength, y: branchOrigin.y + Math.sin(branchAngle) * branchLength }, branchLength * .3, 4, random),
          onset: onset + .09,
          energy: energy * .44,
          width: .34,
        });
      }
    });
    return { points, branches, strength };
  });
}

function trace(context, points, reveal) {
  const target = clamp(reveal) * (points.length - 1);
  const count = Math.floor(target);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index <= count; index++) context.lineTo(points[index].x, points[index].y);
  if (count < points.length - 1) {
    const from = points[count], to = points[count + 1], remainder = target - count;
    context.lineTo(from.x + (to.x - from.x) * remainder, from.y + (to.y - from.y) * remainder);
  }
}

function paintChannel(context, points, reveal, energy, width, ratio, fork = false) {
  if (reveal <= 0 || energy < .004) return;
  trace(context, points, reveal);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = clamp(energy);

  // Diffuse ionised air, the blue sheath, then the narrow incandescent core.
  context.shadowBlur = (fork ? 8 : 22) * ratio;
  context.shadowColor = 'rgba(84,113,255,.85)';
  context.strokeStyle = fork ? 'rgba(112,145,255,.18)' : 'rgba(97,128,255,.10)';
  context.lineWidth = width * (fork ? 3.2 : 8);
  context.stroke();
  context.shadowBlur = (fork ? 3 : 8) * ratio;
  context.shadowColor = 'rgba(143,190,255,.9)';
  context.strokeStyle = 'rgba(151,201,255,.74)';
  context.lineWidth = width * 1.7;
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = fork ? 'rgba(226,241,255,.74)' : 'rgba(250,253,255,.98)';
  context.lineWidth = width * .64;
  context.stroke();

  // The last section loses diameter and energy into the air instead of ending
  // with the same tubular width as its source.
  const tailStart = Math.max(0, Math.floor(points.length * .68));
  if (reveal > .72 && tailStart < points.length - 1) {
    trace(context, points.slice(tailStart), (reveal - .68) / .32);
    context.strokeStyle = 'rgba(255,255,255,.8)';
    context.lineWidth = width * .27;
    context.globalAlpha = clamp(energy * .62);
    context.stroke();
  }
}

export default function HeroLightning() {
  const root = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const element = root.current;
    const surface = element.closest('.sos-reactor-launch');
    const headline = element.closest('.sos-launch-headline');
    const screen = canvas.current;
    if (!surface) return undefined;
    let context;
    try { context = screen.getContext('2d', { alpha: true }); } catch { return undefined; }
    if (!context) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, width = 0, height = 0, ratio = 1;
    let visible = true, disposed = false;
    let paths = [];
    let progress = Number.parseFloat(surface.style.getPropertyValue('--hero-scroll-progress')) || 0;
    let previousActiveProgress = -1;
    let lastInput = -Infinity, strokeStart = -Infinity, lastPaint = -Infinity;
    let forwardArmed = true, reverseArmed = true, paintCount = 0, strokeCount = 0;

    const modeAllows = () => !reduced.matches && !document.hidden && visible
      && surface.dataset.heroPaused !== 'true' && surface.dataset.heroScrubMode === 'pinned';
    const inBand = () => progress > .485 && progress < .955;
    const setPhase = phase => {
      if (element.dataset.lightningPhase !== phase) element.dataset.lightningPhase = phase;
    };
    const clear = phase => {
      context.clearRect(0, 0, width, height);
      headline?.style.setProperty('--hero-lightning-energy', '0');
      element.dataset.lightningEnergy = '0';
      element.dataset.lightningDrawing = 'false';
      setPhase(phase);
    };
    const stop = phase => {
      cancelAnimationFrame(frame); frame = 0;
      clear(phase);
    };

    function paint(timestamp) {
      frame = 0;
      if (disposed || !modeAllows() || !inBand()) { clear(modeAllows() ? 'idle' : 'suppressed'); return; }
      const inputAge = Math.max(0, timestamp - lastInput);
      const strokeAge = Math.max(0, timestamp - strokeStart);
      const alive = inputAge < 950 || strokeAge < 1100;
      if (!alive) { clear('idle'); return; }
      if (timestamp - lastPaint < 1000 / 30) { frame = requestAnimationFrame(paint); return; }
      lastPaint = timestamp;

      const envelope = ease(progress, .485, .56) * (1 - ease(progress, .83, .955));
      const leader = .12 * Math.exp(-inputAge / 260);
      const returning = Number.isFinite(strokeAge) ? (1 - Math.exp(-strokeAge / 12)) * Math.exp(-strokeAge / 215) * 1.12 : 0;
      const afterglow = Number.isFinite(strokeAge) ? Math.exp(-strokeAge / 470) * .13 : 0;
      const energy = Math.min(1, leader + returning + afterglow) * envelope;
      if (energy < .006) { clear('idle'); return; }
      headline?.style.setProperty('--hero-lightning-energy', energy.toFixed(3));
      element.dataset.lightningEnergy = energy.toFixed(3);

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = 1;
      const spill = context.createRadialGradient(width * .52, height * .48, 0, width * .52, height * .48, Math.min(width * .38, height * 1.2));
      spill.addColorStop(0, `rgba(152,196,255,${energy * .14})`);
      spill.addColorStop(.38, `rgba(81,125,255,${energy * .05})`);
      spill.addColorStop(1, 'rgba(64,82,184,0)');
      context.fillStyle = spill;
      context.fillRect(0, 0, width, height);

      const reveal = ease(progress, .485, .745);
      paths.forEach((discharge, index) => {
        const reach = clamp(reveal * 1.14 - index * .035);
        discharge.branches.forEach(branch => {
          const branchReach = clamp((reach - branch.onset) / .24);
          paintChannel(context, branch.points, branchReach, energy * discharge.strength * branch.energy, branch.width, ratio, true);
        });
        paintChannel(context, discharge.points, reach, energy * discharge.strength, width < 650 ? 1.07 : 1.24, ratio);
      });
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      element.dataset.lightningDrawing = 'true';
      element.dataset.lightningFrame = String(++paintCount);
      setPhase(strokeAge < 180 ? 'return' : strokeAge < 1100 ? 'afterglow' : 'leader');
      frame = requestAnimationFrame(paint);
    }

    const schedule = () => { if (!frame && modeAllows() && inBand()) frame = requestAnimationFrame(paint); };

    function updateProgress(next) {
      const timestamp = performance.now();
      progress = clamp(next);
      element.dataset.lightningProgress = progress.toFixed(4);
      if (!modeAllows()) { stop('suppressed'); return; }
      const direction = previousActiveProgress < 0 ? 0 : Math.sign(progress - previousActiveProgress);
      if (progress < .46) forwardArmed = true;
      if (progress > .975) reverseArmed = true;
      const enteredAtCharge = previousActiveProgress < 0 && progress >= .6 && progress < .94;
      const forwardStrike = forwardArmed && direction > 0 && progress >= .62 && previousActiveProgress < .62;
      const reverseStrike = reverseArmed && direction < 0 && progress <= .84 && previousActiveProgress > .84;
      if (enteredAtCharge || forwardStrike || reverseStrike) {
        if (timestamp - strokeStart >= 1200) {
          strokeStart = timestamp;
          element.dataset.lightningStroke = String(++strokeCount);
        }
        if (direction < 0) reverseArmed = false;
        else forwardArmed = false;
      }
      if (progress !== previousActiveProgress) lastInput = timestamp;
      previousActiveProgress = progress;
      if (!inBand()) { stop('idle'); return; }
      schedule();
    }

    function onProgress(event) {
      if (Number.isFinite(event.detail?.progress)) updateProgress(event.detail.progress);
    }
    function sync() {
      if (!modeAllows()) { stop('suppressed'); return; }
      // A resume does not arm or replay a return stroke at the same position.
      schedule();
    }
    function resize() {
      const bounds = element.getBoundingClientRect();
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1280 / width);
      screen.width = Math.max(1, Math.round(width * ratio));
      screen.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paths = makeDischarge(width, height);
      element.dataset.lightningChannels = String(paths.length);
      element.dataset.lightningBranches = String(paths.reduce((sum, discharge) => sum + discharge.branches.length, 0));
      clear(modeAllows() ? 'idle' : 'suppressed');
      schedule();
    }

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(element);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      sync();
    }, { rootMargin: '40px 0px' }) : null;
    observer?.observe(element);
    surface.addEventListener('sos:hero-scroll', onProgress);
    surface.addEventListener('sos:hero-motion', sync);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    window.addEventListener('resize', resize);
    element.dataset.lightningRenderer = 'canvas2d';
    resize();
    updateProgress(progress);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect(); observer?.disconnect();
      surface.removeEventListener('sos:hero-scroll', onProgress);
      surface.removeEventListener('sos:hero-motion', sync);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      window.removeEventListener('resize', resize);
      headline?.style.removeProperty('--hero-lightning-energy');
    };
  }, []);

  return <div ref={root} className="sos-hero-lightning sos-natural-lightning" aria-hidden="true" data-lightning-phase="idle" data-lightning-drawing="false"><canvas ref={canvas}/></div>;
}
