// Shared by the React app and the small controller enhancing the static homepage.
export const PRODUCT_SCREEN_ROOT = '/assets/studio-x-os/screens/20261123/';
export const PRODUCT_PHONE_SCREEN_ROOT = '/assets/studio-x-os/screens/20261126/';
const imageFiles = (id, theme) => ({
  desktop: `${PRODUCT_SCREEN_ROOT}${id}-${theme}-desktop.webp`,
  desktop2x: `${PRODUCT_SCREEN_ROOT}${id}-${theme}-desktop@2x.webp`,
  mobile2x: `${PRODUCT_SCREEN_ROOT}${id}-${theme}-mobile@2x.webp`,
});

export const CLIENT_SMART_LINK_SCREENSHOT = {
  id: 'client-smart-link', title: 'Client Smart Link',
  description: 'A private fictional client dashboard with quotation, invoice, payment and post-production cards.',
  alt: 'Studio X OS — Client Smart Link. Fictional sample workspace.',
  width: 1440, height: 960, mobileWidth: 390, mobileHeight: 994,
  light: imageFiles('client-smart-link', 'light'), dark: imageFiles('client-smart-link', 'dark'),
};

export const CLIENT_CAPTURE_VIEWS = [
  { id: 'overview', label: 'Overview', caption: 'The current client dashboard, with quotation, invoice, payment and production cards.' },
  { id: 'quote', label: 'Quotation', caption: 'The client’s quotation, opened from the same project link.' },
  { id: 'invoice', label: 'Invoice', caption: 'The issued invoice, presented inside the client project workspace.' },
  { id: 'payments', label: 'Payments', caption: 'The payment schedule and studio-provided instructions. Your studio confirms receipts.' },
  { id: 'production', label: 'Production', caption: 'Published production progress and delivery information for the client.' },
];
export const INITIAL_CAPTURE_ERROR = 'This capture couldn’t load. Try again or open the image full size.';
export const captureView = id => CLIENT_CAPTURE_VIEWS.find(view => view.id === id);
const appearance = theme => theme === 'dark' ? 'Dark' : 'Day';
export const captureStatus = ({ view, theme }) => `${captureView(view).label} · ${appearance(theme)} appearance · Actual product capture`;
export const captureLoading = ({ view, theme }) => `Opening ${captureView(view).label} in ${appearance(theme).toLowerCase()} mode…`;
export const captureFailure = ({ view }) => `The ${captureView(view).label} capture couldn’t load. Try again or open the current image full size.`;
export const captureAlt = ({ view, theme }) => `Current Studio X OS client ${captureView(view).label.toLowerCase()} screen in ${appearance(theme).toLowerCase()} appearance. Fictional sample records.`;
export const captureMobileHeight = view => view === 'overview' ? CLIENT_SMART_LINK_SCREENSHOT.mobileHeight : 844;
export const resolveCaptureImage = (view, theme) => view === 'overview'
  ? CLIENT_SMART_LINK_SCREENSHOT[theme]
  : imageFiles(`client-smart-link-${view}`, theme);

/** Decode before committing, and make superseded or unmounted requests inert. */
export function createCaptureLoader() {
  let requestVersion = 0, stopRequest;
  return {
    async load({ view, theme }) {
      const version = ++requestVersion;
      stopRequest?.();
      const preload = new Image();
      const image = resolveCaptureImage(view, theme);
      try {
        await new Promise((resolve, reject) => {
          let finished = false;
          const finish = failure => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timeout);
            preload.onload = null; preload.onerror = null;
            if (stopRequest === cancel) stopRequest = null;
            if (failure) reject(failure); else resolve();
          };
          const cancel = () => finish(new Error('cancelled'));
          const timeout = window.setTimeout(() => finish(new Error('timeout')), 15000);
          stopRequest = cancel;
          preload.onload = () => preload.decode ? preload.decode().then(() => finish(), () => finish(new Error('decode'))) : finish();
          preload.onerror = () => finish(new Error('image'));
          preload.src = window.matchMedia('(max-width: 600px)').matches ? image.mobile2x || image.desktop : window.devicePixelRatio > 1 ? image.desktop2x : image.desktop;
        });
        return version === requestVersion;
      } catch (error) {
        if (version !== requestVersion) return false;
        throw error;
      }
    },
    cancel() { requestVersion++; stopRequest?.(); },
  };
}
