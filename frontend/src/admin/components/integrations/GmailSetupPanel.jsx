import { Link } from 'react-router-dom';
import { Check, Circle, Mail, ArrowUpRight } from 'lucide-react';

export default function GmailSetupPanel({ status }) {
  const checks = Array.isArray(status?.setupChecks) ? status.setupChecks : [];
  return <section className="studio-card studio-email-setup" aria-labelledby="gmail-setup-title">
    <div className="studio-email-setup-heading"><Mail size={20} /><div><h2 id="gmail-setup-title">Finish connecting Gmail</h2><p>Your inbox and outgoing studio emails have separate connections.</p></div></div>
    <ol>{checks.map(check => <li key={check.id}>{check.ready ? <Check size={16} aria-label="Ready" /> : <Circle size={16} aria-label="Setup needed" />}<div><strong>{check.label}</strong><p>{check.help}</p></div></li>)}</ol>
    <p>After server setup, connect this administrator’s Google account and approve Gmail read access. Existing Calendar access does not connect your mailbox.</p>
    <div className="studio-email-setup-actions"><a className="studio-button" href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud<ArrowUpRight size={14} /></a><Link className="studio-button" to="/admin/settings?section=communication">Outgoing email settings<ArrowUpRight size={14} /></Link></div>
    <small>Keep passwords and client secrets in your hosting provider’s private settings.</small>
  </section>;
}
