// Personal Team Alpha deployments omit the commercial product. Local development
// keeps the product preview available; a later SaaS release must opt in at build time.
export const SAAS_RELEASE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_STUDIO_SAAS_ENABLED === 'true';
