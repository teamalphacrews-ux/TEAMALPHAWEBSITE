// Device identity, not viewport width: an iPad window can be as narrow as an iPhone.
export function usesIPhoneAppNavigation({ nativeAvailable = false, userAgent = '', previewDevice = '', allowPreview = false, allowMobileWeb = false } = {}) {
  if (nativeAvailable) return /iPhone|iPod/i.test(userAgent) && !/iPad/i.test(userAgent);
  if (allowMobileWeb && /iPhone|iPod/i.test(userAgent) && !/iPad/i.test(userAgent)) return true;
  return allowPreview && previewDevice === 'iphone';
}
