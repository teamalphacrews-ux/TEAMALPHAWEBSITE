import { useEffect, useLayoutEffect } from 'react';
import { installStudioProductIcons } from '../utils/studioProductMetadata';
import { installStudioBrowserTheme } from '../utils/studioBrowserTheme';

export default function StudioProductMetadata({ accountPage }) {
  useLayoutEffect(() => {
    if (accountPage) return installStudioBrowserTheme(document, 'product-auth');
  }, [accountPage]);
  useEffect(() => installStudioProductIcons(document), []);
  return null;
}
