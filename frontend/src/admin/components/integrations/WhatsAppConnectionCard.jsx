import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../utils/apiConfig';
import { wabbManualTextReady, whatsappConnectionLabel } from '../../../utils/whatsappData';

export default function WhatsAppConnectionCard() {
  const { user } = useAuth();
  const preview = user?.isPreview === true;
  const [status, setStatus] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    axios.get(API + '/api/integrations/whatsapp/status', { signal: controller.signal, timeout: 90000, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(({ data }) => {
      if (typeof data?.connected !== 'boolean' || typeof data.configured !== 'boolean') throw new Error();
      setStatus(data); setError('');
    }).catch(() => { if (!controller.signal.aborted) setError('WhatsApp connection status is unavailable.'); });
    return () => controller.abort();
  }, [preview]);
  const wabb = status?.provider === 'wabb';
  const ready = !preview && !error && (wabb ? wabbManualTextReady(status) : status?.connected === true);
  const description = preview ? 'Your studio’s WhatsApp communication, with sending enabled after a supported connection is verified.' : wabb ? 'Send individual client messages through your existing Wabb account.' : 'Client conversations, replies and approved messages in your studio workspace.';
  const summary = preview ? 'The sample preview cannot access your WhatsApp account.' : error || (wabb ? [status?.displayPhoneNumber, 'Inbox synchronization is not enabled; your Business app and Wabb connection stay in place.'].filter(Boolean).join(' · ') : status?.connected ? [status.verifiedName, status.displayPhoneNumber].filter(Boolean).join(' · ') : 'Keep your existing number and Business app through a supported coexistence connection.');
  return <section className="studio-card studio-gmail-card studio-whatsapp-connection">
    <span className="studio-webhook-icon"><MessageCircle size={24} strokeWidth={1.5} /></span>
    <div><h2>WhatsApp Business</h2><p>{description}</p><small>{summary}</small></div>
    <div className="studio-gmail-card-actions"><span className={'studio-badge ' + (ready ? 'green' : 'gold')}>{preview ? 'Preview only' : error ? 'Unavailable' : whatsappConnectionLabel(status)}</span><Link className="studio-button primary" to="/admin/whatsapp">Open WhatsApp <ArrowUpRight size={15} /></Link></div>
  </section>;
}
