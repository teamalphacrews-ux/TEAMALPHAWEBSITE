import calendarLogo from '../assets/integrations/google-calendar.svg';
import gmailLogo from '../assets/integrations/gmail.svg';
import whatsappLogo from '../assets/integrations/whatsapp-business.jpg';

// Delivery derivatives of the owner's supplied Studio X OS logo pack.
// These variants belong only to the commercial homepage presentation.
export const PRODUCT_BRAND = Object.freeze({
  symbol: '/assets/studio-x-os/symbol-color-768-20261108.webp',
  symbolWhite: '/assets/studio-x-os/symbol-white-512-20261108.webp',
  wordmark: '/assets/studio-x-os/wordmark-white-1024-20261110.webp',
  wordmarkSrcSet: [1024, 2048, 3072, 4096].map(width => `/assets/studio-x-os/wordmark-white-${width}-20261110.webp ${width}w`).join(', '),
  wordmarkSizes: '(min-width: 1432px) 1320px, (min-width: 1101px) calc(100vw - 112px), (min-width: 601px) calc(100vw - 64px), calc(100vw - 40px)',
  lockup: '/assets/studio-x-os/lockup-white-640-20261108.webp',
});

export const integrationArtwork = Object.freeze({ 'Google Calendar': calendarLogo, Gmail: gmailLogo, 'WhatsApp Business': whatsappLogo });
