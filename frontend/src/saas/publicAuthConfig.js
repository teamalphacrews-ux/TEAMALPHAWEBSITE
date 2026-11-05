// Public readiness only. Provider credentials always stay on the API server.
export function socialProviderState(config, provider, purpose, loading = false) {
  if (loading) return 'checking';
  if (!config?.oauth) return 'unknown';
  if (config.authEnabled !== true) return 'unavailable';
  if (purpose === 'signup' && config.enabled !== true) return 'closed';
  return config.oauth[provider]?.enabled === true ? 'ready' : 'unavailable';
}

export async function loadPublicAuthConfig(request, { signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const config = await request('/config', { publicRequest: true, signal: controller.signal });
    if (typeof config?.enabled !== 'boolean' || typeof config?.authEnabled !== 'boolean' || !config.oauth || typeof config.oauth !== 'object') {
      throw new Error('Sign-in availability could not be confirmed. Please try again.');
    }
    return config;
  } catch (error) {
    if (timedOut) throw new Error('The sign-in service is taking longer than expected. Please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
