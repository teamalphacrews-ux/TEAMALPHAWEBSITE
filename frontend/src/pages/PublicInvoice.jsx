import { useEffect, useState } from "react";
import { TEAM_ALPHA_LOGO } from "../utils/branding";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Printer, Download, X } from "lucide-react";
import { API_BASE_URL } from "../utils/apiConfig";
import "../admin/pages/invoiceWorkspace.css";
const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0),
  );
import {
  invoiceDate as date,
  invoiceRows as rows,
  downloadInvoice,
} from "../utils/invoiceDocument";
export function InvoiceDocument({ invoice, preview = false }) {
  const [payment, setPayment] = useState(false),
    [pdfError, setPdfError] = useState("");
  const i = invoice,
    items = rows(i),
    paid = i.status === "Paid" ? Number(i.total) : Number(i.advancePaid || 0),
    outstanding = Math.max(0, i.total - paid);
  const schedule =
    (i.paymentScheduleEnabled
      ? i.paymentSchedule
      : [{ amountPaise: Math.round(i.total * 100), dueDate: i.dueDate }]) || [];
  const payments = schedule.map((p, index) => {
    const credit = Math.max(
      0,
      Math.round(paid * 100) -
        schedule
          .slice(0, index)
          .reduce((sum, previous) => sum + previous.amountPaise, 0),
    );
    return { ...p, remaining: Math.max(0, p.amountPaise - credit) };
  });
  const next = payments.find((p) => p.remaining > 0);
  const design = i.design || {};
  const safeCover =
    /^\/assets\/[\w./-]+$/.test(design.coverUrl || "") ||
    /^https:\/\//.test(design.coverUrl || "")
      ? design.coverUrl
      : "/assets/studio-wedding.webp";
  return (
    <div
      className={`invoice-public font-${design.fontFamily || "modern"}`}
      style={{
        "--invoice-accent": /^#[a-f\d]{6}$/i.test(design.accentColor || "")
          ? design.accentColor
          : "#1f2927",
      }}
    >
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="no-referrer" />
      {preview && (
        <div className="invoice-preview-strip">
          Previewing invoice as studio owner.
        </div>
      )}
      <header
        className="invoice-client-hero"
        style={{
          backgroundImage: `linear-gradient(0deg, #0005, #0005), url("${safeCover}")`,
        }}
      >
        {design.showLogo !== false && (
          <img
            src={i.studio?.logoUrl || TEAM_ALPHA_LOGO}
            alt={i.studio?.name || "Team Alpha"}
          />
        )}
        <span>{i.studio?.name || "TEAM ALPHA"}</span>
        <h1>
          Hi {i.clientName.split(" ")[0]},<br />
          {outstanding ? (
            <>
              Your next payment of{" "}
              {money((next?.remaining || outstanding * 100) / 100)} is due
              <br />
              on {date(next?.dueDate || i.dueDate)}.
            </>
          ) : (
            "Thank you. Your invoice is paid."
          )}
        </h1>
      </header>
      <main className="invoice-client-main">
        <section className="invoice-paper">
          <div className="invoice-document-brand">
            {design.showLogo !== false && (
              <img
                src={i.studio?.logoUrl || TEAM_ALPHA_LOGO}
                alt={i.studio?.name || "Team Alpha"}
              />
            )}
            <div>
              <strong>{i.studio?.name || "TEAM ALPHA"}</strong>
              {[
                i.studio?.address,
                i.studio?.email,
                i.studio?.phone,
                i.studio?.website,
                i.studio?.taxId && "GSTIN / Tax ID: " + i.studio.taxId,
              ]
                .filter(Boolean)
                .map((value, index) => (
                  <span key={index}>{value}</span>
                ))}
            </div>
          </div>
          <div className="invoice-paper-heading">
            <h2>
              Invoice{" "}
              {i.documentNumber ||
                `INV-${String(i._id || "")
                  .slice(-8)
                  .toUpperCase()}`}
            </h2>
            <span className="invoice-status">
              {i.status === "Paid"
                ? "PAID"
                : i.documentStatus?.toUpperCase() || "DRAFT"}
            </span>
            <div className="invoice-paper-tools">
              <button aria-label="Print invoice" onClick={() => window.print()}>
                <Printer size={20} />
              </button>
              <button
                aria-label="Download invoice PDF"
                onClick={() =>
                  downloadInvoice(i).catch(() =>
                    setPdfError(
                      "PDF download failed. Use Print to save a PDF.",
                    ),
                  )
                }
              >
                <Download size={20} />
              </button>
            </div>
          </div>
          {i.title && <h2 className="invoice-document-title">{i.title}</h2>}
          <div className="invoice-document-meta">
            <div>
              FROM<strong>{i.studio?.name || "TEAM ALPHA"}</strong>
            </div>
            <div>
              TO<strong>{i.clientName}</strong>
              {i.clientAddress && (
                <span className="invoice-billing-address">
                  {i.clientAddress}
                </span>
              )}
            </div>
            <div>
              ISSUE DATE<strong>{date(i.invoiceDate)}</strong>
            </div>
          </div>
          {pdfError && <p role="alert">{pdfError}</p>}
          {outstanding > 0 && (
            <button
              className="invoice-pay-now"
              onClick={() => setPayment(true)}
            >
              VIEW PAYMENT DETAILS
            </button>
          )}
        </section>
        <section className="invoice-paper">
          <h2>Items</h2>
          <div className="invoice-table-wrap">
            <table className="invoice-document-table">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>QTY</th>
                  <th>PRICE</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{r.title || "Service"}</strong>
                      <p>{r.description}</p>
                    </td>
                    <td>{r.quantity}</td>
                    <td>{money(r.unitPricePaise / 100)}</td>
                    <td>{money((r.quantity * r.unitPricePaise) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="invoice-document-totals">
            <dt>Subtotal</dt>
            <dd>
              {money(
                items.reduce(
                  (s, r) => s + (r.quantity * r.unitPricePaise) / 100,
                  0,
                ),
              )}
            </dd>
            <dt>Discount</dt>
            <dd>−{money(i.discount)}</dd>
            {!!i.taxAmount && (
              <>
                <dt>Tax ({Number(i.taxRateBps || 0) / 100}%)</dt>
                <dd>{money(i.taxAmount)}</dd>
              </>
            )}
            {!!i.extraCharges && (
              <>
                <dt>Extra charges</dt>
                <dd>{money(i.extraCharges)}</dd>
              </>
            )}
            <dt>Total</dt>
            <dd>{money(i.total)}</dd>
            <dt>Paid</dt>
            <dd>{money(paid)}</dd>
            <dt>
              <strong>Amount due</strong>
            </dt>
            <dd>
              <strong>{money(outstanding)}</strong>
            </dd>
          </dl>
          {i.notes && (
            <div className="invoice-document-note">
              <small>NOTES</small>
              <p>{i.notes}</p>
            </div>
          )}
          {i.terms && (
            <div className="invoice-document-note">
              <small>TERMS</small>
              <p>{i.terms}</p>
            </div>
          )}
        </section>
        {i.paymentScheduleEnabled && (
          <section className="invoice-paper">
            <h2>Payment Schedule</h2>
            <div className="invoice-table-wrap">
              <table className="invoice-document-table">
                <thead>
                  <tr>
                    <th>PAYMENT</th>
                    <th>AMOUNT</th>
                    <th>DUE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, index) => (
                    <tr key={index}>
                      <td>
                        {index + 1} of {payments.length}
                      </td>
                      <td>{money(p.amountPaise / 100)}</td>
                      <td>{date(p.dueDate)}</td>
                      <td>
                        <span className="invoice-status">
                          {p.remaining === 0
                            ? "PAID"
                            : p.remaining < p.amountPaise
                              ? "PART PAID"
                              : "UNPAID"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <footer>
          {i.studio?.name || "TEAM ALPHA"}
          {i.studio?.email && (
            <a href={`mailto:${i.studio.email}`}>{i.studio.email}</a>
          )}
        </footer>
      </main>
      {payment && (
        <div
          className="invoice-payment-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayment(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-payment-title"
          >
            <button
              className="invoice-payment-close"
              onClick={() => setPayment(false)}
              aria-label="Close payment instructions"
            >
              <X />
            </button>
            <h2 id="invoice-payment-title">Payment instructions</h2>
            <p>
              Amount due: <strong>{money(outstanding)}</strong>
            </p>
            <p>
              Accepted methods:{" "}
              {(i.acceptedPaymentMethods || []).join(" · ") ||
                "Contact the studio"}
            </p>
            <p className="invoice-document-note">
              {i.studio?.paymentInstructions ||
                "Please contact the studio for payment details."}
            </p>
            {i.studio?.bankDetails &&
              i.acceptedPaymentMethods?.includes("BANKING") && (
                <p className="invoice-document-note">
                  <strong>Bank transfer</strong>
                  <br />
                  {i.studio.bankDetails}
                </p>
              )}
            {i.studio?.upiId &&
              i.acceptedPaymentMethods?.some((m) =>
                ["UPI", "G-pay"].includes(m),
              ) && (
                <p>
                  <strong>UPI ID:</strong> {i.studio.upiId}
                </p>
              )}
            {i.allowTip && (
              <p>
                Tips are optional. Contact the studio if you would like to
                include a tip.
              </p>
            )}
            <p className="invoice-payment-hint">
              Include invoice {i.documentNumber} as your reference. Your payment
              will appear after the studio confirms receipt.
            </p>
            {i.studio?.email && (
              <a
                href={`mailto:${i.studio.email}?subject=${encodeURIComponent(`Payment for invoice ${i.documentNumber}`)}`}
              >
                Contact studio
              </a>
            )}
            <button
              className="invoice-pay-now"
              onClick={() => setPayment(false)}
            >
              DONE
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
export default function PublicInvoice() {
  const { token } = useParams();
  const [state, setState] = useState({});
  useEffect(() => {
    let active = true;
    axios
      .get(`${API_BASE_URL}/api/public-invoices/${token}`)
      .then((r) => {
        if (active) setState({ invoice: r.data, token });
      })
      .catch((e) => {
        if (active)
          setState({
            token,
            error:
              e.response?.data?.error ||
              "Unable to load this invoice. Please retry.",
          });
      });
    return () => {
      active = false;
    };
  }, [token]);
  return state.token === token && state.invoice ? (
    <InvoiceDocument invoice={state.invoice} />
  ) : (
    <div className="invoice-public-loading">
      <h1>Your invoice</h1>
      <p role="status">
        {(state.token === token && state.error) || "Loading your invoice…"}
      </p>
    </div>
  );
}
