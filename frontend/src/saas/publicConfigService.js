import { saasRequest } from './api';
import { createPublicConfigResource } from './publicConfig';

const publicConfig = createPublicConfigResource(saasRequest);

export const getPublicConfig = options => publicConfig.load(options);
export const prefetchPublicConfig = () => publicConfig.prefetch();
