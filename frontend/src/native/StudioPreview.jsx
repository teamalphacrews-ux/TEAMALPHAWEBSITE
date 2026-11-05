import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appPreviewDestination } from './studioAppRoutes';

const enabled = import.meta.env.DEV && import.meta.env.VITE_STUDIO_IOS_PREVIEW === 'true';
export function StudioPreviewStart() {
  const { login } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    const previewDevice = new URLSearchParams(window.location.search).get('device');
    if (['iphone', 'ipad', 'desktop'].includes(previewDevice)) document.documentElement.dataset.studioAppPreview = previewDevice;
    fetch('/__studio_ios_preview/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || data.user?.isPreview !== true || data.user?.role !== 'admin' || data.token !== 'local-sample-data-only') throw new Error('The disposable sample workspace could not be confirmed.');
        await login(data.user, data.token);
      }).catch(() => setError('The isolated app preview is unavailable. Start the dedicated sample server and retry.'));
  }, [login]);
  if (!enabled) return <p>This preview entry is available only on the dedicated local development server.</p>;
  return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#111319', color: '#f4f5fa', fontFamily: 'system-ui' }}><div style={{ textAlign: 'center', maxWidth: 320 }}><p style={{ fontSize: 22, marginBottom: 12 }}>Opening Studio OS</p><p role={error ? 'alert' : 'status'} style={{ fontSize: 13, color: '#b4bdce', lineHeight: 1.8 }}>{error || 'Preparing your isolated sample workspace…'}</p>{error && <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px' }}>Retry preview</button>}</div></div>;
}

export function StudioPreviewNavigation() {
  const { user } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  useEffect(() => {
    if (!enabled || user?.isPreview !== true) return;
    const receive = event => {
      if (event.origin !== 'http://127.0.0.1:5173' || event.source !== window.parent) return;
      if (event.data?.type === 'studio-preview:device' && ['iphone', 'ipad', 'desktop'].includes(event.data.device)) {
        document.documentElement.dataset.studioAppPreview = event.data.device;
        window.dispatchEvent(new Event('studio-preview:device'));
        return;
      }
      if (event.data?.type !== 'studio-preview:navigate') return;
      const path = appPreviewDestination(event.data.path);
      if (path) navigate(path);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [user?.isPreview, navigate]);
  useEffect(() => {
    if (!enabled || user?.isPreview !== true) return;
    const params = new URLSearchParams(location.search);
    if (['/admin/workspace', '/admin/subscription'].includes(location.pathname) && !user.workspace && params.get('preview') !== 'saas') {
      params.set('preview', 'saas'); navigate(location.pathname + '?' + params, { replace: true }); return;
    }
    if (window.parent !== window) window.parent.postMessage({ type: 'studio-preview:location', path: location.pathname + location.search, sampleOnly: true }, 'http://127.0.0.1:5173');
  }, [user, location.pathname, location.search, navigate]);
  return null;
}
