import { RotateCcw } from 'lucide-react';

export default function RestartPreviewLink({ className }) {
  if (!import.meta.env.DEV || import.meta.env.VITE_FIRST_LOGIN_PREVIEW !== 'true') return null;
  return <a className={className} href="/preview-first-login/reset">
    <RotateCcw size={15} aria-hidden="true" />
    Restart preview
  </a>;
}
