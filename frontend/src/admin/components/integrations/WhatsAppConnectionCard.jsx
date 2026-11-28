import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import axios from 'axios';
import IntegrationLogo from './IntegrationLogo';
import { WhatsAppWebLink } from './WhatsAppWebHandoff';
import { useAuth } from '../../../context/AuthContext';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import API from '../../../utils/apiConfig';
import { wabbManualTextReady, whatsappConnectionLabel } from '../../../utils/whatsappData';

export default function WhatsAppConnectionCard() {
  const { user } = useAuth();
  const preview = user?.isPreview === true;
  const webOnly = IS_COMMERCIAL_DEPLOYMENT || Boolean(user?.workspace);
  const [status, setStatus] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (preview || webOnly) return;
    const controller = new AbortController();
    axios.get(API + '/api/integrations/whatsapp/status', { signal: controller.signal, timeout: 90000, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(({ data }) => {
      if (typeof data?.connected !== 'boolean' || typeof data.configured !== 'boolean') throw new Error();
      setStatus(data); setError('');
    }).catch(() => { if (!controller.signal.aborted) setError('WhatsApp connection status is unavailable.'); });
    return () => controller.abort();
  }, [preview, webOnly]);
  if (webOnly) return <section className="studio-card studio-gmail-card studio-whatsapp-connection" aria-label="WhatsApp Web">
    <IntegrationLogo brand="whatsapp-business" size={47} />
    <div><h2>WhatsApp Web</h2><p>Open your chats in a desktop browser.</p><small>Use Linked devices in WhatsApp on your phone to link your computer.</small></div>
    <div className="studio-gmail-card-actions">
      <Link className="studio-button" to="/admin/whatsapp">Linking instructions</Link>
      <WhatsAppWebLink primary sameTab />
    </div>
  </section>;
  const wabb = status?.provider === 'wabb';
  const ready = !preview && !error && (wabb ? wabbManualTextReady(status) : status?.connected === true);
  const description = 'Open WhatsApp Web with your existing Business app account.';
  const summary = preview ? 'This sample workspace only has messaging examples.' : error || (wabb ? [status?.displayPhoneNumber, 'Wabb supports individual replies. Read and manage your conversations in Wabb.'].filter(Boolean).join(' · ') : status?.connected ? [status.verifiedName, status.displayPhoneNumber, 'Meta inbox'].filter(Boolean).join(' · ') : 'To receive messages in Studio X OS, set up the Meta Business API inbox.');
  return <section className="studio-card studio-gmail-card studio-whatsapp-connection">
    <IntegrationLogo brand="whatsapp-business" size={47} />
    <div><h2>WhatsApp Business</h2><p>{description}</p><small>{summary}</small></div>
    <div className="studio-gmail-card-actions">
      <span className={'studio-badge ' + (ready ? 'green' : 'gold')}>{preview ? 'Preview only' : error ? 'Integration unavailable' : whatsappConnectionLabel(status)}</span>
      <Link className="studio-button" to="/admin/whatsapp">WhatsApp workspace <ArrowUpRight size={15} aria-hidden="true" /></Link>
      <WhatsAppWebLink primary />
    </div>
  </section>;
}
