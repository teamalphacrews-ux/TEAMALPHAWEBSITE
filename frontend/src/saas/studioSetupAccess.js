import { workspaceId } from './workspaceValues.js';
import { canAccessStudioPath } from '../utils/moduleAccess.js';

export const STUDIO_SETUP_PATH = '/admin/setup';
export const STUDIO_SETUP_REVIEW_PATH = STUDIO_SETUP_PATH + '?restart=1';

export function canReviewStudioSetup(user) {
  return Boolean(workspaceId(user?.workspace)) && user.workspaceRole === 'owner' &&
    user.workspace.setupRequired !== true && user.isPreview !== true;
}

export function requiresStudioSetup(user) {
  return user?.workspace?.setupRequired === true && user.isPreview !== true;
}

// A reviewed step must leave untouched fields available for independent edits in Settings.
export function changedSetupFields(values, saved, keys = Object.keys(values || {})) {
  return Object.fromEntries(keys
    .filter(key => String(values?.[key] ?? '') !== String(saved?.[key] ?? ''))
    .map(key => [key, values[key]]));
}

// Return only to a permitted, same-site workspace page after setup.
export function afterStudioSetup(user, destination) {
  if (typeof destination !== 'string' || destination.length > 2048 || !destination.startsWith('/') || destination.startsWith('//') || /[\\\s]/.test(destination)) return '/admin';
  const base = 'https://studio.invalid';
  const url = new URL(destination, base);
  if (url.origin !== base || !canAccessStudioPath(user, url.pathname)) return '/admin';
  return url.pathname + url.search + url.hash;
}
