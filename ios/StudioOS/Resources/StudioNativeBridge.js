(() => {
  'use strict';
  if (window.top !== window || window.StudioOSNative?.available) return;
  const handler = window.webkit?.messageHandlers?.studioOS;
  if (!handler) return;
  let epoch = 0;
  let workspaceContext = null;
  const send = message => {
    try { return Promise.resolve(handler.postMessage(message)); }
    catch (error) { return Promise.reject(error); }
  };
  const encode = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsDataURL(blob);
  });
  const showFailure = failure => {
    if (failure?.name !== 'AbortError') window.alert(failure?.message || 'This action could not be completed.');
  };
  async function saveFile(blob, filename = 'Studio-OS-file') {
    if (!(blob instanceof Blob) || blob.size > 50 * 1024 * 1024) throw new Error('Choose a file of 50 MB or less.');
    const id = crypto.randomUUID(), identity = epoch;
    try {
      await send({ type: 'documentStart', id, filename: String(filename), size: blob.size, mime: blob.type });
      for (let offset = 0, index = 0; offset < blob.size; offset += 192 * 1024, index++) {
        if (identity !== epoch) throw new DOMException('Your workspace changed. Download cancelled.', 'AbortError');
        const data = await encode(blob.slice(offset, offset + 192 * 1024));
        if (identity !== epoch) throw new DOMException('Your workspace changed. Download cancelled.', 'AbortError');
        await send({ type: 'documentChunk', id, index, data });
      }
      if (identity !== epoch) throw new DOMException('Your workspace changed. Download cancelled.', 'AbortError');
      await send({ type: 'documentEnd', id });
    } catch (error) {
      await send({ type: 'documentAbort', id }).catch(() => {});
      throw error;
    }
  }
  Object.defineProperty(window, 'StudioOSNative', { value: Object.freeze({
    available: true,
    saveFile,
    deviceStatus() { return send({type:'deviceStatus'}); },
    setPrivacyLock(enabled) { return typeof enabled==='boolean'?send({type:'privacyLock',enabled}):Promise.reject(new TypeError('Choose a valid privacy setting.')); },
    disconnectNotifications() { return send({type:'disconnectNotifications'}); },
    requestNotifications() { return send({type:'requestNotifications'}); },
    openSystemSettings() { return send({type:'openSystemSettings'}); },
    setWorkspaceContext(value) {
      const userId=String(value?.userId||''),workspaceKey=String(value?.workspaceKey||'');
      if(!/^[a-f\d]{24}$/i.test(userId)||!(workspaceKey==='legacy'||/^[a-f\d]{24}$/i.test(workspaceKey)))return Promise.reject(new TypeError('A signed-in studio is required.'));
      const nextContext = userId + ':' + workspaceKey;
      if (workspaceContext !== nextContext) {
        epoch++;
        if (workspaceContext !== null) void send({type:'contextChanged'}).catch(() => {});
        workspaceContext = nextContext;
      }
      return send({type:'workspaceContext',userId,workspaceKey});
    },
    contextChanged() { epoch++; workspaceContext = null; void send({ type: 'contextChanged' }).catch(() => {}); },
  }), configurable: false });
  const decorate = () => {
    document.documentElement?.setAttribute('data-studio-native', 'ios');
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport && document.head) {
      viewport = document.createElement('meta'); viewport.name = 'viewport'; document.head.appendChild(viewport);
    }
    if (viewport && !viewport.content.includes('viewport-fit')) viewport.content = (viewport.content || 'width=device-width, initial-scale=1') + ', viewport-fit=cover';
  };
  decorate();
  document.addEventListener('DOMContentLoaded', decorate, { once: true });
  const appearance = () => {
    const mode = document.documentElement?.getAttribute?.('data-studio-appearance');
    void send({ type: 'appearance', mode: ['dark', 'light'].includes(mode) ? mode : 'system' }).catch(() => {});
  };
  if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    new MutationObserver(appearance).observe(document.documentElement, { attributes: true, attributeFilter: ['data-studio-appearance'] });
    appearance();
  }
  document.addEventListener('click', event => {
    const link = event.target?.closest?.('a[download]');
    if (!link || !link.href.startsWith('blob:')) return;
    let source;
    try { source = new URL(link.href.slice(5)); } catch { return; }
    if (source.origin !== location.origin) return;
    const identity = epoch;
    event.preventDefault();
    const filename = link.download || 'Studio-OS-file';
    void fetch(link.href).then(result => {
      if (!result.ok) throw new Error('This download is unavailable. Please retry.');
      return result.blob();
    }).then(blob => {
      if (identity !== epoch) throw new DOMException('Your workspace changed. Download cancelled.', 'AbortError');
      return saveFile(blob, filename);
    }).catch(showFailure);
  }, true);
  window.print = () => { void send({ type: 'print' }).catch(showFailure); };
  try {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: value => !!value && !value.files?.length && !!(value.url || value.text || value.title) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: value => {
      if (!value || value.files?.length) return Promise.reject(new TypeError('Share a link or text from this screen.'));
      if (navigator.userActivation && !navigator.userActivation.isActive) return Promise.reject(new DOMException('Tap Share to continue.', 'NotAllowedError'));
      return send({ type: 'share', title: String(value.title || ''), text: String(value.text || ''), url: String(value.url || '') }).then(() => undefined);
    } });
  } catch { /* Existing browser sharing remains available if these properties are fixed. */ }
})();
