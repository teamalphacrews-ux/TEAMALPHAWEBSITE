import { useCallback, useEffect, useState } from 'react';
import { usesIPhoneAppNavigation } from '../../../native/appNavigation';

export default function useIPhoneAppNavigation(user) {
  const read = useCallback(() => usesIPhoneAppNavigation({
    nativeAvailable: window.StudioOSNative?.available === true,
    userAgent: navigator.userAgent,
    previewDevice: document.documentElement.dataset.studioAppPreview,
    allowPreview: import.meta.env.DEV && import.meta.env.VITE_STUDIO_IOS_PREVIEW === 'true' && user?.isPreview === true,
  }), [user?.isPreview]);
  const [enabled, setEnabled] = useState(read);
  useEffect(() => {
    const update = () => setEnabled(read());
    window.addEventListener('studio-preview:device', update);
    update();
    return () => window.removeEventListener('studio-preview:device', update);
  }, [read]);
  return enabled;
}
