import { useEffect } from 'react';
import { installStudioProductIcons } from '../utils/studioProductMetadata';

export default function StudioProductMetadata() {
  useEffect(() => installStudioProductIcons(document), []);
  return null;
}
