export const PUBLIC_CONFIG_TIMEOUT_MS = 10000;

// A failed availability check must never be interpreted as registration being closed.
export async function loadPublicConfig(request, { signal, timeoutMs = PUBLIC_CONFIG_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timer, cancel;
  const cancelled = new Promise((_, reject) => { cancel = reject; });
  const abort = () => {
    controller.abort();
    cancel(Object.assign(new Error('Account availability check was cancelled.'), { name: 'AbortError' }));
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  timer = setTimeout(() => {
    controller.abort();
    cancel(Object.assign(new Error('The account availability check took too long. Please try again.'), { name: 'TimeoutError' }));
  }, timeoutMs);
  try {
    const config = await Promise.race([
      signal?.aborted ? cancelled : request('/config', { publicRequest: true, signal: controller.signal }),
      cancelled,
    ]);
    if (!config || typeof config !== 'object' || Array.isArray(config)
      || typeof config.authEnabled !== 'boolean' || typeof config.enabled !== 'boolean'
      || (config.enabled && !config.authEnabled)) {
      throw new Error('The account availability response could not be confirmed. Please try again.');
    }
    return config;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
