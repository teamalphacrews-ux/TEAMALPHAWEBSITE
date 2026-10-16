import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Printer,
  Trash2,
  FileText,
  Link as LinkIcon,
  Copy,
  BookmarkPlus,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import { OperationsModal } from "../components/operations/OperationsUI";
import {
  WorkspaceHeader,
  WorkspaceMetrics,
  WorkspaceError,
  WorkspaceSearch,
  WorkspaceEmpty,
  WorkspaceDialog,
  WorkspaceField,
} from "../components/operations/WorkspaceUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
  recordDate,
  rupees,
} from "../components/operations/workspaceData";
const blank = {
  clientName: "",
  email: "",
  lead: "",
  title: "Wedding photography & cinematography",
  validUntil: "",
  status: "Draft",
  items: [{ description: "", quantity: 1, unitPricePaise: 0 }],
  discountPaise: 0,
  taxRateBps: 0,
  terms: "",
};
export default function Quotations() {
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/quotations",
    "/api/leads",
    "/api/studio/settings",
    "/api/studio/quote-templates",
  ]);
  const [quotes = [], leads = [], settings = {}, templates = []] = data;
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Active"),
    [editing, setEditing] = useState(undefined),
    [preview, setPreview] = useState(null),
    [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState("");
  const [share, setShare] = useState(null),
    [templateDialog, setTemplateDialog] = useState(null),
    [templateName, setTemplateName] = useState(""),
    [showTemplates, setShowTemplates] = useState(false);
  const shareQuote = async (q) => {
    setBusy(true);
    try {
      const result = await workspaceRequest(
        "post",
        `/api/studio/quotations/${q._id}/share`,
        {},
      );
      setPreview(null);
      setShare({
        url: `${window.location.origin}/quote/${result.token}`,
        quote: result.quote,
      });
      reload();
    } catch (e) {
      toast.error(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const saveTemplate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSaveError("");
    try {
      await workspaceRequest("post", "/api/studio/quote-templates", {
        ...templateDialog,
        name: templateName,
        validityDays: settings.quotationValidityDays || 14,
      });
      setTemplateDialog(null);
      reload();
      toast.success("Template saved");
    } catch (e) {
      setSaveError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const applyTemplate = (template) => {
    open(null);
    setForm((c) => ({
      ...c,
      title: template.title,
      items: template.items.map((i) => ({ ...i })),
      discountPaise: template.discountPaise,
      taxRateBps: template.taxRateBps,
      terms: template.terms,
      validUntil: new Date(
        Date.now() + (template.validityDays || 14) * 86400000,
      )
        .toISOString()
        .slice(0, 10),
    }));
    setShowTemplates(false);
  };
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const stage = (q) =>
    ["Draft", "Sent"].includes(q.status) &&
    q.validUntil &&
    clock >= Date.parse(q.validUntil.slice(0, 10) + "T18:30:00Z")
      ? "Expired"
      : q.status;
  const open = (quote) => {
    setEditing(quote || null);
    setPreview(null);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (settings.quotationValidityDays ?? 14));
    setForm(
      quote
        ? {
            ...quote,
            status: quote.status === "Sent" ? "Draft" : quote.status,
            lead: quote.lead?._id || quote.lead || "",
            validUntil: quote.validUntil?.slice(0, 10) || "",
          }
        : {
            ...blank,
            items: [{ description: "", quantity: 1, unitPricePaise: 0 }],
            validUntil: expiry.toISOString().slice(0, 10),
            terms: [
              settings.quotationTerms,
              settings.paymentInstructions,
              settings.defaultDeliverables,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
    );
    setSaveError("");
  };
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const updateItem = (index, name, value) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [name]: value } : item,
      ),
    }));
  const subtotal = form.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPricePaise),
    0,
  );
  const tax = Math.round(
    ((subtotal - Number(form.discountPaise)) * Number(form.taxRateBps)) / 10000,
  );
  const total = subtotal - Number(form.discountPaise) + tax;
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const result = await workspaceRequest(
        editing ? "put" : "post",
        "/api/studio/quotations" + (editing ? "/" + editing._id : ""),
        form,
      );
      setEditing(undefined);
      setPreview(result);
      reload();
      toast.success("Quotation saved");
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const visible = quotes.filter(
    (q) =>
      (filter === "All" ||
        (filter === "Active"
          ? q.status !== "Archived"
          : stage(q) === filter)) &&
      [q.clientName, q.email, q.title]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div>
      <WorkspaceHeader
        eyebrow="A BEAUTIFUL FIRST IMPRESSION"
        title="Quotations"
        description="Thoughtful proposals, clear commitments and clear revision history."
      >
        <button
          className="studio-button"
          onClick={() => setShowTemplates(!showTemplates)}
        >
          <Layers size={14} />
          Templates ({templates.length})
        </button>
        <button className="studio-button primary" onClick={() => open(null)}>
          <Plus size={14} />
          Create quotation
        </button>
      </WorkspaceHeader>
      <WorkspaceMetrics
        loading={loading || (!!error && !data.length)}
        items={[
          {
            label: "Draft proposals",
            value: quotes.filter((q) => q.status === "Draft").length,
            note: "Ready for your final touches",
          },
          {
            label: "Sent for review",
            value: quotes.filter((q) => stage(q) === "Sent").length,
            note: "Client links open for review",
          },
          {
            label: "Accepted",
            value: quotes.filter((q) => q.status === "Accepted").length,
            note: "Client acceptance recorded",
          },
          {
            label: "Open proposal value",
            value: rupees(
              quotes
                .filter((q) => ["Draft", "Sent"].includes(stage(q)))
                .reduce((s, q) => s + q.totalPaise, 0) / 100,
            ),
            note: "Draft and sent quotations",
          },
        ]}
      />
      <WorkspaceError error={error} retry={reload} />
      {showTemplates && (
        <section className="studio-card workspace-template-list">
          <h2>Saved quotation templates</h2>
          <p className="studio-muted">
            Reusable services, prices, discounts and terms. Client details are
            never copied.
          </p>
          {!templates.length ? (
            <p>Save any proposal as a template to begin.</p>
          ) : (
            templates.map((t) => (
              <div className="workspace-template-row" key={t._id}>
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    {t.items.length} services · {t.validityDays} days validity
                  </small>
                </div>
                <button
                  className="studio-button small"
                  onClick={() => applyTemplate(t)}
                >
                  Use template
                </button>
                <button
                  className="studio-icon-button"
                  aria-label={"Archive template " + t.name}
                  onClick={async () => {
                    try {
                      await workspaceRequest(
                        "delete",
                        `/api/studio/quote-templates/${t._id}`,
                      );
                      reload();
                    } catch (e) {
                      toast.error(recordError(e));
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </section>
      )}
      <section className="studio-card">
        <div className="studio-toolbar">
          <WorkspaceSearch
            value={query}
            onChange={setQuery}
            placeholder="Search quotations or clients…"
          />
          <select
            className="studio-input workspace-select"
            aria-label="Filter quotation status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "Active",
              "All",
              "Draft",
              "Sent",
              "Expired",
              "Accepted",
              "Declined",
              "Archived",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        {loading || !visible.length ? (
          <WorkspaceEmpty
            loading={loading}
            title="Make the next first impression"
            description="Create a proposal with services, pricing, terms and a clear validity date."
          />
        ) : (
          <div className="studio-table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Valid until</th>
                  <th>Total</th>
                  <th>Stage</th>
                  <th>Revision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((q) => (
                  <tr key={q._id}>
                    <td>
                      <button
                        className="workspace-title-button"
                        onClick={() => setPreview(q)}
                      >
                        {q.clientName}
                      </button>
                      <small>{q.title}</small>
                    </td>
                    <td>{recordDate(q.validUntil)}</td>
                    <td>{rupees(q.totalPaise / 100)}</td>
                    <td>
                      <span
                        className={
                          "studio-badge " +
                          (q.status === "Accepted"
                            ? "green"
                            : q.status === "Declined"
                              ? "rose"
                              : "gold")
                        }
                      >
                        {stage(q)}
                      </span>
                    </td>
                    <td>v{q.revision}</td>
                    <td>
                      <button
                        className="studio-icon-button"
                        aria-label={"View quotation " + q.clientName}
                        onClick={() => setPreview(q)}
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        className="studio-icon-button"
                        aria-label={"Edit quotation " + q.clientName}
                        disabled={q.status === "Accepted"}
                        onClick={() => open(q)}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <WorkspaceDialog
          title={editing ? "Revise quotation" : "Create a quotation"}
          onClose={() => setEditing(undefined)}
          onSubmit={save}
          busy={busy}
          error={saveError}
        >
          <label className="studio-field">
            <span>Start from template</span>
            <select
              className="studio-input"
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((t) => t._id === e.target.value);
                if (t)
                  setForm((c) => ({
                    ...c,
                    title: t.title,
                    items: t.items.map((i) => ({ ...i })),
                    discountPaise: t.discountPaise,
                    taxRateBps: t.taxRateBps,
                    terms: t.terms,
                  }));
              }}
            >
              <option value="">Choose a saved template…</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-form-grid">
            <WorkspaceField
              label="Linked enquiry"
              name="lead"
              value={form.lead}
              onChange={(name, value) => {
                const lead = leads.find((l) => l._id === value);
                setForm((c) => ({
                  ...c,
                  lead: value,
                  ...(lead ? { clientName: lead.name, email: lead.email } : {}),
                }));
              }}
              options={[
                { value: "", label: "No linked enquiry" },
                ...leads.map((l) => ({ value: l._id, label: l.name })),
              ]}
            />
            <WorkspaceField
              label="Stage"
              name="status"
              value={form.status}
              onChange={change}
              options={["Draft", "Declined", "Archived"]}
            />
            <WorkspaceField
              label="Client name"
              name="clientName"
              value={form.clientName}
              onChange={change}
              required
            />
            <WorkspaceField
              label="Client email"
              name="email"
              value={form.email}
              onChange={change}
              type="email"
              required
            />
            <WorkspaceField
              wide
              label="Proposal title"
              name="title"
              value={form.title}
              onChange={change}
              required
            />
            <WorkspaceField
              label="Accept by / expiry date"
              name="validUntil"
              value={form.validUntil}
              onChange={change}
              type="date"
              required
              help="Acceptance closes at 11:59 PM IST on this date."
            />
          </div>
          <div className="workspace-quote-items">
            {form.items.map((item, index) => (
              <div className="workspace-quote-item" key={index}>
                <label className="studio-field">
                  <span>Service {index + 1}</span>
                  <textarea
                    rows={3}
                    maxLength={4000}
                    className="studio-input"
                    aria-label={"Service " + (index + 1)}
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    required
                  />
                </label>
                <label className="studio-field">
                  <span>Qty</span>
                  <input
                    className="studio-input"
                    aria-label={"Quantity " + (index + 1)}
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", Number(e.target.value))
                    }
                    required
                  />
                </label>
                <label className="studio-field">
                  <span>Unit price (₹)</span>
                  <input
                    className="studio-input"
                    aria-label={"Unit price " + (index + 1)}
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    value={item.unitPricePaise / 100}
                    onChange={(e) =>
                      updateItem(
                        index,
                        "unitPricePaise",
                        Math.round(Number(e.target.value) * 100),
                      )
                    }
                    required
                  />
                </label>
                <button
                  type="button"
                  className="studio-icon-button"
                  aria-label={"Remove service " + (index + 1)}
                  disabled={form.items.length === 1}
                  onClick={() =>
                    setForm((c) => ({
                      ...c,
                      items: c.items.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="studio-button small"
              disabled={form.items.length >= 40}
              onClick={() =>
                setForm((c) => ({
                  ...c,
                  items: [
                    ...c.items,
                    { description: "", quantity: 1, unitPricePaise: 0 },
                  ],
                }))
              }
            >
              <Plus size={13} />
              Add service
            </button>
          </div>
          <div className="studio-form-grid">
            <WorkspaceField
              label="Discount (₹)"
              name="discountPaise"
              value={form.discountPaise / 100}
              onChange={(_, value) =>
                change("discountPaise", Math.round(Number(value) * 100))
              }
              type="number"
              min="0"
              step="0.01"
            />
            <WorkspaceField
              label="Tax rate (%)"
              name="taxRateBps"
              value={form.taxRateBps / 100}
              onChange={(_, value) =>
                change("taxRateBps", Math.round(Number(value) * 100))
              }
              type="number"
              min="0"
              max="100"
              step="0.01"
              help="Enter only the rate applicable to this proposal."
            />
            <WorkspaceField
              wide
              label="Terms & deliverables"
              name="terms"
              value={form.terms}
              onChange={change}
              type="textarea"
            />
          </div>
          <div className="workspace-quote-total">
            <span>Proposal total</span>
            <strong>{rupees(total / 100)}</strong>
          </div>
          <p className="studio-muted">
            Share the saved proposal to let the client accept it. Revising a
            shared proposal invalidates its previous link; share the new
            revision. Accepted proposals are locked.
          </p>
        </WorkspaceDialog>
      )}
      {preview && (
        <OperationsModal
          title="Proposal preview"
          onClose={() => setPreview(null)}
          footer={
            <>
              <button className="studio-button" onClick={() => window.print()}>
                <Printer size={14} />
                Print / save PDF
              </button>
              <button
                className="studio-button"
                onClick={() => {
                  setTemplateDialog(preview);
                  setPreview(null);
                  setTemplateName(preview.title);
                  setSaveError("");
                }}
              >
                <BookmarkPlus size={14} />
                Save as template
              </button>
              {["Draft", "Sent"].includes(preview.status) && (
                <button
                  className="studio-button primary"
                  disabled={busy}
                  onClick={() => shareQuote(preview)}
                >
                  <LinkIcon size={14} />
                  Share with client
                </button>
              )}
              <button
                disabled={preview.status === "Accepted"}
                className="studio-button"
                onClick={() => open(preview)}
              >
                <Pencil size={14} />
                Edit proposal
              </button>
            </>
          }
        >
          <article className="studio-quote-document">
            <div className="workspace-proposal-brand">
              {settings.studioName || "Team Alpha"}
              <span>PHOTOGRAPHY & CINEMATOGRAPHY</span>
            </div>
            <p className="studio-eyebrow">
              A PROPOSAL FOR {preview.clientName}
            </p>
            <h2>{preview.title}</h2>
            <p>{preview.email}</p>
            <div className="workspace-proposal-meta">
              <span>Valid until {recordDate(preview.validUntil)}</span>
              <span>
                {settings.invoicePrefix || "TA"}-Q-
                {preview._id.slice(-6).toUpperCase()} · v{preview.revision} ·{" "}
                {preview.status}
              </span>
            </div>
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>
                      {rupees((item.quantity * item.unitPricePaise) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="workspace-summary">
              <dt>Subtotal</dt>
              <dd>{rupees(preview.subtotalPaise / 100)}</dd>
              <dt>Discount</dt>
              <dd>{rupees(preview.discountPaise / 100)}</dd>
              <dt>Tax ({preview.taxRateBps / 100}%)</dt>
              <dd>{rupees(preview.taxPaise / 100)}</dd>
              <dt>Total</dt>
              <dd>
                <strong>{rupees(preview.totalPaise / 100)}</strong>
              </dd>
            </dl>
            <h3>Terms & deliverables</h3>
            <p className="workspace-preserve">
              {preview.terms || "Terms to be agreed with the studio."}
            </p>
            {settings.email && (
              <p>
                {settings.email} · {settings.phone}
              </p>
            )}
          </article>
          <div className="workspace-revision-history">
            <h3>Quotation timeline</h3>
            <p>Created · {recordDate(preview.createdAt)}</p>
            {preview.sharedAt && (
              <p>Shared for review · {recordDate(preview.sharedAt)}</p>
            )}
            <p>
              Acceptance closes · {recordDate(preview.validUntil)} · 11:59 PM
              IST
            </p>
            {preview.acceptedAt && (
              <p>
                Accepted by {preview.acceptedBy} ·{" "}
                {recordDate(preview.acceptedAt)}
              </p>
            )}
            {preview.invoiceId && (
              <p>
                Linked invoice ·{" "}
                {String(preview.invoiceId).slice(-6).toUpperCase()} ·{" "}
                <a href="/admin/finance">Open finance</a>
              </p>
            )}
          </div>
          {preview.history?.length > 0 && (
            <div className="workspace-revision-history">
              <h3>Revision history</h3>
              {preview.history.map((row, index) => (
                <p key={index}>
                  v{row.revision} · {row.status} ·{" "}
                  {rupees(row.totalPaise / 100)} · {recordDate(row.changedAt)}
                </p>
              ))}
            </div>
          )}
        </OperationsModal>
      )}
      {share && (
        <OperationsModal title="Share quotation" onClose={() => setShare(null)}>
          <p>
            The client can review services, pricing and terms, then accept
            before {recordDate(share.quote.validUntil)}, 11:59 PM IST. This
            private link grants access to this quotation.
          </p>
          <label className="studio-field">
            <span>Client quotation link</span>
            <input className="studio-input" readOnly value={share.url} />
          </label>
          <div className="workspace-share-actions">
            <button
              className="studio-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(share.url);
                  toast.success("Link copied");
                } catch {
                  toast.error("Select and copy the link above.");
                }
              }}
            >
              <Copy size={14} />
              Copy link
            </button>
            <a
              className="studio-button primary"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`Hi ${share.quote.clientName}, please review your Team Alpha quotation and accept by ${recordDate(share.quote.validUntil)}: ${share.url}`)}`}
            >
              Share via WhatsApp
            </a>
            <a
              className="studio-button"
              target="_blank"
              rel="noreferrer"
              href={share.url}
            >
              View client quotation
            </a>
          </div>
          <p className="studio-muted">
            WhatsApp opens with a prepared message. Choose the client and send
            it there.
          </p>
        </OperationsModal>
      )}
      {templateDialog && (
        <WorkspaceDialog
          title="Save quotation template"
          onClose={() => setTemplateDialog(null)}
          onSubmit={saveTemplate}
          busy={busy}
          error={saveError}
        >
          <WorkspaceField
            label="Template name"
            name="templateName"
            value={templateName}
            onChange={(_, v) => setTemplateName(v)}
            required
            maxLength={120}
          />
          <p>
            Save services, pricing, discount and terms for future clients.
            Client name, email and project are excluded.
          </p>
        </WorkspaceDialog>
      )}
    </div>
  );
}
