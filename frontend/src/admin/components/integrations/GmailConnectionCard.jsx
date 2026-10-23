import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { gmailRequest, gmailError } from './gmailApi';

export default function GmailConnectionCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const isPreview = user?.isPreview === true;
  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    gmailRequest('get', '/status', { signal: controller.signal }).then(setStatus).catch(err => {
      if (!controller.signal.aborted) setError(gmailError(err));
    });
    return () => controller.abort();
  }, [isPreview]);
  return <section className="studio-card studio-gmail-card">
    <span className="studio-webhook-icon"><Mail size={24} strokeWidth={1.3} /></span>
    <div><h2>Email</h2><p>View your connected Gmail inbox, sent mail and email search inside Studio OS.</p>
      <small>{isPreview ? 'Connect from the live Studio OS; the sample preview cannot access Gmail.' : error || (status?.connected ? status.email : status?.setupMessage || 'Your Gmail connection is private to your administrator account.')}</small></div>
    <div className="studio-gmail-card-actions"><span className="studio-badge gold">{isPreview ? 'Preview only' : status?.connected ? 'Connected' : status ? status.configured ? 'Not connected' : 'Setup needed' : error ? 'Unavailable' : 'Checking…'}</span>
      <Link className="studio-button primary" to="/admin/email">Open email <ArrowUpRight size={15} /></Link></div>
  </section>;
}
