import { useEffect, useState } from 'react';
import { saasRequest } from './api';
import { loadPublicAuthConfig } from './publicAuthConfig';

export function usePublicAuthConfig() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ config: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    loadPublicAuthConfig(saasRequest, { signal: controller.signal })
      .then(config => { if (!controller.signal.aborted) setState({ config, loading: false, error: '' }); })
      .catch(error => {
        if (!controller.signal.aborted) setState({ config: null, loading: false, error: error.message === 'Failed to fetch' ? 'We could not reach sign-in. Check your connection and try again.' : error.message || 'Sign-in availability could not be checked. Please try again.' });
      });
    return () => controller.abort();
  }, [attempt]);
  const retry = () => { setState({ config: null, loading: true, error: '' }); setAttempt(value => value + 1); };
  return { ...state, retry };
}
