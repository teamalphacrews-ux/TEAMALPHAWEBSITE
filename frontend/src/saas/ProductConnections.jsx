import { createElement } from 'react';
import { CalendarDays, CreditCard, Link2, Mail, MessageCircle } from 'lucide-react';
import calendarLogo from '../assets/integrations/google-calendar.svg';
import gmailLogo from '../assets/integrations/gmail.svg';
import whatsappLogo from '../assets/integrations/whatsapp-business.jpg';
import chatgptLogo from '../assets/integrations/chatgpt.svg';
import claudeLogo from '../assets/integrations/claude.svg';
import { PRODUCT_BRAND } from './productBrandAssets';
import './productConnections.css';

const connections = [
  { id: 'email', icon: Mail, image: gmailLogo, label: 'Email', status: 'Setup planned', x: 12.5, y: 0 },
  { id: 'whatsapp', icon: MessageCircle, image: whatsappLogo, label: 'WhatsApp', status: 'Manual sharing', x: 37.5, y: 0 },
  { id: 'chatgpt', image: chatgptLogo, label: 'ChatGPT', status: 'Coming soon', x: 62.5, y: 0 },
  { id: 'claude', image: claudeLogo, label: 'Claude', status: 'Coming soon', x: 87.5, y: 0 },
  { id: 'calendar', icon: CalendarDays, image: calendarLogo, label: 'Calendar', status: 'Setup planned', x: 18, y: 74 },
  { id: 'smart-link', icon: Link2, label: 'Client Smart Link', status: 'Project sharing', x: 50, y: 74 },
  { id: 'payments', icon: CreditCard, label: 'Payment Gateway', status: 'Setup pending', x: 82, y: 74 },
];

export default function ProductConnections() {
  return <figure className="sos-connections sos-connections-expanded" data-motion-unit="connections" aria-labelledby="sos-connections-caption">
    <div className="sos-connections-map">
      <svg className="sos-connections-lines" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1.25">
          <path pathLength="1" d="M500 250C500 152 125 240 125 91" />
          <path pathLength="1" d="M500 250C500 165 375 200 375 91" />
          <path pathLength="1" d="M500 250C500 165 625 200 625 91" />
          <path pathLength="1" d="M500 250C500 152 875 240 875 91" />
          <path pathLength="1" d="M500 250C500 330 180 290 180 402" />
          <path pathLength="1" d="M500 250V402" />
          <path pathLength="1" d="M500 250C500 330 820 290 820 402" />
        </g>
      </svg>
      <div className="sos-connections-core"><img src={PRODUCT_BRAND.symbolWhite} alt="Studio X OS" width="512" height="512" loading="lazy" decoding="async" /></div>
      <ul className="sos-connections-list" aria-label="Studio X OS tools and connections">
        {connections.map(({ id, icon, image, label, status, x, y }) => <li className={'sos-connection-node connection-' + id} key={id} style={{ '--connection-x': `${x}%`, '--connection-y': `${y}%` }}>
          <span className="sos-connection-art">{image ? <img src={image} alt="" width="32" height="32" loading="lazy" decoding="async" /> : createElement(icon, { size: 27, strokeWidth: 1.5, 'aria-hidden': true })}</span>
          <span className="sos-connection-copy"><strong>{label}</strong><small>{status}</small></span>
        </li>)}
      </ul>
    </div>
    <figcaption id="sos-connections-caption">Available workflows and planned connections</figcaption>
  </figure>;
}
