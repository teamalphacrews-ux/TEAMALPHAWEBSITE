import { useEffect, useState } from "react";
import { TEAM_ALPHA_LOGO } from "../utils/branding";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, Printer } from "lucide-react";
import { API_BASE_URL } from "../utils/apiConfig";
import { resolveStudioImage } from '../utils/settingsDefaults';
import { workspaceRequest } from "../admin/components/operations/workspaceData";
import StudioProductBrand from "../components/StudioProductBrand";
import { documentAccentInk } from "../utils/documentAccent";
import { LEGACY_DEFAULT_QUOTE_COVER, quotePreviewCover } from "../utils/quoteWallpapers";
import "./sharedQuotation.css";
import "./studioClientGlass.css";
import { IS_COMMERCIAL_DEPLOYMENT } from "../saas/release";
import ClientProjectWorkspace from "./ClientProjectWorkspace";
import "./clientSmartLinkDocuments.css";
import "./clientDocumentLayout.css";
import "./ownerQuotePreview.css";
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
  const pageTitle = preview ? 'Quotation preview' : quote?.status === 'Accepted' ? 'Client Smart Link' : 'Your quotation';
  useEffect(() => {
    if (!IS_COMMERCIAL_DEPLOYMENT) return;
    const previous = document.title;
    document.title = pageTitle + ' · Studio X OS';
    return () => { document.title = previous; };
  }, [pageTitle]);
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
    if (preview || busy || expired) return;
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
  const accent = /^#[a-f\d]{6}$/i.test(quote?.design?.colorTheme || "")
    ? quote.design.colorTheme
    : "#202622";
  const style = quote
    ? {
        "--quote-accent": accent,
        "--quote-accent-ink": documentAccentInk(accent),
        fontFamily:
          quote.design?.fontTheme === "classic"
            ? "Georgia, serif"
            : quote.design?.fontTheme === "editorial"
              ? "Palatino, Georgia, serif"
              : "Inter, Arial, sans-serif",
      }
    : {};
  const cover = quote?.design?.coverImage;
  const heroStyle = preview
    ? { "--quote-preview-wallpaper": `url(${JSON.stringify(quotePreviewCover(cover))})` }
    : !IS_COMMERCIAL_DEPLOYMENT && {
        backgroundImage: `linear-gradient(#10291e35,#14261e35),url("${cover || LEGACY_DEFAULT_QUOTE_COVER}")`,
      };
  const surface = preview ? " sq-owner-preview" : IS_COMMERCIAL_DEPLOYMENT ? " studio-client-glass" : "";
  const quotationDocument = (
    <div className={`shared-quotation${surface}`} style={style}>
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="no-referrer" />
      {preview && (
        <div className="sq-owner-banner">
          <strong>Owner preview</strong>
          <span>Acceptance is disabled.</span>
        </div>
      )}
      {!quote ? (
        <main className={preview ? "sq-preview-state" : IS_COMMERCIAL_DEPLOYMENT ? "sq-smart-link-state" : "sq-loading"}>
          {IS_COMMERCIAL_DEPLOYMENT && <StudioProductBrand tone={preview ? "light" : "inverse"} />}
          <h1>Your quotation</h1>
          <p role={error ? "alert" : "status"}>{error || "Loading your quote…"}</p>
        </main>
      ) : (
        <>
          <header className="sq-hero" style={heroStyle || undefined}>
            <img src={resolveStudioImage(quote.studio.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)} alt={quote.studio.name} />
            <strong>{quote.studio.name}</strong>
            <h1>Hi {quote.clientName.split(" ")[0]},</h1>
            <p>
              {quote.status === "Accepted"
                ? "Thank you. Your quote has been accepted."
                : expired
                  ? "This quote has expired."
                    : quote.expiryEnabled !== false && quote.validUntil
                    ? `Please review and accept this quote by ${date(quote.validUntil)}.`
                    : "Please review and accept your quote."}
            </p>
            {!preview && !expired &&
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
                    type="button"
                    aria-label={preview ? undefined : "Print or save quote as PDF"}
                    title="Print or save quote as PDF"
                    onClick={() => window.print()}
                  >
                    <Printer size={19} aria-hidden="true" />
                    {preview && "Print or save PDF"}
                  </button>
                </div>
              </div>
              {preview && quote.title && <p className="sq-preview-title">{quote.title}</p>}
              <div className="sq-meta">
                <div>
                  FROM<strong>{quote.studio.name}</strong>
                  {quote.studio.address && <small>{quote.studio.address}</small>}
                  {quote.studio.taxId && <small>GSTIN: {quote.studio.taxId}</small>}
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
                <table aria-label="Quotation items" role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader" scope="col">Item</th>
                      <th role="columnheader" scope="col">Quantity</th>
                      <th role="columnheader" scope="col">Unit price</th>
                      <th role="columnheader" scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {quote.items.map((i, n) => {
                      const [firstLine, ...otherLines] = (i.description || "").split("\n");
                      const description = i.title ? i.description : otherLines.join("\n");
                      return <tr key={n} role="row">
                        <td role="cell">
                          <strong>{i.title || firstLine}</strong>
                          {preview && <span className="sq-preview-item-rate" aria-hidden="true">
                            {i.quantity} × {money(i.unitPricePaise)}
                          </span>}
                          {description && <p>{description}</p>}
                        </td>
                        <td role="cell"><span className="client-document-cell-label" aria-hidden="true">Quantity</span>{i.quantity}</td>
                        <td role="cell"><span className="client-document-cell-label" aria-hidden="true">Unit price</span>{money(i.unitPricePaise)}</td>
                        <td role="cell"><span className="client-document-cell-label" aria-hidden="true">Amount</span>{money(i.quantity * i.unitPricePaise)}</td>
                      </tr>;
                    })}
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
                  <h3>{preview ? (quote.notes ? "Notes" : "Terms") : "NOTES"}</h3>
                  <p>{quote.notes || quote.terms}</p>
                  {quote.notes && quote.terms && (
                    <>
                      <h3>{preview ? "Terms" : "TERMS"}</h3>
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
                    <button onClick={accept} disabled={preview || busy}>
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
                  <button disabled={preview || busy} onClick={accept}>
                    {busy ? "RECORDING ACCEPTANCE…" : "ACCEPT QUOTE"}
                  </button>
                </div>
              )}
            </section>
          </main>
          <footer>
            {IS_COMMERCIAL_DEPLOYMENT ? quote.studio.name : "TEAM ALPHA · STUDIO OS"}
            {quote.studio.email && (
              <a href={`mailto:${quote.studio.email}`}>{quote.studio.email}</a>
            )}
          </footer>
        </>
      )}
    </div>
  );
  return quote && !preview ? (
    <ClientProjectWorkspace key={token} token={token} quote={quote}>
      {quotationDocument}
    </ClientProjectWorkspace>
  ) : (
    quotationDocument
  );
}
