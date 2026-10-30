import { useEffect } from 'react';
import { installStudioMobileViewport } from '../../../utils/mobileViewport';

/** Keep fixed controls clear of the software keyboard without resizing content on scroll. */
export default function useMobileViewport() {
  useEffect(() => installStudioMobileViewport(window, document), []);
}
