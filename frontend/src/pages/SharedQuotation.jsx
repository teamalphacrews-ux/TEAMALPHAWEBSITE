import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { CheckCircle2, Download, Printer } from "lucide-react";
import { API_BASE_URL } from "../utils/apiConfig";
import { workspaceRequest } from "../admin/components/operations/workspaceData";
import "./sharedQuotation.css";
import ClientProjectWorkspace from "./ClientProjectWorkspace";
const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format((v || 0) / 100);
const date = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";
export default function SharedQuotation() {
  const { token, id } = useParams(),
    key = token || id;
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const quote = data?.requestKey === key ? data : null,
    preview = !!id;
  useEffect(() => {
    let active = true;
    const request = preview
      ? workspaceRequest("get", `/api/studio/quotations/${id}/preview`)
      : axios.get(`${API_BASE_URL}/api/quotes/${token}`).then((r) => r.data);
    request
      .then((q) => {
        if (active) {
          setData({ ...q, requestKey: key });
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.error ||
              "This quotation is unavailable. Please contact the studio.",
          );
      });
    return () => {
      active = false;
    };
  }, [token, id, key, preview]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired =
    quote &&
    quote.status !== "Accepted" &&
    quote.expiryEnabled !== false &&
    quote.expiresAt &&
    now >= Date.parse(quote.expiresAt);
  const accept = async () => {
    if (preview) {
      toast.error("You cannot accept a quote in preview mode.");
      return;
    }
    if (busy || expired) return;
    setBusy(true);
    setError("");
    try {
      const { data: q } = await axios.post(
        `${API_BASE_URL}/api/quotes/${token}/accept`,
        {
          acceptedBy: quote.acceptedBy || quote.clientName,
          consent: true,
          revision: quote.revision,
        },
      );
      setData({ ...q, requestKey: key });
    } catch (e) {
      setError(
        e.response?.data?.error ||
          "Unable to record acceptance. Please retry safely.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remaining = quote?.expiresAt
    ? Math.max(0, Date.parse(quote.expiresAt) - now)
    : 0;
  const style = quote
    ? {
        "--quote-accent": quote.design?.colorTheme || "#202622",
        fontFamily:
          quote.design?.fontTheme === "classic"
            ? "Georgia, serif"
            : quote.design?.fontTheme === "editorial"
              ? "Palatino, Georgia, serif"
              : "Inter, Arial, sans-serif",
      }
    : {};
  const document = (
    <div className="shared-quotation" style={style}>
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="no-referrer" />
      {preview && (
        <div className="sq-owner-banner">
          Previewing quote as Owner. Acceptance is disabled.
        </div>
      )}
      {!quote ? (
        <main className="sq-loading">
          <h1>Your quotation</h1>
          <p role="status">{error || "Loading your quote…"}</p>
        </main>
      ) : (
        <>
          <header
            className="sq-hero"
            style={{
              backgroundImage: `linear-gradient(#10291e35,#14261e35),url("${quote.design?.coverImage || "/assets/banner.jpg"}")`,
            }}
          >
            <img src="/team-alpha-logo.png" alt="Team Alpha" />
            <strong>{quote.studio.name}</strong>
            <h1>Hi {quote.clientName.split(" ")[0]},</h1>
            <p>
              {quote.status === "Accepted"
                ? "Thank you. Your quote has been accepted."
                : expired
                  ? "This quote has expired."
                  : quote.expiryEnabled !== false
                    ? `Please review and accept this quote by ${date(quote.validUntil)}.`
                    : "Please review and accept your quote."}
            </p>
            {!expired &&
              quote.status !== "Accepted" &&
              quote.expiryEnabled !== false &&
              quote.expiresAt && (
                <small>
                  {Math.floor(remaining / 86400000)} days ·{" "}
                  {Math.floor(remaining / 3600000) % 24} hours remaining · 11:59
                  PM IST
                </small>
              )}
          </header>
          <main>
            <section className="sq-paper sq-summary">
              <div className="sq-document-header">
                <h2>
                  Quote #
                  {quote.documentNumber || quote._id.slice(-6).toUpperCase()}{" "}
                  <span>
                    {preview && quote.status === "Draft"
                      ? "DRAFT"
                      : quote.status === "Accepted"
                        ? "ACCEPTED"
                        : expired
                          ? "EXPIRED"
                          : "OPEN"}
                  </span>
                </h2>
                <div>
                  <button
                    aria-label="Print quote"
                    onClick={() => window.print()}
                  >
                    <Printer size={19} />
                  </button>
                  <button
                    aria-label="Download quote PDF"
                    onClick={() => window.print()}
                  >
                    <Download size={19} />
                  </button>
                </div>
              </div>
              <div className="sq-meta">
                <div>
                  FROM<strong>{quote.studio.name}</strong>
                </div>
                <div>
                  TO<strong>{quote.clientName}</strong>
                </div>
                <div>
                  QUOTE DATE
                  <strong>{date(quote.issueDate || quote.createdAt)}</strong>
                </div>
                <div>
                  EXPIRES
                  <strong>
                    {quote.expiryEnabled === false
                      ? "No expiry"
                      : date(quote.validUntil)}
                  </strong>
                </div>
              </div>
            </section>
            <section className="sq-paper">
              <h2>Items</h2>
              <div className="sq-table">
                <table>
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>QTY</th>
                      <th>PRICE</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((i, n) => (
                      <tr key={n}>
                        <td>
                          <strong>
                            {i.title || i.description.split("\n")[0]}
                          </strong>
                          <p>
                            {i.title
                              ? i.description
                              : i.description.split("\n").slice(1).join("\n")}
                          </p>
                        </td>
                        <td>{i.quantity}</td>
                        <td>{money(i.unitPricePaise)}</td>
                        <td>{money(i.quantity * i.unitPricePaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl>
                <dt>Subtotal</dt>
                <dd>{money(quote.subtotalPaise)}</dd>
                <dt>
                  Discount
                  {quote.discountType === "percent"
                    ? ` (${quote.discountValue}%)`
                    : ""}
                </dt>
                <dd>− {money(quote.discountPaise)}</dd>
                {quote.taxPaise > 0 && (
                  <>
                    <dt>Tax ({quote.taxRateBps / 100}%)</dt>
                    <dd>{money(quote.taxPaise)}</dd>
                  </>
                )}
                <dt>Total</dt>
                <dd>
                  <strong>{money(quote.totalPaise)}</strong>
                </dd>
              </dl>
              {(quote.notes || quote.terms) && (
                <div className="sq-notes">
                  <h3>NOTES</h3>
                  <p>{quote.notes || quote.terms}</p>
                  {quote.notes && quote.terms && (
                    <>
                      <h3>TERMS</h3>
                      <p>{quote.terms}</p>
                    </>
                  )}
                </div>
              )}
              {error && <p role="alert">{error}</p>}
              {quote.status === "Accepted" ? (
                <div className="sq-acceptance">
                  <CheckCircle2 size={22} />
                  <p>
                    Accepted by {quote.acceptedBy} on {date(quote.acceptedAt)}.
                  </p>
                  {quote.autoCreateInvoice !== false && !quote.invoiceReady && (
                    <button onClick={accept} disabled={busy}>
                      Finish invoice generation
                    </button>
                  )}
                </div>
              ) : expired ? (
                <p className="sq-expired">
                  Acceptance has closed. Please contact the studio for an
                  updated quote.
                </p>
              ) : (
                <div className="sq-accept">
                  <p>
                    By selecting Accept Quote, you agree to the services, total
                    and terms above.
                  </p>
                  <button disabled={busy} onClick={accept}>
                    {busy ? "RECORDING ACCEPTANCE…" : "ACCEPT QUOTE"}
                  </button>
                </div>
              )}
            </section>
          </main>
          <footer>
            TEAM ALPHA · STUDIO OS
            {quote.studio.email && (
              <a href={`mailto:${quote.studio.email}`}>{quote.studio.email}</a>
            )}
          </footer>
        </>
      )}
    </div>
  );
  return quote?.status === "Accepted" && !preview ? (
    <ClientProjectWorkspace key={token} token={token} quote={quote}>
      {document}
    </ClientProjectWorkspace>
  ) : (
    document
  );
}
