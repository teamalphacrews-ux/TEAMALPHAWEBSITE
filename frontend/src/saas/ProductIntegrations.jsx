import { ArrowUpRight } from 'lucide-react';
import ProductConnections from './ProductConnections';
import './productIntegrations.css';

const connectionDetails = [
  {
    name: 'Google Calendar & Gmail',
    status: 'Per-studio setup planned',
    copy: 'Independent calendar connections and a read-only Gmail inbox are being prepared for studio workspaces.',
  },
  {
    name: 'WhatsApp',
    status: 'Manual sharing',
    copy: 'Open quotes and client Smart Links in your WhatsApp app to send. An automatic inbox is not included.',
  },
  {
    name: 'UPI & bank details',
    status: 'Studio confirms receipts',
    copy: 'Clients see your configured payment instructions. Your studio verifies receipts; transfers are not verified automatically.',
  },
  {
    name: 'Razorpay',
    status: 'Subscription setup planned',
    copy: 'Planned for monthly Studio X OS subscriptions in INR, separate from payments your clients make to your studio.',
  },
  {
    name: 'Delivery links',
    status: 'Project-based sharing',
    copy: 'Keep approved photo, film and album delivery links with the project, ready to share with clients.',
  },
];

export default function ProductIntegrations() {
  return (
    <section className="sos-integrations-section" id="integrations" aria-labelledby="sos-integrations-title">
      <div className="sos-container">
        <div className="sos-section-heading sos-integrations-heading">
          <h2 id="sos-integrations-title">Powerful AI<br />integrations & tools.</h2>
          <div className="sos-integrations-intro">
            <p>Share project context with clients, keep delivery links close, and see where manual work or planned setup still applies.</p>
            <p className="sos-ai-availability">ChatGPT & Claude integrations. <strong>Coming soon.</strong></p>
          </div>
        </div>

        <div className="sos-mobile-availability">
          <p><strong>Android & iOS apps are coming soon.</strong> Explore the mobile browser preview.</p>
          <a className="sos-feature-link" href="#on-the-go">See the mobile browser demo<ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>

        <ProductConnections />
        <dl className="sos-connection-details" aria-label="Connection availability and limits">
          {connectionDetails.map(item => (
            <div key={item.name}>
              <dt>{item.name}<span>{item.status}</span></dt>
              <dd>{item.copy}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
