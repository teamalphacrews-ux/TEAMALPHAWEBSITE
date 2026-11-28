import { ArrowUpRight } from 'lucide-react';

const whatsAppWebUrl = 'https://web.whatsapp.com/';

export function WhatsAppWebLink({ primary = false, sameTab = false }) {
  return <a className={'studio-button' + (primary ? ' primary' : '')} href={whatsAppWebUrl} target={sameTab ? undefined : '_blank'} rel="noopener noreferrer">
    Open WhatsApp Web <ArrowUpRight size={15} aria-hidden="true" />
  </a>;
}

export default function WhatsAppWebHandoff({ webOnly = false }) {
  return <section className="studio-card wa-web-entry" aria-label="WhatsApp Web">
    <div>
      <h2>WhatsApp Web</h2>
      {webOnly ? <>
        <p>Open <strong>web.whatsapp.com</strong> in Safari or Chrome on your computer.</p>
        <p>On your phone, open WhatsApp or WhatsApp Business. Go to <strong>Linked devices → Link a device</strong> and scan the QR code on your computer.</p>
      </> : <>
        <p>Open your Business app chats in a separate browser tab.</p>
        <p>To link this browser, open WhatsApp Business on your phone and go to <strong>Linked devices → Link a device</strong>. Scan the QR code shown on WhatsApp Web.</p>
      </>}
    </div>
    <WhatsAppWebLink primary sameTab={webOnly} />
  </section>;
}
