import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUpRight, Camera, Link2, Play, UsersRound } from 'lucide-react';

export default function ProductHero({ children }) {
  const showcase = useRef(null);

  useEffect(() => {
    const stage = showcase.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previousProgress = -1;
    let previousDirection = 0;

    // Measure the stationary stage, never the transformed screen inside it.
    function updateReveal() {
      frame = 0;
      let progress = 1;
      let direction = 1;
      if (!reducedMotion.matches && !stage.contains(document.activeElement)) {
        const { top, bottom, height } = stage.getBoundingClientRect();
        const viewport = window.innerHeight;
        const travel = Math.max(1, Math.min(height, viewport) * 0.6);
        const visible = Math.max(0, Math.min(1, (viewport - top) / travel, bottom / travel));
        progress = visible * visible * (3 - 2 * visible);
        direction = viewport - top < bottom ? 1 : -1;
      }
      if (progress === previousProgress && direction === previousDirection) return;
      previousProgress = progress;
      previousDirection = direction;
      stage.style.setProperty('--showcase-progress', progress.toFixed(4));
      stage.style.setProperty('--showcase-origin', direction === 1 ? '0%' : '100%');
      stage.style.setProperty('--showcase-lift', `${(1 - progress) * 72 * direction}px`);
      stage.style.setProperty('--showcase-tilt', `${(1 - progress) * 12 * direction}deg`);
      stage.style.setProperty('--showcase-scale', String(0.9 + progress * 0.1));
      stage.style.setProperty('--showcase-opacity', String(0.18 + progress * 0.82));
    }
    function scheduleReveal() {
      if (!frame) frame = window.requestAnimationFrame(updateReveal);
    }

    updateReveal();
    window.addEventListener('scroll', scheduleReveal, { passive: true });
    window.addEventListener('resize', scheduleReveal);
    reducedMotion.addEventListener('change', scheduleReveal);
    stage.addEventListener('focusin', scheduleReveal);
    stage.addEventListener('focusout', scheduleReveal);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleReveal) : null;
    resizeObserver?.observe(stage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleReveal);
      window.removeEventListener('resize', scheduleReveal);
      reducedMotion.removeEventListener('change', scheduleReveal);
      stage.removeEventListener('focusin', scheduleReveal);
      stage.removeEventListener('focusout', scheduleReveal);
      resizeObserver?.disconnect();
    };
  }, []);

  function moveLight(event) {
    if(event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width, y=(event.clientY-rect.top)/rect.height;
    event.currentTarget.style.setProperty('--light-x', `${x*100}%`);
    event.currentTarget.style.setProperty('--light-y', `${y*100}%`);
    event.currentTarget.style.setProperty('--scene-x', `${(0.5-y)*1.6}deg`);
    event.currentTarget.style.setProperty('--scene-y', `${(x-0.5)*1.6}deg`);
  }
  function resetLight(event) {
    event.currentTarget.style.setProperty('--scene-x','0deg');
    event.currentTarget.style.setProperty('--scene-y','0deg');
  }
  return <section className="sos-launch" id="workspace">
    <div className="sos-launch-halo" aria-hidden="true"><i/><i/></div>
    <div className="sos-container">
      <div className="sos-launch-kicker"><span><i/>STUDIO OS ULTRA · MADE FOR PHOTOGRAPHERS</span><small>PRODUCT PREVIEW</small></div>
      <div className="sos-launch-intro">
        <div className="sos-launch-headline">
          <div className="sos-headline-glow" aria-hidden="true"><i/><i/><i/></div>
          <h1>Supercharge your<br/><span>photography business.</span></h1>
        </div>
        <div className="sos-launch-pitch"><p>One photographer. Or an entire studio.<br/>Bring your clients, crew, money and delivery into one connected workspace.</p><div className="sos-launch-actions"><a href="#for-photographers" className="sos-button dark">Find your workflow<ArrowUpRight size={17}/></a><a href="#product-demo" className="sos-launch-tour"><Play size={13} fill="currentColor"/>Explore the product</a></div></div>
      </div>
      <div className="sos-launch-audiences"><a href="#for-photographers"><Camera size={17}/><span>Working solo?<strong>Run your business with clarity.</strong></span><ArrowUpRight size={16}/></a><a href="#for-photographers"><UsersRound size={18}/><span>Leading a team?<strong>Keep every hand-off connected.</strong></span><ArrowUpRight size={16}/></a><a href="#on-the-go" className="sos-launch-mobile">Create. Quote. Invoice. Collect.<span>Wherever the work takes you.<ArrowDown size={15}/></span></a></div>
      <div className="sos-showcase-stage" ref={showcase}>
        <div className="sos-showcase-scroll-cue" aria-hidden="true"><span>YOUR NEXT CHAPTER, IN VIEW</span><ArrowDown size={16}/></div>
        <div className="sos-showcase-frame" onPointerMove={moveLight} onPointerLeave={resetLight}><div className="sos-showcase-beams" aria-hidden="true"><i/><i/><i/></div><div className="sos-showcase-label"><span><i/>A WORKSPACE THAT WORKS WITH YOU</span><a href="#smart-link">Explore the client side<Link2 size={14}/><ArrowUpRight size={13}/></a></div>{children}<div className="sos-showcase-caption"><span>Your new Overview. Explore daylight and dark mode.</span><span>Product preview · Sample data</span></div></div>
      </div>
    </div>
  </section>;
}
