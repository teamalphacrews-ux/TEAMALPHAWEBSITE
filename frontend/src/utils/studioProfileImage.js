// Personal and commercial workspaces share the same upload and document paths.
export function isStudioProfileImagePath(value) {
  return typeof value === 'string' && /^\/api\/studio\/profile-images\/(?:[a-f\d]{24}\.)?[a-f\d]{24}$/i.test(value);
}

export function resolveProfileImage(value, apiOrigin = '') {
  return isStudioProfileImagePath(value) ? apiOrigin.replace(/\/$/, '') + value : value;
}

export function profilePhotoRemoval(values) {
  return { profilePhotoUrl: '', ...(values.profilePhotoUrl && values.logoUrl === values.profilePhotoUrl ? { logoUrl: '' } : {}) };
}

export function confirmProfileImage(url, { ImageType = globalThis.Image, timeoutMs = 15000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const image = new ImageType();
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
      image.onload = image.onerror = null;
      if (error) reject(error);
      else resolve(url);
    };
    const cancel = () => finish(new DOMException('Photo upload was cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error('Your uploaded photo could not be loaded. Please retry before saving.')), timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('Your uploaded photo is not a readable image. Please choose another JPEG, PNG or WebP.'));
    image.onerror = () => finish(new Error('Your uploaded photo could not be loaded. Please retry before saving.'));
    image.src = url;
  });
}
