import chatgpt from '../../../assets/integrations/chatgpt.svg';
import claude from '../../../assets/integrations/claude.svg';
import openclaw from '../../../assets/integrations/openclaw.svg';
import drive from '../../../assets/integrations/google-drive.svg';
import gmail from '../../../assets/integrations/gmail.svg';
import whatsappBusiness from '../../../assets/integrations/whatsapp-business.jpg';
import calendar from '../../../assets/integrations/google-calendar.svg';
import './integrationLogo.css';

const brands = {
  openai: { src: chatgpt, name: 'ChatGPT' },
  claude: { src: claude, name: 'Claude' },
  openclaw: { src: openclaw, name: 'OpenClaw' },
  drive: { src: drive, name: 'Google Drive' },
  gmail: { src: gmail, name: 'Gmail' },
  'whatsapp-business': { src: whatsappBusiness, name: 'WhatsApp Business' },
  'google-calendar': { src: calendar, name: 'Google Calendar' },
};

/** Provider identity only. Keep operational actions in the Studio OS icon family. */
export default function IntegrationLogo({ brand, size = 38, decorative = true, label, className = '' }) {
  const logo = brands[brand];
  if (!logo) return null;
  return <span
    className={`integration-logo integration-logo--${brand} ${className}`.trim()}
    style={{ '--integration-logo-size': `${size}px` }}
    aria-hidden={decorative || undefined}
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : label || logo.name}
  ><img src={logo.src} alt="" width={size} height={size} decoding="async" draggable={false} /></span>;
}
