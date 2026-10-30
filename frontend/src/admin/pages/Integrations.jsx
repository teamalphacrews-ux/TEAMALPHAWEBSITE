import { useState, useEffect } from 'react';
import { Webhook, Copy, Check, ArrowRight, ShieldCheck, RefreshCw, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../../utils/apiConfig';
import GmailConnectionCard from '../components/integrations/GmailConnectionCard';
import WhatsAppConnectionCard from '../components/integrations/WhatsAppConnectionCard';
import { WorkspaceHeader } from '../components/operations/WorkspaceUI';
import { useAuth } from '../../context/AuthContext';
import './integrations.css';

const sample = { name: 'Ananya & Arjun', email: 'couple@example.com', phone: '+919876543210', eventType: 'Wedding', eventDate: '2027-02-14', eventLocation: 'Bengaluru', notes: 'Interested in photography and cinematography.' };
const sampleJson = JSON.stringify(sample, null, 2);

export default function Integrations() {
  const { user } = useAuth();
  const preview = user?.isPreview === true;
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [copied, setCopied] = useState('');
  const endpoint = API_BASE_URL + '/api/webhooks/enquiries';
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    axios.get(API_BASE_URL + '/api/webhooks/enquiries/status', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, signal: controller.signal })
      .then(result => { if (typeof result.data?.configured !== 'boolean') throw new Error(); setStatus(result.data); setError(''); })
      .catch(err => { if (!axios.isCancel(err)) setError('We couldn’t check webhook configuration. Please try again.'); });
    return () => controller.abort();
  }, [refresh, preview]);
  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); toast.success(label + ' copied'); }
    catch { toast.error('Copy is unavailable. Select and copy the text below.'); }
  };
  return <div className="studio-integrations">
    <WorkspaceHeader title="Integrations" description="Connect your calendar, email, WhatsApp and website enquiries." />
    <GmailConnectionCard />
    <WhatsAppConnectionCard />
    <section className="studio-card studio-gmail-card"><span className="studio-webhook-icon"><CalendarDays size={24} strokeWidth={1.3} /></span><div><h2>Google Calendar</h2><p>Connect your studio calendar and manage event synchronization.</p><small>Your Calendar connection is managed from the Calendar workspace.</small></div><Link className="studio-button" to="/admin/calendar">Open calendar <ArrowRight size={15} /></Link></section>
    {error && <div className="studio-error" role="alert">{error}<button className="studio-button small" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={13} />Retry</button></div>}
    <section className="studio-card studio-webhook-intro"><span className="studio-webhook-icon"><Webhook size={25} strokeWidth={1.3} /></span><div><h2>Website enquiries</h2><p>Connect a form or automation to create new leads in Team Alpha CRM.</p></div><span className={'studio-badge ' + (status?.configured ? 'green' : 'gold')}>{preview ? 'Preview only' : status ? status.configured ? 'Configured' : 'Setup needed' : error ? 'Status unavailable' : 'Checking configuration…'}</span></section>
    <div className="studio-integration-grid">
      <section className="studio-card"><div className="studio-card-heading"><div><h2>Connect your enquiry source</h2><p className="studio-card-subtitle">Send requests from your trusted server or automation.</p></div></div>
        <ol className="studio-connection-steps"><li><span>01</span><div><h3>Configure your server secret</h3><p>Set <code>ENQUIRY_WEBHOOK_SECRET</code> on the backend hosting service to a unique random value of at least 32 characters. Restart the backend after saving it.</p></div></li><li><span>02</span><div><h3>Choose the destination</h3><p>Use the endpoint below with the <code>POST</code> method. Your backend must be deployed before external services can reach it.</p><div className="studio-copy-line"><code>{endpoint}</code><button className="studio-icon-button" onClick={() => copy(endpoint, 'Endpoint')} aria-label="Copy webhook endpoint">{copied === 'Endpoint' ? <Check size={15} /> : <Copy size={15} />}</button></div></div></li><li><span>03</span><div><h3>Add authentication and a unique event key</h3><p>Set these headers in the source service. Reuse the same idempotency key when retrying the same enquiry.</p><pre>{'Content-Type: application/json\nAuthorization: Bearer YOUR_SERVER_SECRET\nIdempotency-Key: enquiry-unique-event-id'}</pre></div></li><li><span>04</span><div><h3>Send the enquiry</h3><p>A successful request creates a lead in the <strong>New</strong> stage. A duplicate event returns the existing lead.</p></div></li></ol>
      </section>
      <div className="studio-integration-side"><section className="studio-card"><div className="studio-card-heading"><h2>Sample enquiry</h2><button className="studio-button small" onClick={() => copy(sampleJson, 'Payload')}><Copy size={12} />Copy JSON</button></div><p className="studio-card-subtitle">Illustrative values. Replace with your enquiry fields.</p><pre className="studio-webhook-json">{sampleJson}</pre><p className="studio-webhook-required"><strong>Required:</strong> name and email.<br />Event dates use YYYY-MM-DD. Optional fields can be omitted.</p></section>
      <section className="studio-card studio-webhook-security"><ShieldCheck size={21} /><h2>Keep the secret server-side</h2><p>Configure it in your backend and the sending service. Add it to server requests only; browser forms should submit through your server.</p><p>Payment, account and permission fields are rejected by this enquiry endpoint.</p></section></div>
    </div>
    <section className="studio-card studio-integration-outro"><div><h2>Every enquiry, in one place.</h2><p>Once connected, new enquiries appear directly in your pipeline.</p></div><Link className="studio-button primary" to="/admin/crm">Open enquiries <ArrowRight size={14} /></Link></section>
  </div>;
}
