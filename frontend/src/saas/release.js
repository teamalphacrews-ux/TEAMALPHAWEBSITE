import { resolveStudioDeployment } from './releaseConfig';

// Team Alpha production remains the default. The commercial service opts in.
const deployment = resolveStudioDeployment(import.meta.env);
export const IS_COMMERCIAL_DEPLOYMENT = deployment.isCommercial;
export const SAAS_RELEASE_ENABLED = deployment.saasReleaseEnabled;
