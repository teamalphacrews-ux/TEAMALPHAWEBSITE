import { studioText } from './studioTranslations.js';

// Stored paths are ordering hints. Only navigation items supplied by the caller can be returned.
export function normalizeSidebarOrder(order) {
  if (!Array.isArray(order)) return [];
  const paths = order.filter(path => typeof path === 'string' && /^\/admin(?:\/[a-z][a-z0-9-]{0,47})?$/.test(path));
  return [...new Set(paths)].slice(0, 64);
}

export function sortSidebarItems(items, mode, order = [], language = 'en') {
  if (mode === 'alphabetical') {
    const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true });
    return [...items].sort((a, b) => collator.compare(studioText(language, a.name), studioText(language, b.name)));
  }
  if (mode === 'custom') {
    const ranks = new Map(order.map((path, index) => [path, index]));
    return [...items].sort((a, b) => (ranks.get(a.path) ?? ranks.size) - (ranks.get(b.path) ?? ranks.size));
  }
  return items;
}

export function moveSidebarItem(order, visibleSectionItems, path, delta) {
  const paths = visibleSectionItems.map(item => item.path);
  const from = paths.indexOf(path);
  const to = from + delta;
  if (![-1, 1].includes(delta) || from < 0 || to < 0 || to >= paths.length) return order;

  [paths[from], paths[to]] = [paths[to], paths[from]];
  const visible = new Set(paths);
  const combined = [...new Set([...order, ...paths])];
  let index = 0;
  return combined.map(saved => visible.has(saved) ? paths[index++] : saved);
}
