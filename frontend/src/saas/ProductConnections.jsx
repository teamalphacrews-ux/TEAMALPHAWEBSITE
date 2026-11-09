import { createElement } from 'react';
import { CalendarDays, CreditCard, FolderOpen, Layers3, Mail, MessageCircle } from 'lucide-react';
import calendarLogo from '../assets/integrations/google-calendar.svg';
import gmailLogo from '../assets/integrations/gmail.svg';
import whatsappLogo from '../assets/integrations/whatsapp-business.jpg';
import { PRODUCT_BRAND } from './productBrandAssets';

const connections = [
  [CalendarDays, calendarLogo, 'Calendar'], [Mail, gmailLogo, 'Email'], [MessageCircle, whatsappLogo, 'Sharing'],
  [CreditCard, null, 'Payments'], [Layers3, null, 'Subscriptions'], [FolderOpen, null, 'Delivery'],
];

export default function ProductConnections() {
  return <div className="sos-connections" data-motion-unit="connections" aria-hidden="true">
    <svg className="sos-connections-lines" viewBox="0 0 1000 330" preserveAspectRatio="none"><g fill="none" stroke="currentColor" strokeWidth="1"><path pathLength="1" d="M500 165C500 70 160 180 160 70"/><path pathLength="1" d="M500 165V60"/><path pathLength="1" d="M500 165C500 70 840 180 840 70"/><path pathLength="1" d="M500 165C500 260 160 150 160 260"/><path pathLength="1" d="M500 165V280"/><path pathLength="1" d="M500 165C500 260 840 150 840 260"/></g></svg>
    <div className="sos-connections-core"><img src={PRODUCT_BRAND.symbolWhite} alt="" width="512" height="512" loading="lazy" decoding="async"/></div>
    {connections.map(([Icon, image, label], index) => <div className={'sos-connection-node node-'+index} key={label}><span>{image ? <img src={image} alt="" width="28" height="28" loading="lazy"/> : createElement(Icon, { size: 24, strokeWidth: 1.5 })}</span><small>{label}</small></div>)}
    <p>Available workflows and planned connections</p>
  </div>;
}
