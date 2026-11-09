import { ArrowUpRight, CalendarDays, CreditCard, FolderOpen, Layers3, Link2, Mail, MessageCircle, Smartphone, Sparkles } from 'lucide-react';
import { integrationArtwork } from './productBrandAssets';
import ProductConnections from './ProductConnections';
import './productIntegrations.css';

const experienceFeatures = [
  {
    title: 'Advanced UI & UX.',
    copy: 'A refined interface, clear layouts and daylight or dark views that feel at home in your studio.',
  },
  {
    title: 'A first-class user experience.',
    copy: 'Keep the context with every client and project, from the first enquiry to the final delivery.',
  },
  {
    title: 'Easy to operate.',
    copy: 'Clear next steps and connected records help you move through everyday work with confidence.',
  },
];

const integrations = [
  { icon: CalendarDays, name: 'Google Calendar', mode: 'Per-studio setup planned', copy: 'Keep studio events alongside your Google calendar. Independent connections for each SaaS studio are still being prepared.' },
  { icon: Mail, name: 'Gmail', mode: 'Per-studio setup planned', copy: 'Bring email into the studio workflow. The read-only inbox integration needs configuration before it is available to SaaS studios.' },
  { icon: MessageCircle, name: 'WhatsApp Business', mode: 'Manual sharing', copy: 'Share quotes and client smart links through WhatsApp. Messages open in your app; an automatic WhatsApp inbox is not included.' },
  { icon: CreditCard, name: 'UPI & bank details', mode: 'Client payment instructions', copy: 'Show your configured payment details from the client link. Your studio confirms receipts; transfers are not automatically verified.' },
  { icon: Layers3, name: 'Razorpay', mode: 'Subscription setup pending', copy: 'Planned for monthly Studio X OS subscriptions in INR. This is separate from the payments your clients make to your studio.' },
  { icon: FolderOpen, name: 'Delivery links', mode: 'Project-based sharing', copy: 'Keep approved photo, film and album delivery links with the project, ready for clients when the work is ready to share.' },
];

export default function ProductIntegrations() {
  return (
    <section className="sos-integrations-section" id="integrations" aria-labelledby="sos-integrations-title">
      <div className="sos-container">
        <div className="sos-section-heading sos-integrations-heading">
          <h2 id="sos-integrations-title">Powerful AI<br />integrations & tools.</h2>
          <div className="sos-integrations-intro">
            <p>A considered experience. Connected studio tools. More space for the work you love.</p>
            <p className="sos-ai-availability"><Sparkles size={18} aria-hidden="true" /><span>AI connections for commercial studios.<strong>Coming soon.</strong></span></p>
          </div>
        </div>

        <div className="sos-studio-features" aria-label="Key Studio X OS features">
          <div className="sos-studio-feature-lead">
            <h3>Manage it all<br />in Studio X OS.</h3>
            <p>Your clients, projects, crew, quotes, invoices and production. One connected workspace for the business behind your photography.</p>
            <a className="sos-feature-link" href="#product-demo">Explore the workspace<ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
          <div className="sos-experience-features">
            {experienceFeatures.map(feature => (
              <article key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
          <article className="sos-feature-client">
            <Link2 size={25} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h3>An advanced client smart link.</h3>
              <p>Accepted quotes, issued invoices, payment schedules, project updates and approved delivery links. A thoughtful client experience, without another account.</p>
              <a className="sos-feature-link" href="#smart-link">Explore the client experience<ArrowUpRight size={18} aria-hidden="true" /></a>
            </div>
          </article>
          <article className="sos-feature-apps">
            <Smartphone size={25} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <div className="sos-apps-heading"><h3>Android & iOS apps.</h3><span>Coming soon</span></div>
              <p>Your studio, wherever the day takes you. Use Studio X OS in your mobile browser today; dedicated Android and iOS apps are coming soon.</p>
              <a className="sos-feature-link" href="#on-the-go">Explore on the go<ArrowUpRight size={18} aria-hidden="true" /></a>
            </div>
          </article>
        </div>

        <ProductConnections />
        <div className="sos-integrations-grid">
          {integrations.map(item => (
            <article key={item.name}>
              <span className="sos-integration-icon">
                {integrationArtwork[item.name]
                  ? <img src={integrationArtwork[item.name]} alt="" width="28" height="28" loading="lazy" />
                  : <item.icon size={22} strokeWidth={1.6} aria-hidden="true" />}
              </span>
              <div><h3>{item.name}</h3><span className="sos-integration-status">{item.mode}</span><p>{item.copy}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
