// The public account service can need a cold start. Keep the request bounded,
// but don't turn the observed ~33s startup into a false failure at 10s.
export const PUBLIC_CONFIG_TIMEOUT_MS = 45000;
export const PUBLIC_CONFIG_SLOW_MS = 8000;
export const PUBLIC_CONFIG_CACHE_MS = 15000;

const cancelledError = () => Object.assign(new Error('Account availability check was cancelled.'), { name: 'AbortError' });

// A failed availability check must never be interpreted as registration being closed.
export async function loadPublicConfig(request, { signal, timeoutMs = PUBLIC_CONFIG_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timer, cancel;
  const cancelled = new Promise((_, reject) => { cancel = reject; });
  const abort = () => {
    controller.abort();
    cancel(cancelledError());
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

// Only public capability flags are held in memory, briefly. An intent warmup and
// the following account page share one request; no credentials or plan are sent.
export function createPublicConfigResource(request, {
  timeoutMs = PUBLIC_CONFIG_TIMEOUT_MS,
  cacheMs = PUBLIC_CONFIG_CACHE_MS,
  now = Date.now,
} = {}) {
  let cached, inFlight;
  const start = () => {
    const entry = { controller: new AbortController(), consumers: new Set(), settled: false };
    inFlight = entry;
    entry.promise = loadPublicConfig(request, { signal: entry.controller.signal, timeoutMs })
      .then(value => {
        if (!entry.controller.signal.aborted) cached = { value, at: now() };
        return value;
      })
      .finally(() => {
        entry.settled = true;
        if (inFlight === entry) inFlight = undefined;
      });
    return entry;
  };
  const load = ({ signal, fresh = false } = {}) => {
    if (signal?.aborted) return Promise.reject(cancelledError());
    const age = cached ? now() - cached.at : Infinity;
    if (!fresh && age >= 0 && age < cacheMs) return Promise.resolve(cached.value);
    const entry = inFlight || start();
    return new Promise((resolve, reject) => {
      const consumer = {};
      let finished = false;
      const release = () => {
        if (finished) return false;
        finished = true;
        signal?.removeEventListener('abort', abort);
        entry.consumers.delete(consumer);
        if (!entry.settled && !entry.consumers.size) {
          if (inFlight === entry) inFlight = undefined;
          entry.controller.abort();
        }
        return true;
      };
      const abort = () => { if (release()) reject(cancelledError()); };
      entry.consumers.add(consumer);
      signal?.addEventListener('abort', abort, { once: true });
      entry.promise.then(
        value => { if (release()) resolve(value); },
        error => { if (release()) reject(error); },
      );
    });
  };
  return {
    load,
    // A failed speculative check stays silent. The account page can retry it;
    // failures are never cached or mistaken for a closed-registration response.
    prefetch: () => load().then(() => undefined, () => undefined),
  };
}
