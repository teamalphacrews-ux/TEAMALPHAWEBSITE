import { ArrowRight } from 'lucide-react';

export default function PublicConfigStatus({ loading, error, retry }) {
  if (loading) return <p className="saas-info" role="status">Checking account availability…</p>;
  if (!error) return null;
  return <div className="saas-info">
    <h2 role="alert">We couldn’t check account availability.</h2>
    <p>{error}</p>
    <button className="saas-primary" type="button" onClick={retry}>Try again<ArrowRight size={16} /></button>
  </div>;
}
