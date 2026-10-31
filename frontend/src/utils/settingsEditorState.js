import defaults from '../admin/studio-settings-defaults.json' with { type: 'json' };

export const settingsSectionKeys = {
  profile: ['studioName', 'legalName', 'gstin', 'email', 'phone', 'website', 'address', 'profilePhotoUrl', 'whatsappNumber', 'whatsappMessage', 'instagramUrl', 'facebookUrl'],
  branding: ['logoUrl', 'coverImage', 'colorTheme', 'fontTheme'],
  billing: ['billingDefaults', 'bankDetails', 'upiId', 'paymentInstructions'],
  automation: ['automation', 'quotationValidityDays'],
  communication: ['communication', 'quotationTerms', 'defaultDeliverables'],
  production: ['productionDefaults'], client: ['clientLinkDefaults'], security: ['security'], backups: ['backups'],
};
export function settingsWithDefaults(saved = {}) {
  const value = { ...saved };
  for (const key of Object.keys(defaults)) value[key] = { ...structuredClone(defaults[key]), ...(saved[key] || {}) };
  value.security.permissions = { ...defaults.security.permissions, ...(saved.security?.permissions || {}) };
  return value;
}
export function changedSettingsSections(values, baseline) {
  return Object.entries(settingsSectionKeys).filter(([, keys]) => keys.some(key => JSON.stringify(values[key]) !== JSON.stringify(baseline[key]))).map(([id]) => id);
}
export function restoreSettingsSection(values, baseline, section) {
  const next = { ...values };
  for (const key of settingsSectionKeys[section] || []) {
    if (Object.hasOwn(baseline, key)) next[key] = structuredClone(baseline[key]);
    else delete next[key];
  }
  return next;
}
