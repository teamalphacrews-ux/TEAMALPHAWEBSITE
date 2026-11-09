import { useCallback, useEffect, useState } from 'react';
import { saasRequest } from './api';
import { loadPublicConfig } from './publicConfig';

export function usePublicConfig() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ config: null, loading: true, error: '' });
  const retry = useCallback(() => {
    setState({ config: null, loading: true, error: '' });
    setAttempt(value => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadPublicConfig(saasRequest, { signal: controller.signal })
      .then(config => { if (!controller.signal.aborted) setState({ config, loading: false, error: '' }); })
      .catch(error => {
        if (!controller.signal.aborted) setState({
          config: null, loading: false,
          error: error.name === 'TimeoutError' ? error.message : 'Check your connection and try again. Registration availability has not been confirmed.',
        });
      });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, retry };
}
