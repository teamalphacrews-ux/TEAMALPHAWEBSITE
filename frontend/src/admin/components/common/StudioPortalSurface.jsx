import { useStudioPreferences } from './StudioPreferences';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';

// React context crosses portals; DOM attributes must be carried to each surface.
export default function StudioPortalSurface({ className = '', ...props }) {
  const { preferences } = useStudioPreferences();
  return <div {...props} className={'studio-app studio-personal-workspace ' + (IS_COMMERCIAL_DEPLOYMENT ? 'studio-commercial-glass ' : '') + className} data-studio-text-size={preferences.textSize} data-studio-theme={preferences.theme} data-studio-motion={preferences.reduceMotion ? 'reduced' : 'standard'} />;
}
