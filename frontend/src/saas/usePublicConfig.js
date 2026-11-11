import { useCallback, useEffect, useState } from 'react';
import { getPublicConfig } from './publicConfigService';
import { PUBLIC_CONFIG_SLOW_MS } from './publicConfig';

export function usePublicConfig() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ config: null, loading: true, slow: false, error: '' });
  const retry = useCallback(() => {
    setState({ config: null, loading: true, slow: false, error: '' });
    setAttempt(value => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = setTimeout(() => {
      if (!controller.signal.aborted) setState(previous => previous.loading ? { ...previous, slow: true } : previous);
    }, PUBLIC_CONFIG_SLOW_MS);
    getPublicConfig({ signal: controller.signal, fresh: attempt > 0 })
      .then(config => { if (!controller.signal.aborted) setState({ config, loading: false, slow: false, error: '' }); })
      .catch(error => {
        if (!controller.signal.aborted) setState({
          config: null, loading: false, slow: false,
          error: error.name === 'TimeoutError' ? error.message
            : error.status === 429 ? 'The account service has received too many requests. Wait a moment, then try again.'
              : [502, 503, 504].includes(error.status) ? 'The account service is temporarily unavailable. Please try again shortly.'
                : 'Check your connection and try again. Registration availability has not been confirmed.',
        });
      })
      .finally(() => clearTimeout(slowTimer));
    return () => { clearTimeout(slowTimer); controller.abort(); };
  }, [attempt]);
  return { ...state, retry };
}
