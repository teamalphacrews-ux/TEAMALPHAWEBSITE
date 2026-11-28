import { ArrowUpRight } from 'lucide-react';

const whatsAppWebUrl = 'https://web.whatsapp.com/';

export function WhatsAppWebLink({ primary = false }) {
  return <a className={'studio-button' + (primary ? ' primary' : '')} href={whatsAppWebUrl} target="_blank" rel="noopener noreferrer">
    Open WhatsApp Web <ArrowUpRight size={15} aria-hidden="true" />
  </a>;
}

export default function WhatsAppWebHandoff() {
  return <section className="studio-card wa-web-entry" aria-label="WhatsApp Web">
    <div>
      <h2>WhatsApp Web</h2>
      <p>Open your Business app chats in a separate browser tab.</p>
      <p>To link this browser, open WhatsApp Business on your phone and go to <strong>Linked devices → Link a device</strong>. Scan the QR code shown on WhatsApp Web.</p>
    </div>
    <WhatsAppWebLink primary />
  </section>;
}
