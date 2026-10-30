import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Building2, Copy, LockKeyhole, Mail, Smartphone, X } from 'lucide-react';
import { paymentOptions } from '../utils/clientPayment';
import './clientPaymentDialog.css';

const reasonText = {
  invoice_unavailable: 'Payment options become available after the studio issues your invoice.',
  currency_unsupported: 'Online payment options are currently available for INR invoices. Contact your studio to arrange payment in this invoice’s currency.',
  balance_unavailable: 'Your invoice balance could not be confirmed. Refresh the invoice or contact your studio before making a payment.',
  paid_in_full: 'There is no remaining balance on this invoice.',
  invalid_amount: 'This payment amount is unavailable. Close this window and choose a scheduled payment, or contact your studio.',
  amount_exceeds_balance: 'This amount exceeds the remaining invoice balance. Refresh the invoice before making a payment.',
  payment_methods_unavailable: 'Your studio has not added payment details to this invoice yet. Contact the studio to arrange your payment.',
};
const displayMoney = (paise, currency) => {
  if (!Number.isSafeInteger(paise) || paise < 0 || !/^[A-Z]{3}$/.test(currency || '')) return 'Amount unavailable';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100); }
  catch { return 'Amount unavailable'; }
};

export default function ClientPaymentDialog({ invoice, onClose, amountPaise, theme = 'daylight' }) {
  const id = useId(), panelRef = useRef(null), titleRef = useRef(null), closeRef = useRef(onClose), manualRef = useRef(null), mountedRef = useRef(false);
  const [feedback, setFeedback] = useState(''), [manual, setManual] = useState(null);
  const options = paymentOptions(invoice, { amountPaise });
  const available = options.available === true;
  const canPayUPI = available && typeof options.upiUrl === 'string' && /^upi:\/\/pay\?/.test(options.upiUrl);
  const bankDetails = available && typeof options.bankDetails === 'string' ? options.bankDetails.trim() : '';
  const upiId = available && typeof options.upiId === 'string' ? options.upiId : '';
  const email = typeof invoice?.studio?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.studio.email) ? invoice.studio.email : '';
  const paid = options.reason === 'paid_in_full';
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    mountedRef.current = true;
    const panel = panelRef.current, previous = document.activeElement, previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const isTopmost = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(element => element.getClientRects().length).at(-1) === panel;
    const focusables = () => [...panel.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[hidden]'));
    titleRef.current?.focus();
    const keydown = event => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusables(), first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement) || document.activeElement === titleRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const focusin = event => { if (isTopmost() && !panel.contains(event.target)) (focusables()[0] || panel).focus(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => { if (manual) { manualRef.current?.focus(); manualRef.current?.select(); } }, [manual]);
  const copy = async (text, label) => {
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (mountedRef.current) { setManual(null); setFeedback(label + ' copied.'); }
    } catch {
      if (mountedRef.current) { setManual({ text, label }); setFeedback('Select and copy the ' + label.toLowerCase() + ' below.'); }
    }
  };
  return createPortal(<div className="cmp-payment-overlay" data-theme={theme} onMouseDown={event => { if (event.target === event.currentTarget) closeRef.current?.(); }}>
    <section className="cmp-payment-dialog" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={id + '-title'} aria-describedby={id + '-description'} tabIndex={-1}>
      <header className="cmp-payment-header"><div><span className="cmp-payment-eyebrow">YOUR STUDIO PAYMENT</span><h2 id={id + '-title'} ref={titleRef} tabIndex={-1}>{paid ? 'Your invoice is settled' : 'Make a payment'}</h2></div><button type="button" className="cmp-payment-close" aria-label="Close payment options" onClick={() => closeRef.current?.()}><X size={20} /></button></header>
      <div className="cmp-payment-body">
        <p id={id + '-description'} className="cmp-payment-description">{available ? 'Use the studio’s saved UPI or bank details below. Complete your payment in your payment or banking app.' : reasonText[options.reason] || 'Payment details are unavailable. Contact your studio before making a payment.'}</p>
        <section className="cmp-payment-summary" aria-label="Payment details"><div><span>Pay to</span><strong>{options.payee || invoice?.studio?.name || 'Your studio'}</strong></div><div className="cmp-payment-amount"><span>{paid ? 'Balance remaining' : 'For this payment'}</span><strong>{displayMoney(paid ? options.balancePaise : options.amountPaise, invoice?.currency)}</strong></div>{options.reference && <div className="cmp-payment-reference"><span>Invoice reference</span><strong>{options.reference}</strong><button type="button" className="cmp-payment-copy" aria-label="Copy invoice reference" onClick={() => copy(options.reference, 'Invoice reference')}><Copy size={15} /></button></div>}</section>
        {available ? <>
          <div className="cmp-payment-methods">
            {upiId && <section className="cmp-payment-method" aria-labelledby={id + '-upi'}><div className="cmp-payment-method-heading"><span className="cmp-payment-method-icon"><Smartphone size={19} /></span><div><h3 id={id + '-upi'}>UPI</h3><p>Use any supported UPI app.</p></div></div><div className="cmp-payment-copy-row"><code>{upiId}</code><button type="button" className="cmp-payment-copy" aria-label="Copy UPI ID" onClick={() => copy(upiId, 'UPI ID')}><Copy size={16} /></button></div>{canPayUPI && <a className="cmp-payment-action" href={options.upiUrl} aria-describedby={id + '-verify'}>Pay with UPI<ArrowUpRight size={16} /></a>}<p className="cmp-payment-help">Open on a phone with a UPI app installed, or copy the UPI ID into your payment app.</p></section>}
            {bankDetails && <section className="cmp-payment-method" aria-labelledby={id + '-bank'}><div className="cmp-payment-method-heading"><span className="cmp-payment-method-icon"><Building2 size={19} /></span><div><h3 id={id + '-bank'}>Bank transfer</h3><p>Use these details in your banking app.</p></div></div><pre className="cmp-payment-bank-details">{bankDetails}</pre><button type="button" className="cmp-payment-action cmp-payment-secondary" onClick={() => copy(bankDetails, 'Bank details')}><Copy size={15} />Copy bank details</button>{options.reference && <p className="cmp-payment-help">Use {options.reference} as the transfer reference.</p>}</section>}
          </div>
          <div className="cmp-payment-note" id={id + '-verify'}><LockKeyhole size={16} /><p>Confirm the payee name in your payment or banking app before paying. Your receipt and balance update after the studio confirms the payment.</p></div>
        </> : !paid && <div className="cmp-payment-unavailable"><p>Contact your studio using the details on your invoice.</p>{email && <a className="cmp-payment-action cmp-payment-secondary" href={'mailto:' + encodeURIComponent(email)}><Mail size={16} />Contact studio</a>}</div>}
        {manual && <div className="cmp-payment-manual"><label htmlFor={id + '-manual'}>Copy {manual.label.toLowerCase()}<textarea id={id + '-manual'} ref={manualRef} readOnly value={manual.text} rows={manual.label === 'Bank details' ? 5 : 2} onFocus={event => event.currentTarget.select()} /></label><p>Select the text, then use your device’s Copy action.</p></div>}
        <p className="cmp-payment-feedback" role="status" aria-live="polite">{feedback}</p>
      </div>
      <footer className="cmp-payment-footer"><span>Payment confirmation is handled by your studio.</span><button type="button" className="cmp-payment-done" onClick={() => closeRef.current?.()}>Done</button></footer>
    </section>
  </div>, document.body);
}
