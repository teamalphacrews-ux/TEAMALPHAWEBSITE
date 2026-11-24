import { ArrowRight } from 'lucide-react';
import './documentAutomationSummary.css';

export default function DocumentAutomationSummary({ automation, onEdit }) {
  return <section className="sx-automation-summary" aria-labelledby="sx-automation-heading">
    <div>
      <h2 id="sx-automation-heading">What happens automatically?</h2>
      <p>{automation.autoCreateInvoice
        ? 'When a client accepts a new quote, Studio X OS prepares a draft invoice for you to review.'
        : 'When a client accepts a new quote, your team decides when to create the invoice.'}</p>
      <dl>
        <div><dt>Quote reminders</dt><dd>{automation.quoteRemindersEnabled ? 'On by default' : 'Off by default'}</dd></div>
        <div><dt>Payment reminders</dt><dd>{automation.invoiceRemindersEnabled ? 'On by default' : 'Off by default'}</dd></div>
      </dl>
      {(automation.quoteRemindersEnabled || automation.invoiceRemindersEnabled) && <p className="sx-automation-note">Email reminders use your studio’s configured mail service.</p>}
    </div>
    {onEdit && <button type="button" className="studio-button" onClick={onEdit}>Edit defaults <ArrowRight size={16} aria-hidden="true" /></button>}
  </section>;
}
