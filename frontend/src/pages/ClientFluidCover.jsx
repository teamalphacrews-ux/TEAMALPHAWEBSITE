import { useEffect, useRef } from 'react';

const MEDIA = '/assets/studio-x-os/media/20261115/';
const POSTER = MEDIA + 'fluid-hero-poster-c2fb6664b63b.jpg';
const SMALL = MEDIA + 'fluid-hero-960-e09ba23b4867.mp4';
const LARGE = MEDIA + 'fluid-hero-1280-ac3c8a467059.mp4';

export default function ClientFluidCover({ effectsMode }) {
  const coverRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (effectsMode !== 'playing' || typeof IntersectionObserver !== 'function') return;

    const cover = coverRef.current;
    const video = videoRef.current;
    const compact = window.matchMedia('(max-width: 767px)');
    const reducedData = window.matchMedia('(prefers-reduced-data: reduce)');
    const connection = navigator.connection;
    const controller = new AbortController();
    const events = { signal: controller.signal };
    let inView = false;
    let blocked = false;
    let attempt = 0;

    function showStill() {
      cover.dataset.playing = 'false';
    }

    function releaseVideo() {
      attempt += 1;
      showStill();
      if (video.hasAttribute('src')) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    }

    function updatePlayback() {
      if (controller.signal.aborted) return;
      if (!inView || document.hidden || reducedData.matches || connection?.saveData) {
        releaseVideo();
        return;
      }
      const source = compact.matches ? SMALL : LARGE;
      if (video.getAttribute('src') === source) return;
      showStill();
      blocked = false;
      const current = ++attempt;
      video.src = source;
      video.muted = true;
      video.play().catch(error => {
        if (current !== attempt) return;
        blocked = error.name === 'NotAllowedError';
        releaseVideo();
      });
    }

    function retryBlockedPlayback() {
      if (blocked) updatePlayback();
    }

    function showVideo() {
      if (!video.paused && video.hasAttribute('src')) cover.dataset.playing = 'true';
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(cover);
    document.addEventListener('visibilitychange', updatePlayback, events);
    document.addEventListener('click', retryBlockedPlayback, events);
    document.addEventListener('keydown', retryBlockedPlayback, events);
    window.addEventListener('online', updatePlayback, events);
    compact.addEventListener('change', updatePlayback, events);
    reducedData.addEventListener('change', updatePlayback, events);
    connection?.addEventListener?.('change', updatePlayback, events);
    video.addEventListener('playing', showVideo, events);
    video.addEventListener('pause', showStill, events);
    video.addEventListener('error', releaseVideo, events);

    return () => {
      controller.abort();
      observer.disconnect();
      releaseVideo();
    };
  }, [effectsMode]);

  return (
    <div ref={coverRef} className="cp-fluid-cover" data-playing="false" aria-hidden="true">
      <img className="cp-fluid-cover-poster" src={POSTER} alt="" width="960" height="540" loading="lazy" decoding="async" />
      <video ref={videoRef} className="cp-fluid-cover-video" preload="none" muted loop playsInline disablePictureInPicture />
    </div>
  );
}
