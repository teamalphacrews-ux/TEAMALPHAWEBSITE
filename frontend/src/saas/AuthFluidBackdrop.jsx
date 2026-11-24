import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const HERO_VIDEO = '/assets/studio-x-os/media/20261115/fluid-hero-1280-ac3c8a467059.mp4';
const HERO_POSTER = '/assets/studio-x-os/media/20261115/fluid-hero-poster-c2fb6664b63b.jpg';

/** The sign-in surface shares the homepage's media, without loading motion for reduced-motion visitors. */
export default function AuthFluidBackdrop() {
  const backdrop = useRef(null), video = useRef(null);
  const [reduced, setReduced] = useState(() => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => typeof document !== 'undefined' && !document.hidden);
  const [inView, setInView] = useState(true), [paused, setPaused] = useState(false);
  const [playback, setPlayback] = useState('loading');
  const unavailable = playback === 'unavailable';

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduced(preference.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    preference.addEventListener('change', updatePreference);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { threshold: 0.01 });
    if (backdrop.current) observer?.observe(backdrop.current);
    return () => {
      preference.removeEventListener('change', updatePreference);
      document.removeEventListener('visibilitychange', updateVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const media = video.current;
    if (!media) return;
    let active = true;
    if (reduced || paused || !visible || !inView) {
      media.pause();
      if (reduced && media.hasAttribute('src')) {
        media.removeAttribute('src');
        media.load();
      }
    } else if (!unavailable) {
      if (!media.hasAttribute('src')) {
        media.src = HERO_VIDEO;
        media.load();
      }
      media.muted = true;
      media.play().catch(() => {
        if (active && !media.error) setPaused(true);
      });
    }
    return () => { active = false; media.pause(); };
  }, [reduced, paused, visible, inView, unavailable]);

  const label = reduced ? 'Motion reduced' : unavailable ? 'Motion unavailable' : paused ? 'Resume motion' : playback === 'playing' ? 'Pause motion' : 'Loading motion…';
  const actionLabel = reduced ? 'Background motion reduced by device preference' : unavailable ? 'Background motion is unavailable' : paused ? 'Resume background motion' : playback === 'playing' ? 'Pause background motion' : 'Pause background motion while it loads';

  return <>
    <div className="saas-login-fluid-backdrop" ref={backdrop} aria-hidden="true">
      <video ref={video} className="saas-login-fluid-video" poster={HERO_POSTER} preload="none" muted loop playsInline onPlaying={() => setPlayback('playing')} onPause={() => setPlayback(current => current === 'unavailable' ? current : 'paused')} onWaiting={() => setPlayback('loading')} onError={() => setPlayback('unavailable')} />
      <div className="saas-login-fluid-scrim" />
    </div>
    <button className="saas-login-motion-toggle" type="button" onClick={() => setPaused(current => !current)} disabled={reduced || unavailable} aria-pressed={reduced || paused || playback !== 'playing'} aria-label={actionLabel}>
      {paused && !reduced ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{label}</span>
    </button>
  </>;
}
