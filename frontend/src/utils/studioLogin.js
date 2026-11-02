// Bound a fresh sign-in, including response decoding, without retrying credentials.
export async function requestStudioLogin(api, credentials, { fetcher = globalThis.fetch, signal, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  let timer, cancel;
  const stopped = new Promise((_resolve, reject) => {
    cancel = () => {
      reject(new DOMException('Sign-in was cancelled.', 'AbortError'));
      controller.abort();
    };
    timer = setTimeout(() => {
      reject(Object.assign(new Error('Your studio did not respond in time. Check your connection, then try signing in again.'), { name: 'TimeoutError' }));
      controller.abort();
    }, timeoutMs);
  });
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) cancel();
    const attempt = async () => {
      if (controller.signal.aborted) throw new DOMException('Sign-in was cancelled.', 'AbortError');
      const result = await fetcher(api + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ email: credentials.email.trim(), password: credentials.password, role: 'admin' }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.msg || 'Please check your email and password.');
      if (data.user?.role !== 'admin') throw new Error('This sign-in is for the studio team.');
      if (typeof data.token !== 'string' || !data.token.trim()) throw new Error('Sign-in could not be completed. Please try again.');
      return data;
    };
    return await Promise.race([attempt(), stopped]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
