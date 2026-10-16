import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
import "./sharedQuotation.css";
const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    value / 100,
  );
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";
export default function SharedQuotation() {
  const { token } = useParams();
  const [quoteData, setQuote] = useState(null),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const quote = quoteData?.requestToken === token ? quoteData : null;
  useEffect(() => {
    let active = true;
    axios
      .get(`${API_BASE_URL}/api/quotes/${token}`)
      .then((r) => {
        if (active) {
          setQuote({ ...r.data, requestToken: token });
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.error ||
              "Unable to load this quotation. Please retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [token]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const expired =
    quote && quote.status !== "Accepted" && now >= Date.parse(quote.expiresAt);
  const accept = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await axios.post(`${API_BASE_URL}/api/quotes/${token}/accept`, {
        acceptedBy: quote.status === "Accepted" ? quote.acceptedBy : name,
        consent: quote.status === "Accepted" ? true : consent,
        revision: quote.revision,
      });
      setQuote({ ...r.data, requestToken: token });
    } catch (e) {
      setError(
        e.response?.data?.error ||
          "Unable to complete acceptance. Please retry; duplicate invoices will not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remaining = quote ? Math.max(0, Date.parse(quote.expiresAt) - now) : 0;
  return (
    <div className="shared-quotation">
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="no-referrer" />
      <header>
        <a href="/">{quote?.studio.name || "TEAM ALPHA"}</a>
        <span>PHOTOGRAPHY & CINEMATOGRAPHY</span>
      </header>
      {!quote ? (
        <main>
          <h1>Your quotation</h1>
          <p role="status">{error || "Loading your proposal…"}</p>
        </main>
      ) : (
        <>
          <section className="shared-hero">
            <p>A PROPOSAL FOR {quote.clientName}</p>
            <h1>
              {quote.status === "Accepted"
                ? "Thank you. Your quotation is accepted."
                : expired
                  ? "This quotation has expired."
                  : `Your story starts here.`}
            </h1>
            <p>
              {quote.status === "Accepted"
                ? `Accepted by ${quote.acceptedBy} on ${date(quote.acceptedAt)}. ${quote.invoiceReady ? "Your invoice has been generated." : "Your invoice is being prepared."}`
                : `Please review and accept by ${date(quote.validUntil)}, 11:59 PM IST.`}
            </p>
            {!expired && quote.status !== "Accepted" && (
              <strong className="shared-countdown">
                {Math.floor(remaining / 86400000)} days ·{" "}
                {Math.floor(remaining / 3600000) % 24} hours ·{" "}
                {Math.floor(remaining / 60000) % 60} minutes remaining
              </strong>
            )}
          </section>
          <main>
            <section className="shared-paper">
              <div className="shared-document-top">
                <div>
                  <p>
                    QUOTATION {quote.studio.prefix}-Q-
                    {quote._id.slice(-6).toUpperCase()}
                  </p>
                  <h2>{quote.title}</h2>
                </div>
                <span>
                  {quote.status === "Accepted"
                    ? "Accepted"
                    : expired
                      ? "Expired"
                      : "Open for acceptance"}
                </span>
              </div>
              <div className="shared-meta">
                <div>
                  Prepared for<strong>{quote.clientName}</strong>
                </div>
                <div>
                  Issued
                  <strong>{date(quote.sharedAt || quote.createdAt)}</strong>
                </div>
                <div>
                  Expires<strong>{date(quote.validUntil)}</strong>
                </div>
              </div>
              <div className="shared-table">
                <table>
                  <thead>
                    <tr>
                      <th>Services</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{money(item.unitPricePaise)}</td>
                        <td>{money(item.quantity * item.unitPricePaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl>
                <dt>Subtotal</dt>
                <dd>{money(quote.subtotalPaise)}</dd>
                <dt>Discount</dt>
                <dd>− {money(quote.discountPaise)}</dd>
                <dt>Tax ({quote.taxRateBps / 100}%)</dt>
                <dd>{money(quote.taxPaise)}</dd>
                <dt>Total</dt>
                <dd>
                  <strong>{money(quote.totalPaise)}</strong>
                </dd>
              </dl>
              <h3>Terms & deliverables</h3>
              <p className="shared-terms">
                {quote.terms ||
                  "Please contact the studio with any questions before accepting."}
              </p>
              <button
                type="button"
                className="shared-secondary"
                onClick={() => window.print()}
              >
                Print / save PDF
              </button>
            </section>
            <section className="shared-paper shared-accept">
              <h2>
                {quote.status === "Accepted"
                  ? "Acceptance recorded"
                  : expired
                    ? "Need more time?"
                    : "Ready to move forward?"}
              </h2>
              {error && <p role="alert">{error}</p>}
              {quote.status === "Accepted" ? (
                <div>
                  <p>
                    Your studio has received your acceptance.{" "}
                    {quote.invoiceReady
                      ? "A linked invoice is available in their finance workspace."
                      : "Invoice generation needs to finish. Use the button below to retry safely."}{" "}
                    Acceptance does not record a payment.
                  </p>
                  {!quote.invoiceReady && (
                    <form onSubmit={accept}>
                      <button disabled={busy}>
                        {busy
                          ? "Preparing invoice…"
                          : "Finish invoice generation"}
                      </button>
                    </form>
                  )}
                </div>
              ) : expired ? (
                <p>
                  Contact the studio to request an updated quotation. Acceptance
                  is closed.
                </p>
              ) : (
                <form onSubmit={accept}>
                  <p>
                    Review the services, total and terms above. Accepting
                    confirms your agreement to this quotation.
                  </p>
                  <label>
                    Your full name
                    <input
                      aria-label="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={120}
                    />
                  </label>
                  <label className="shared-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      required
                    />
                    I have reviewed and agree to the services, price and terms
                    in this quotation.
                  </label>
                  <button disabled={busy || !consent || !name.trim()}>
                    {busy ? "Recording acceptance…" : "Accept quotation"}
                  </button>
                </form>
              )}
              <p>
                {quote.studio.email && (
                  <a href={`mailto:${quote.studio.email}`}>
                    {quote.studio.email}
                  </a>
                )}{" "}
                {quote.studio.phone}
              </p>
            </section>
          </main>
        </>
      )}
      <footer>TEAM ALPHA · Made for the stories you create.</footer>
    </div>
  );
}
