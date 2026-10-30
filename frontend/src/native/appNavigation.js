// Device identity, not viewport width: an iPad window can be as narrow as an iPhone.
export function usesIPhoneAppNavigation({ nativeAvailable = false, userAgent = '', previewDevice = '', allowPreview = false } = {}) {
  if (nativeAvailable) return /iPhone|iPod/i.test(userAgent) && !/iPad/i.test(userAgent);
  return allowPreview && previewDevice === 'iphone';
}
