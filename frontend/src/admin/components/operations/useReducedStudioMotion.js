import { useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
const subscribe = (callback) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-studio-motion'] });
  return () => { media.removeEventListener("change", callback); observer.disconnect(); };
};
export default function useReducedStudioMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches || document.documentElement.getAttribute('data-studio-motion') === 'reduced',
    () => true,
  );
}
