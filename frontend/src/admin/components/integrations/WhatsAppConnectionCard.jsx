import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../utils/apiConfig';
import { whatsappConnectionLabel } from '../../../utils/whatsappData';

export default function WhatsAppConnectionCard() {
  const { user } = useAuth();
  const preview = user?.isPreview === true;
  const [status, setStatus] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    axios.get(API + '/api/integrations/whatsapp/status', { signal: controller.signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(({ data }) => {
      if (typeof data?.connected !== 'boolean' || typeof data.configured !== 'boolean') throw new Error();
      setStatus(data); setError('');
    }).catch(() => { if (!controller.signal.aborted) setError('WhatsApp connection status is unavailable.'); });
    return () => controller.abort();
  }, [preview]);
  return <section className="studio-card studio-gmail-card studio-whatsapp-connection">
    <span className="studio-webhook-icon"><MessageCircle size={24} strokeWidth={1.5} /></span>
    <div><h2>WhatsApp Business</h2><p>Client conversations, replies and approved messages in your studio workspace.</p><small>{preview ? 'The sample preview cannot access your WhatsApp account.' : error || (status?.connected ? [status.verifiedName, status.displayPhoneNumber].filter(Boolean).join(' · ') : 'Keep your existing number and Business app through a supported coexistence connection.')}</small></div>
    <div className="studio-gmail-card-actions"><span className={'studio-badge ' + (status?.connected && !preview ? 'green' : 'gold')}>{preview ? 'Preview only' : error ? 'Unavailable' : whatsappConnectionLabel(status)}</span><Link className="studio-button primary" to="/admin/whatsapp">Open WhatsApp <ArrowUpRight size={15} /></Link></div>
  </section>;
}
