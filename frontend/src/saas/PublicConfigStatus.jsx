import { ArrowRight, LoaderCircle } from 'lucide-react';

export default function PublicConfigStatus({ loading, slow = false, error, retry }) {
  if (loading) return <div className="saas-info saas-config-status" role="status" aria-live="polite" aria-atomic="true">
    <div><LoaderCircle className="saas-auth-spinner" size={18} aria-hidden="true" /><strong>{slow ? 'Still checking account availability…' : 'Checking account availability…'}</strong></div>
    <p>{slow ? 'The account service is taking longer than usual. We’re still waiting for its response; you don’t need to start again.' : 'Your plan choice stays saved while we check the account service.'}</p>
  </div>;
  if (!error) return null;
  return <div className="saas-info">
    <h2 role="alert">We couldn’t check account availability.</h2>
    <p>{error}</p>
    <button className="saas-primary" type="button" onClick={retry}>Try again<ArrowRight size={16} /></button>
  </div>;
}
