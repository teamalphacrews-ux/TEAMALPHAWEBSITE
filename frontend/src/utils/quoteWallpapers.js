const wallpaperRoot = '/assets/quote-wallpapers';

export const LEGACY_DEFAULT_QUOTE_COVER = '/assets/banner.jpg';
export const DEFAULT_QUOTE_WALLPAPER = wallpaperRoot + '/teal-resin.webp';

export const quoteWallpapers = [
  ['teal-resin', 'Teal resin'],
  ['forest-canopy', 'Forest canopy'],
  ['fern-study', 'Fern study'],
  ['misty-valley', 'Misty valley'],
  ['desert-dunes', 'Desert dunes'],
  ['tidal-shore', 'Tidal shore'],
  ['coastal-dusk', 'Coastal dusk'],
  ['alpine-lake', 'Alpine lake'],
  ['first-light-peaks', 'First-light peaks'],
  ['ink-on-paper', 'Ink on paper'],
].map(([id, title]) => ({
  title,
  cover: wallpaperRoot + '/' + id + '.webp',
  thumbnail: wallpaperRoot + '/thumbs/' + id + '.webp',
}));

export function quotePreviewCover(cover) {
  return !cover || cover === LEGACY_DEFAULT_QUOTE_COVER ? DEFAULT_QUOTE_WALLPAPER : cover;
}
