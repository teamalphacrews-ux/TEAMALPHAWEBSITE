import { useStudioPreferences } from './StudioPreferences';

// React context crosses portals; DOM attributes must be carried to each surface.
export default function StudioPortalSurface({ className = '', ...props }) {
  const { preferences } = useStudioPreferences();
  return <div {...props} className={'studio-app studio-personal-workspace ' + className} data-studio-text-size={preferences.textSize} data-studio-theme={preferences.theme} />;
}
