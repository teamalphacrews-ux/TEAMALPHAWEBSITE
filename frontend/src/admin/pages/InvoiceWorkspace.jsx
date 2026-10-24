import { useCallback, useEffect, useRef, useState } from "react";
import { TEAM_ALPHA_LOGO } from "../../utils/branding";
import { invoiceDefaults, defaultPaymentSchedule, documentCommunication, resolveStudioImage } from '../../utils/settingsDefaults';
import { API_BASE_URL } from '../../utils/apiConfig';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useOutletContext,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  X,
  Copy,
  ExternalLink,
  Link2,
  Pencil,
} from "lucide-react";
import {
  workspaceRequest,
  recordError,
} from "../components/operations/workspaceData";
import { OperationsModal } from "../components/operations/OperationsUI";
import { InvoiceDocument } from "../../pages/PublicInvoice";
import { downloadInvoice } from "../../utils/invoiceDocument";
import "./invoiceWorkspace.css";
import "./documentWorkspaceRefinements.css";
import { WorkspaceActionMenu } from "../components/operations/WorkspaceActionMenu";
import "./studioOperations.css";
const addressOf = (c) =>
  [
    c?.addressLine1,
    c?.addressLine2,
    c?.city,
    c?.state,
    c?.postalCode,
    c?.country,
  ]
    .filter(Boolean)
    .join(", ");
const studioIssuer = (studio) => ({
  name: studio.legalName || studio.studioName || "Team Alpha",
  address: studio.address || "",
  email: studio.email || "",
  phone: studio.phone || "",
  website: studio.website || "",
  taxId: studio.gstin || studio.taxId || "",
  logoUrl: studio.logoUrl || TEAM_ALPHA_LOGO,
  paymentInstructions: studio.paymentInstructions || "",
  bankDetails: studio.bankDetails || "",
  upiId: studio.upiId || "",
});
const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(n || 0),
  );
const day = (v) =>
  v && Number.isFinite(+new Date(v))
    ? new Date(v).toISOString().slice(0, 10)
    : "";
const plusDays = (v, n) => (v ? day(Date.parse(v) + n * 86400000) : "");
const emptyItem = () => ({
  title: "",
  description: "",
  quantity: 1,
  unitPricePaise: 0,
});
function initial() {
  const today = day(new Date());
  return {
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    title: "Photography & cinematography",
    leadId: "",
    issuer: null,
    contactId: "",
    studioProjectId: "",
    documentNumber: "",
    documentStatus: "Draft",
    invoiceDate: today,
    dueDate: plusDays(today, 30),
    items: [emptyItem()],
    events: [],
    discountType: "fixed",
    discountValue: 0,
    discount: 0,
    taxRateBps: 0,
    extraCharges: 0,
    advancePaid: 0,
    notes: "",
    terms: "",
    status: "Pending",
    currency: "INR",
    paymentScheduleEnabled: false,
    paymentSchedule: [],
    acceptedPaymentMethods: ["BANKING", "G-pay", "UPI"],
    paymentReminders: false,
    reminderOffsets: [-7, 0, 3, 7, 14],
    allowTip: false,
    design: {
      coverUrl: "/assets/studio-wedding.webp",
      accentColor: "#1f2927",
      fontFamily: "modern",
      showLogo: true,
    },
  };
}
function normalize(i) {
  const items = i.items?.length
    ? i.items
    : [
        ...(i.events || []).map((e) => ({
          title: e.eventName || "Service",
          description: [e.services, e.equipment, e.dateLocation]
            .filter(Boolean)
            .join("\n"),
          quantity: 1,
          unitPricePaise: Math.round(Number(e.price || 0) * 100),
        })),
        ...(i.deliverables?.length || i.deliverablesPrice
          ? [
              {
                title: "Deliverables",
                description: (i.deliverables || []).join("\n"),
                quantity: 1,
                unitPricePaise: Math.round(
                  Number(i.deliverablesPrice || 0) * 100,
                ),
              },
            ]
          : []),
      ];
  return {
    ...initial(),
    ...i,
    invoiceDate: day(i.invoiceDate),
    dueDate: day(i.dueDate) || plusDays(day(i.invoiceDate), 30),
    items: items.length ? items : [emptyItem()],
    events: [],
    deliverables: [],
    deliverablesPrice: 0,
    discountValue: i.discountValue ?? i.discount ?? 0,
    taxRateBps:
      i.items?.length || (i.sourceQuotation && i.taxAmount)
        ? i.taxRateBps || 0
        : 0,
    extraCharges:
      !i.items?.length && i.sourceQuotation && i.taxAmount
        ? Math.max(0, Number(i.extraCharges || 0) - Number(i.taxAmount))
        : i.extraCharges || 0,
    paymentSchedule: (i.paymentSchedule || []).map((p) => ({
      label: p.label || '',
      amountPaise: p.amountPaise,
      dueDate: day(p.dueDate),
    })),
  };
}
function Field({ label, value, onChange, type = "text", children, ...props }) {
  return (
    <label className="invoice-field">
      <span>{label}</span>
      {children ||
        (type === "textarea" ? (
          <textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            {...props}
          />
        ) : (
          <input
            type={type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            {...props}
          />
        ))}
    </label>
  );
}
function Toggle({ label, checked, onChange, description }) {
  return (
    <div className="invoice-option">
      <strong>{label}</strong>
      <label className="invoice-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span />
        {checked ? "On" : "Off"}
      </label>
      {description && <small>{description}</small>}
    </div>
  );
}
export default function InvoiceWorkspace() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    navigate = useNavigate();
  const { setIsFocusMode } = useOutletContext();
  useEffect(() => {
    setIsFocusMode(true);
    return () => setIsFocusMode(false);
  }, [setIsFocusMode]);
  const [draft, setDraft] = useState(initial),
    [context, setContext] = useState({
      contacts: [],
      projects: [],
      studio: {},
    }),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(""),
    [actions, setActions] = useState(false),
    [link, setLink] = useState(""),
    [compose, setCompose] = useState({
      subject: "",
      message: "",
      sendCopy: true,
      scheduledAt: "",
    }),
    [saveState, setSaveState] = useState("Unsaved draft");
  const version = useRef(0),
    savedVersion = useRef(0),
    savedId = useRef(id),
    dirty = useRef(false);
  const saving = useRef(false),
    shareInput = useRef(null),
    initialized = useRef(false);
  useEffect(() => {
    if (id && savedId.current === id && initialized.current) return;
    let active = true;
    initialized.current = false;
    setLoaded(false);
    savedId.current = id;
    dirty.current = false;
    const paths = [
      "/api/contacts",
      "/api/studio-projects",
      "/api/studio/settings",
      "/api/invoices/delivery-status",
    ];
    if (search.get("lead")) paths.push("/api/leads");
    Promise.allSettled(paths.map((p) => workspaceRequest("get", p)))
      .then(async (result) => {
        const contacts =
            result[0].status === "fulfilled" ? result[0].value : [],
          projects = result[1].status === "fulfilled" ? result[1].value : [],
          studio = result[2].status === "fulfilled" ? result[2].value : {};
        let invoice = initial();
        if (id)
          invoice = normalize(
            await workspaceRequest("get", `/api/invoices/${id}`),
          );
        else {
          invoice = { ...invoice, ...invoiceDefaults(studio), _useDefaultPaymentSchedule: true };
          const contact = contacts.find((c) => c._id === search.get("contact"));
          invoice.terms = studio.quotationTerms || "";
          invoice.design = {
            coverUrl: studio.coverImage || "/assets/studio-wedding.webp",
            accentColor: studio.colorTheme || "#1f2927",
            fontFamily: studio.fontTheme || "modern",
            showLogo: true,
          };
          if (contact)
            invoice = {
              ...invoice,
              contactId: contact._id,
              clientName:
                `${contact.firstName} ${contact.lastName || ""}`.trim(),
              clientEmail: contact.email,
              clientPhone: contact.phone || "",
              clientAddress: addressOf(contact),
            };
          if (search.get("project"))
            invoice.studioProjectId = search.get("project");
          const lead =
            result[4]?.status === "fulfilled"
              ? result[4].value.find((l) => l._id === search.get("lead"))
              : null;
          if (lead) {
            const contactId =
              lead.contactId?._id || lead.contactId || invoice.contactId;
            invoice = {
              ...invoice,
              leadId: lead._id,
              contactId,
              studioProjectId:
                lead.studioProjectId?._id ||
                lead.studioProjectId ||
                invoice.studioProjectId,
              clientName: lead.name,
              clientEmail: lead.email || "",
              clientPhone: lead.phone || "",
              clientAddress: addressOf(
                contacts.find((c) => c._id === contactId),
              ),
              title:
                lead.projectName ||
                (lead.eventType
                  ? lead.eventType + " photography & cinematography"
                  : invoice.title),
              advancePaid:
                lead.paymentStatus === "Paid"
                  ? Number(lead.totalAmount || 0)
                  : lead.paymentStatus === "Deposit Paid"
                    ? Math.min(
                        Number(lead.depositAmount || 0),
                        Number(lead.totalAmount || 0),
                      )
                    : 0,
              items: [
                {
                  title: lead.eventType || "Photography coverage",
                  description: [lead.eventLocation, lead.remarks]
                    .filter(Boolean)
                    .join("\n"),
                  quantity: 1,
                  unitPricePaise: Math.round(
                    Number(lead.totalAmount || 0) * 100,
                  ),
                },
              ],
            };
          } else if (search.get("lead"))
            throw new Error(
              "The linked enquiry could not be loaded. Please open it again.",
            );
        }
        invoice.issuer = { ...studioIssuer(studio), ...(invoice.issuer || {}) };
        if (active) {
          setContext({
            contacts,
            projects,
            studio,
            emailConfigured:
              result[3].status === "fulfilled" &&
              result[3].value.emailConfigured,
          });
          setDraft(invoice);
          setLoaded(true);
          initialized.current = true;
          setSaveState(id ? "All changes saved" : "Unsaved draft");
          savedId.current = id;
          dirty.current = false;
        }
      })
      .catch((e) => {
        if (active) {
          setError(recordError(e));
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [id, search]);
  const change = (key, value) => {
    version.current++;
    dirty.current = true;
    setSaveState("Unsaved changes");
    setDraft((d) => ({ ...d, [key]: value, ...(key === 'paymentSchedule' ? { _useDefaultPaymentSchedule: false } : {}) }));
  };
  const subtotal = draft.items.reduce(
    (s, i) => s + Number(i.quantity || 0) * Number(i.unitPricePaise || 0),
    0,
  );
  const discount =
    draft.discountType === "percent"
      ? Math.round((subtotal * Number(draft.discountValue || 0)) / 100)
      : Math.round(Number(draft.discountValue || 0) * 100);
  const tax = Math.round(
    ((subtotal - discount) * Number(draft.taxRateBps || 0)) / 10000,
  );
  const totalPaise =
    subtotal -
    discount +
    tax +
    Math.round(Number(draft.extraCharges || 0) * 100);
  const accumulated = draft.paymentSchedule
    .slice(0, -1)
    .reduce((sum, p) => sum + Number(p.amountPaise || 0), 0);
  const schedule = draft._useDefaultPaymentSchedule && draft.paymentScheduleEnabled ? defaultPaymentSchedule(context.studio, totalPaise, draft.invoiceDate, draft.dueDate) : draft.paymentSchedule.map((p, index, arr) =>
    index === arr.length - 1
      ? { ...p, amountPaise: totalPaise - accumulated, dueDate: draft.dueDate }
      : p,
  );
  const current = {
    ...draft,
    paymentSchedule: schedule,
    total: totalPaise / 100,
    discount: discount / 100,
    taxAmount: tax / 100,
    studio: draft.issuer || studioIssuer(context.studio),
  };
  const save = useCallback(async () => {
    if (saving.current || busy) return null;
    saving.current = true;
    const v = version.current;
    setBusy(true);
    setError("");
    setSaveState("Saving…");
    try {
      const result = await workspaceRequest(
        savedId.current ? "put" : "post",
        `/api/invoices${savedId.current ? `/${savedId.current}` : ""}`,
        { ...draft, paymentSchedule: schedule },
      );
      savedId.current = result._id;
      savedVersion.current = v;
      if (version.current === v) {
        dirty.current = false;
        setSaveState("All changes saved");
        setDraft((d) => ({
          ...d,
          _id: result._id,
          documentNumber: result.documentNumber,
          deliveries: result.deliveries,
          scheduledDelivery: result.scheduledDelivery,
          paymentSchedule: (result.paymentSchedule || []).map(p => ({ ...p, dueDate: day(p.dueDate) })),
          _useDefaultPaymentSchedule: false,
        }));
      }
      if (!id) navigate(`/admin/invoices/${result._id}`, { replace: true });
      return version.current === v ? result : null;
    } catch (e) {
      setError(recordError(e));
      setSaveState("Changes not saved");
      savedVersion.current = v;
      return null;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [busy, draft, schedule, id, navigate]);
  useEffect(() => {
    if (
      !loaded ||
      !id ||
      !dirty.current ||
      busy ||
      ["delete", "cancel", "send", "confirm-link", "approve"].includes(modal)
    )
      return;
    const timer = setTimeout(() => {
      if (dirty.current && version.current !== savedVersion.current) save();
    }, 1800);
    return () => clearTimeout(timer);
  }, [draft, loaded, id, busy, save, modal]);
  const itemChange = (index, key, value) =>
    change(
      "items",
      draft.items.map((item, n) =>
        n === index ? { ...item, [key]: value } : item,
      ),
    );
  const move = (index, offset) => {
    const items = [...draft.items];
    [items[index], items[index + offset]] = [
      items[index + offset],
      items[index],
    ];
    change("items", items);
  };
  const splitSchedule = (count) => {
    const amount = Math.floor(totalPaise / count);
    change(
      "paymentSchedule",
      Array.from({ length: count }, (_, n) => ({
        amountPaise:
          n === count - 1 ? totalPaise - amount * (count - 1) : amount,
        dueDate:
          n === count - 1
            ? draft.dueDate
            : plusDays(
                draft.invoiceDate,
                Math.min(
                  n,
                  Math.max(
                    0,
                    Math.floor(
                      (Date.parse(draft.dueDate) -
                        Date.parse(draft.invoiceDate)) /
                        86400000,
                    ) - 1,
                  ),
                ),
              ),
      })),
    );
  };
  const openSend = async () => {
    const invoice = await save();
    if (!invoice) return;
    setCompose({
      ...documentCommunication(context.studio, 'invoice', invoice),
      sendCopy: true,
      scheduledAt: "",
      requestId: crypto.randomUUID(),
    });
    setModal("send");
  };
  const share = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await workspaceRequest(
        "post",
        `/api/invoices/${savedId.current}/share`,
      );
      setLink(r.url);
      const updated = await workspaceRequest(
        "get",
        `/api/invoices/${savedId.current}`,
      );
      setDraft((d) => ({
        ...d,
        documentStatus: "Sent",
        deliveries: updated.deliveries,
        sharedAt: updated.sharedAt,
        linkRevokedAt: updated.linkRevokedAt,
      }));
      setModal("link");
      setNotice(r.message);
    } catch (e) {
      setError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await workspaceRequest(
        "post",
        `/api/invoices/${savedId.current}/send`,
        {
          ...compose,
          scheduledAt: compose.scheduledAt
            ? new Date(compose.scheduledAt).toISOString()
            : undefined,
        },
      );
      setNotice(r.message);
      setModal("");
      const updated = await workspaceRequest(
        "get",
        `/api/invoices/${savedId.current}`,
      );
      setDraft((d) => ({ ...d, deliveries: updated.deliveries, sharedAt: updated.sharedAt, linkRevokedAt: updated.linkRevokedAt }));
      if (!compose.scheduledAt)
        setDraft((d) => ({ ...d, documentStatus: "Sent" }));
      else
        setDraft((d) => ({
          ...d,
          scheduledDelivery: { at: r.scheduledAt, state: "scheduled" },
        }));
    } catch (e) {
      setError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const action = async (name) => {
    setActions(false);
    if (["cancel", "delete"].includes(name)) {
      setModal(name);
      return;
    }
    if (name === "history") {
      setModal("history");
      return;
    }
    const invoice = await save();
    if (!invoice) return;
    setBusy(true);
    try {
      if (name === "duplicate") {
        const copy = await workspaceRequest(
          "post",
          `/api/invoices/${invoice._id}/duplicate`,
        );
        navigate(`/admin/invoices/${copy._id}`);
      }
      if (name === "revoke") {
        await workspaceRequest("delete", `/api/invoices/${invoice._id}/share`);
        setLink("");
        setDraft(previous => ({ ...previous, linkRevokedAt: new Date().toISOString() }));
        setNotice("Invoice link revoked.");
      }
      if (name === 'regenerate') {
        const result = await workspaceRequest('post', `/api/invoices/${invoice._id}/share/regenerate`, {});
        setLink(result.url);
        setDraft(previous => ({ ...previous, sharedAt: new Date().toISOString(), linkRevokedAt: undefined }));
        setModal('link');
        setNotice('A new link is ready with current studio visibility settings. The previous invoice link no longer works.');
      }
    } catch (e) {
      setError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const approveInvoice = async () => {
    const invoice = await save();
    if (!invoice) return;
    setBusy(true);
    setError("");
    try {
      const issued = await workspaceRequest(
        "post",
        "/api/invoices/" + invoice._id + "/approve",
      );
      setDraft((d) => ({
        ...d,
        documentStatus: issued.documentStatus,
        approvedAt: issued.approvedAt,
      }));
      setModal("");
      setNotice(
        "Invoice issued. Its payment schedule is now visible on the client's original quote link.",
      );
    } catch (e) {
      setError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const destructive = async () => {
    setBusy(true);
    try {
      if (modal === "delete") {
        await workspaceRequest("delete", `/api/invoices/${savedId.current}`);
        navigate("/admin/finance");
      } else {
        await workspaceRequest("put", `/api/invoices/${savedId.current}`, {
          status: "Cancelled",
          documentStatus: "Cancelled",
        });
        setDraft((d) => ({
          ...d,
          status: "Cancelled",
          documentStatus: "Cancelled",
        }));
        setModal("");
        setNotice("Invoice cancelled. Client access is closed.");
      }
    } catch (e) {
      setError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  if (!loaded)
    return (
      <div className="invoice-editor">
        <p role="status">Loading invoice workspace…</p>
      </div>
    );
  return (
    <div className="invoice-editor">
      <header className="invoice-editor-toolbar">
        <Link to="/admin/finance" aria-label="Back to finance">
          <ArrowLeft size={21} />
        </Link>
        <div className="invoice-editor-title">
          <strong>
            {id
              ? `Invoice ${draft.documentNumber || `INV-${id.slice(-8).toUpperCase()}`}`
              : "New invoice"}
          </strong>
          {draft.studioProjectId && (
            <Link to={`/admin/studio-projects/${draft.studioProjectId}`}>
              Linked project
            </Link>
          )}
        </div>
        <span className="invoice-status">
          {draft.documentStatus.toUpperCase()}
        </span>
        <small role="status">{saveState}</small>
        <div className="invoice-toolbar-actions">
          <WorkspaceActionMenu label="Actions" className="invoice-menu" menuClassName="invoice-action-dropdown" open={actions} onOpenChange={setActions} disabled={busy}>
            <>
                <button onClick={() => action("duplicate")}>Duplicate</button>
                <button
                  onClick={() => {
                    setActions(false);
                    downloadInvoice(current).catch(() =>
                      setError(
                        "PDF download failed. Open Preview and use Print to save a PDF.",
                      ),
                    );
                  }}
                >
                  Download PDF
                </button>
                <button onClick={() => action("history")} disabled={!id}>
                  Delivery history
                </button>
                <button onClick={() => action("revoke")} disabled={!id || !draft.sharedAt || Boolean(draft.linkRevokedAt)}>
                  Revoke share link
                </button>
                <button onClick={() => action('regenerate')} disabled={draft.documentStatus !== 'Sent'}>Regenerate share link</button>
                <button onClick={() => action("cancel")} disabled={!id}>
                  Cancel invoice
                </button>
                <button
                  onClick={() => action("delete")}
                  disabled={
                    !id ||
                    draft.documentStatus !== "Draft" ||
                    !!draft.sourceQuotation ||
                    !!draft.sharedAt ||
                    draft.status === "Paid"
                  }
                  title="Unsent drafts can be deleted. Cancel issued or quotation-linked invoices to retain their history."
                >
                  Delete invoice
                </button>
            </>
          </WorkspaceActionMenu>
          <button
            disabled={busy || draft.documentStatus === "Cancelled"}
            onClick={async () => {
              const invoice = await save();
              if (invoice) setModal("confirm-link");
            }}
          >
            <Link2 size={15} /> Share link
          </button>
          {draft.documentStatus === "Draft" && (
            <button disabled={busy} onClick={() => setModal("approve")}>
              Approve & issue
            </button>
          )}
          <button onClick={() => setModal("design")}>Edit design</button>
          <button onClick={() => setModal("preview")}>Preview</button>
          <button onClick={save} disabled={busy}>
            Save
          </button>
          <button
            className="invoice-primary"
            onClick={openSend}
            disabled={busy}
          >
            Send invoice
          </button>
        </div>
      </header>
      {error && (
        <div className="invoice-editor-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="invoice-editor-notice" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss notice">
            <X size={15} />
          </button>
        </div>
      )}
      <div className="invoice-editor-body">
        <aside
          className="invoice-editor-settings"
          aria-label="Invoice settings"
        >
          <h2>Settings</h2>
          <Field
            label="Issue date"
            type="date"
            value={draft.invoiceDate}
            onChange={(v) => change("invoiceDate", v)}
          />
          <div className="invoice-date-control">
            <Field
              label={
                draft.paymentScheduleEnabled
                  ? "Final Payment Due"
                  : "Payment Due"
              }
              type="date"
              value={draft.dueDate}
              min={draft.invoiceDate}
              onChange={(v) => change("dueDate", v)}
            />
            <select
              aria-label="Payment due preset"
              value=""
              onChange={(e) =>
                change(
                  "dueDate",
                  plusDays(draft.invoiceDate, Number(e.target.value)),
                )
              }
            >
              <option value="" disabled>
                Choose due date
              </option>
              {[
                [0, "On receipt"],
                [7, "Within 7 days"],
                [14, "Within 14 days"],
                [21, "Within 21 days"],
                [30, "Within 30 days"],
                [90, "Within 90 days"],
              ].map(([n, label]) => (
                <option key={n} value={n}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <Field label="Currency">
            <select value="INR" onChange={() => {}}>
              <option value="INR">INR - Indian Rupees</option>
            </select>
          </Field>
          <Toggle
            label="Payment Reminders"
            checked={draft.paymentReminders}
            onChange={(v) => change("paymentReminders", v)}
            description={
              context.emailConfigured
                ? "Automatically email reminders for each unpaid scheduled payment."
                : "Configure studio email to send automatic reminders."
            }
          />
          {draft.paymentReminders && (
            <div className="invoice-checkboxes">
              {[...new Set([-7, 0, 3, 7, 14, ...draft.reminderOffsets])].sort((a, b) => a - b).map(n => [n, n === 0 ? 'On due date' : `${Math.abs(n)} days ${n < 0 ? 'before' : 'after'}`]).map(([n, label]) => (
                <label key={n}>
                  <input
                    type="checkbox"
                    checked={draft.reminderOffsets.includes(n)}
                    onChange={(e) =>
                      change(
                        "reminderOffsets",
                        e.target.checked
                          ? [...draft.reminderOffsets, n]
                          : draft.reminderOffsets.filter((x) => x !== n),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          )}

          <div className="invoice-rail-summary">
            <span>Invoice total</span>
            <strong>{money(totalPaise / 100)}</strong>
            <small>
              Balance due{" "}
              {money(
                Math.max(
                  0,
                  totalPaise / 100 -
                    (draft.status === "Paid"
                      ? totalPaise / 100
                      : draft.advancePaid),
                ),
              )}
            </small>
          </div>
          <button
            className="invoice-text-action"
            onClick={() => setModal("design")}
          >
            Edit document design
          </button>
        </aside>
        <div className="invoice-editor-content">
          <section className="invoice-editor-section invoice-business">
            <div className="invoice-business-identity">
              {draft.design.showLogo !== false && (
                <img
                  src={resolveStudioImage(draft.issuer?.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)}
                  alt={draft.issuer?.name || "Team Alpha"}
                />
              )}
              <div>
                <span className="invoice-section-kicker">FROM</span>
                <h2>{draft.issuer?.name || "Team Alpha"}</h2>
                <p>{draft.issuer?.address || "Add your studio address"}</p>
                <p>
                  {[draft.issuer?.email, draft.issuer?.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {draft.issuer?.taxId && (
                  <p>GSTIN / Tax ID: {draft.issuer.taxId}</p>
                )}
              </div>
              <button onClick={() => setModal("business")}>
                <Pencil size={15} /> Edit business details
              </button>
            </div>
            <Field
              label="Invoice title"
              value={draft.title}
              onChange={(v) => change("title", v)}
              maxLength={300}
            />
          </section>
          <section className="invoice-editor-section">
            <h1>Invoice details</h1>
            <div className="invoice-fields">
              <Field label="Contact">
                <select
                  value={draft.contactId || ""}
                  onChange={(e) => {
                    const c = context.contacts.find(
                      (x) => x._id === e.target.value,
                    );
                    if (c) {
                      version.current++;
                      dirty.current = true;
                      setDraft((d) => ({
                        ...d,
                        contactId: c._id,
                        studioProjectId: "",
                        leadId: "",
                        clientAddress: addressOf(c),
                        clientName: `${c.firstName} ${c.lastName || ""}`.trim(),
                        clientEmail: c.email,
                        clientPhone: c.phone || "",
                      }));
                    } else change("contactId", "");
                  }}
                >
                  <option value="">Enter client manually</option>
                  {context.contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Project">
                <select
                  value={draft.studioProjectId || ""}
                  onChange={(e) => change("studioProjectId", e.target.value)}
                >
                  <option value="">No linked project</option>
                  {context.projects
                    .filter(
                      (p) =>
                        !draft.contactId ||
                        String(p.contactId?._id || p.contactId) ===
                          draft.contactId,
                    )
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label="Client name"
                value={draft.clientName}
                onChange={(v) => change("clientName", v)}
                required
                maxLength={120}
              />
              <Field
                label="Client email"
                type="email"
                value={draft.clientEmail}
                onChange={(v) => change("clientEmail", v)}
              />
              <Field
                label="Client phone"
                value={draft.clientPhone}
                onChange={(v) => change("clientPhone", v)}
              />
              <Field
                label="Billing address"
                type="textarea"
                value={draft.clientAddress}
                onChange={(v) => change("clientAddress", v)}
                rows={3}
                maxLength={4000}
              />
              <Field
                label="Invoice number"
                value={draft.documentNumber}
                onChange={(v) => change("documentNumber", v)}
                placeholder="Generated on save"
                maxLength={60}
              />
            </div>
          </section>
          <section className="invoice-editor-section">
            <h2>Items</h2>
            <div className="invoice-item-heading">
              <span>ITEM</span>
              <span>QTY</span>
              <span>PRICE</span>
              <span>AMOUNT</span>
            </div>
            {draft.items.map((item, index) => (
              <div className="invoice-edit-item" key={index}>
                <div className="invoice-item-copy">
                  <input
                    aria-label={`Item ${index + 1} title`}
                    placeholder="Item name"
                    value={item.title}
                    onChange={(e) => itemChange(index, "title", e.target.value)}
                    maxLength={300}
                  />
                  <textarea
                    aria-label={`Item ${index + 1} description`}
                    placeholder="Description, services and deliverables"
                    value={item.description}
                    onChange={(e) =>
                      itemChange(index, "description", e.target.value)
                    }
                    maxLength={8000}
                  />
                </div>
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={item.quantity}
                  onChange={(e) =>
                    itemChange(index, "quantity", Number(e.target.value))
                  }
                />
                <label className="invoice-price-input">
                  <span>₹</span>
                  <input
                    aria-label={`Item ${index + 1} price`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPricePaise / 100}
                    onChange={(e) =>
                      itemChange(
                        index,
                        "unitPricePaise",
                        Math.round(Number(e.target.value) * 100),
                      )
                    }
                  />
                </label>
                <strong>
                  {money((item.quantity * item.unitPricePaise) / 100)}
                </strong>
                <div className="invoice-item-actions">
                  <button
                    aria-label={`Move item ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    aria-label={`Move item ${index + 1} down`}
                    disabled={index === draft.items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    aria-label={`Duplicate item ${index + 1}`}
                    onClick={() =>
                      change("items", [
                        ...draft.items.slice(0, index + 1),
                        { ...item },
                        ...draft.items.slice(index + 1),
                      ])
                    }
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    aria-label={`Delete item ${index + 1}`}
                    disabled={draft.items.length === 1}
                    onClick={() =>
                      change(
                        "items",
                        draft.items.filter((_, n) => n !== index),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            <button
              className="invoice-text-action"
              onClick={() => change("items", [...draft.items, emptyItem()])}
              disabled={draft.items.length >= 40}
            >
              <Plus size={15} /> Add Item
            </button>
            <dl className="invoice-edit-totals">
              <dt>Subtotal</dt>
              <dd>{money(subtotal / 100)}</dd>
              <dt>
                <button onClick={() => setModal("discount")}>
                  {discount ? "Discount" : "Add discount"}
                </button>
              </dt>
              <dd>{discount ? `−${money(discount / 100)}` : "—"}</dd>
              <dt>
                <button onClick={() => setModal("tax")}>
                  {tax ? `Tax (${draft.taxRateBps / 100}%)` : "Add tax"}
                </button>
              </dt>
              <dd>{tax ? money(tax / 100) : "—"}</dd>
              <dt>
                <strong>Total</strong>
              </dt>
              <dd>
                <strong>{money(totalPaise / 100)}</strong>
              </dd>
            </dl>
          </section>
          <section className="invoice-editor-section">
            <Field
              label="Notes"
              type="textarea"
              value={draft.notes}
              onChange={(v) => change("notes", v)}
              rows={6}
              maxLength={12000}
            />
            <Field
              label="Terms"
              type="textarea"
              value={draft.terms}
              onChange={(v) => change("terms", v)}
              rows={4}
              maxLength={12000}
            />
          </section>
          <section className="invoice-editor-section">
            <h2>Payment schedule</h2>
            <Toggle
              label="Payment Schedule"
              checked={draft.paymentScheduleEnabled}
              onChange={(v) => {
                change("paymentScheduleEnabled", v);
                if (v && !draft.paymentSchedule.length) splitSchedule(2);
              }}
              description="Use a payment schedule to collect deposits or retainers, or set up installments."
            />
            {draft.paymentScheduleEnabled && (
              <div className="invoice-schedule">
                <div className="invoice-schedule-heading">
                  <span>PAYMENT</span>
                  <span>AMOUNT</span>
                  <span>DUE DATE</span>
                </div>
                {schedule.map((p, index) => (
                  <div className="invoice-schedule-row" key={index}>
                    <span>
                      {p.label || `${index + 1} of ${schedule.length}`}
                    </span>
                    {index === schedule.length - 1 ? (
                      <div>
                        {money(p.amountPaise / 100)}{" "}
                        <small>
                          {totalPaise
                            ? ((p.amountPaise / totalPaise) * 100).toFixed(2)
                            : "0.00"}
                          %
                        </small>
                      </div>
                    ) : (
                      <div className="invoice-schedule-amount">
                        <input
                          aria-label={`Payment ${index + 1} amount`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={p.amountPaise / 100}
                          onChange={(e) =>
                            change(
                              "paymentSchedule",
                              schedule.map((row, n) =>
                                n === index
                                  ? {
                                      ...row,
                                      amountPaise: Math.round(
                                        Number(e.target.value) * 100,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                        <label>
                          <input
                            aria-label={`Payment ${index + 1} percent`}
                            type="number"
                            min="0.01"
                            max="99.99"
                            step="0.01"
                            value={
                              totalPaise
                                ? Number(
                                    (
                                      (p.amountPaise / totalPaise) *
                                      100
                                    ).toFixed(2),
                                  )
                                : 0
                            }
                            onChange={(e) =>
                              change(
                                "paymentSchedule",
                                schedule.map((row, n) =>
                                  n === index
                                    ? {
                                        ...row,
                                        amountPaise: Math.round(
                                          (totalPaise *
                                            Number(e.target.value)) /
                                            100,
                                        ),
                                      }
                                    : row,
                                ),
                              )
                            }
                          />
                          %
                        </label>
                      </div>
                    )}
                    {index === schedule.length - 1 ? (
                      <span>{p.dueDate}</span>
                    ) : (
                      <div className="invoice-installment-date">
                        <input
                          aria-label={`Payment ${index + 1} due date`}
                          type="date"
                          min={draft.invoiceDate}
                          max={plusDays(draft.dueDate, -1)}
                          value={p.dueDate}
                          onChange={(e) =>
                            change(
                              "paymentSchedule",
                              schedule.map((row, n) =>
                                n === index
                                  ? { ...row, dueDate: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                        <select
                          aria-label={`Payment ${index + 1} due preset`}
                          value=""
                          onChange={(event) =>
                            change(
                              "paymentSchedule",
                              schedule.map((row, n) =>
                                n === index
                                  ? {
                                      ...row,
                                      dueDate: plusDays(
                                        draft.invoiceDate,
                                        Number(event.target.value),
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        >
                          <option value="" disabled>
                            Choose date
                          </option>
                          {[
                            [0, "On receipt"],
                            [7, "Within 7 days"],
                            [14, "Within 14 days"],
                            [21, "Within 21 days"],
                            [30, "Within 30 days"],
                            [90, "Within 90 days"],
                          ].map(([n, label]) => (
                            <option key={n} value={n}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {index < schedule.length - 1 && (
                      <button
                        aria-label={`Remove payment ${index + 1}`}
                        disabled={schedule.length <= 2}
                        onClick={() =>
                          change(
                            "paymentSchedule",
                            schedule.filter((_, n) => n !== index),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="invoice-text-action"
                  onClick={() => splitSchedule(schedule.length + 1)}
                  disabled={schedule.length >= 20}
                >
                  <Plus size={15} /> Add another payment
                </button>
              </div>
            )}
          </section>
          <section className="invoice-editor-section">
            <h2>Advanced options</h2>
            <div className="invoice-option">
              <strong>Accepted Payment Methods</strong>
              <div className="invoice-checkboxes">
                {["BANKING", "G-pay", "UPI"].map((method) => (
                  <label key={method}>
                    <input
                      type="checkbox"
                      checked={draft.acceptedPaymentMethods.includes(method)}
                      onChange={(e) =>
                        change(
                          "acceptedPaymentMethods",
                          e.target.checked
                            ? [...draft.acceptedPaymentMethods, method]
                            : draft.acceptedPaymentMethods.filter(
                                (x) => x !== method,
                              ),
                        )
                      }
                    />
                    {method}
                  </label>
                ))}
              </div>
              <small>
                <button
                  className="invoice-text-action"
                  onClick={() => setModal("business")}
                >
                  Edit bank and UPI details for this invoice
                </button>
              </small>
            </div>
            <Toggle
              label="Allow Tip"
              checked={draft.allowTip}
              onChange={(v) => change("allowTip", v)}
              description="Let clients know optional tips can be included when arranging payment with the studio."
            />
            <div className="invoice-fields">
              <Field label="Payment status">
                <select
                  value={draft.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {["Pending", "Paid", "Cancelled"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Payments received (₹)"
                type="number"
                min="0"
                max={totalPaise / 100}
                step="0.01"
                value={draft.advancePaid}
                onChange={(v) => change("advancePaid", Number(v))}
              />
              <Field
                label="Extra charges (₹)"
                type="number"
                min="0"
                step="0.01"
                value={draft.extraCharges}
                onChange={(v) => change("extraCharges", Number(v))}
              />
            </div>
            {draft.scheduledDelivery?.state === "scheduled" && (
              <div className="invoice-editor-notice">
                Email scheduled for{" "}
                {new Date(draft.scheduledDelivery.at).toLocaleString()}
                <button
                  onClick={async () => {
                    try {
                      await workspaceRequest(
                        "delete",
                        `/api/invoices/${id}/scheduled-delivery`,
                      );
                      setDraft((d) => ({
                        ...d,
                        scheduledDelivery: { state: "cancelled" },
                      }));
                    } catch (e) {
                      setError(recordError(e));
                    }
                  }}
                >
                  Cancel scheduled delivery
                </button>
              </div>
            )}
            {draft.scheduledDelivery?.error && (
              <p role="alert">{draft.scheduledDelivery.error}</p>
            )}
          </section>
        </div>
      </div>
      {modal === "preview" && (
        <div className="invoice-full-preview">
          <button
            className="invoice-preview-close"
            onClick={() => setModal("")}
          >
            <X size={16} /> Back to editor
          </button>
          <InvoiceDocument invoice={current} preview />
        </div>
      )}
      {[
        "business",
        "discount",
        "tax",
        "design",
        "link",
        "history",
        "cancel",
        "delete",
        "confirm-link",
        "approve",
      ].includes(modal) && (
        <OperationsModal
          title={
            {
              business: "Business details",
              discount: "Edit discount",
              tax: "Edit tax",
              design: "Edit design",
              link: "Get invoice link",
              history: "Delivery history",
              cancel: "Cancel invoice?",
              delete: "Delete draft?",
              "confirm-link": "Send via link",
              approve: "Approve and issue invoice?",
            }[modal]
          }
          onClose={() => !busy && setModal("")}
          busy={busy}
          footer={
            <>
              <button onClick={() => setModal("")} disabled={busy}>
                {["cancel", "delete", "confirm-link", "approve"].includes(modal)
                  ? "Cancel"
                  : "Close"}
              </button>
              {["cancel", "delete"].includes(modal) && (
                <button
                  className="invoice-primary"
                  disabled={busy}
                  onClick={destructive}
                >
                  Confirm
                </button>
              )}
              {modal === "approve" && (
                <button
                  className="invoice-primary"
                  disabled={busy}
                  onClick={approveInvoice}
                >
                  {busy ? "Issuing…" : "Approve & issue"}
                </button>
              )}
              {modal === "confirm-link" && (
                <button
                  className="invoice-primary"
                  disabled={busy}
                  onClick={share}
                >
                  Confirm
                </button>
              )}
              {["business", "discount", "tax", "design"].includes(modal) && (
                <button
                  className="invoice-primary"
                  onClick={() => setModal("")}
                >
                  Apply
                </button>
              )}
            </>
          }
        >
          {error && (
            <p className="invoice-editor-alert" role="alert">
              {error}
            </p>
          )}
          {modal === "approve" && (
            <p>
              Issue this reviewed invoice and publish its payment schedule and
              payment details on the client's existing project link. This action
              does not send an email.
            </p>
          )}
          {modal === "business" && (
            <>
              <p className="invoice-business-hint">
                These details are saved with this invoice. Your studio defaults
                are available in Settings.
              </p>
              <div className="invoice-fields">
                {[
                  ["name", "Business name"],
                  ["email", "Business email"],
                  ["phone", "Business phone"],
                  ["website", "Business website"],
                  ["taxId", "GSTIN / Tax ID"],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={draft.issuer?.[key]}
                    onChange={(v) =>
                      change("issuer", { ...draft.issuer, [key]: v })
                    }
                    maxLength={2000}
                  />
                ))}
              </div>
              <Field
                label="Business address"
                type="textarea"
                value={draft.issuer?.address}
                onChange={(v) =>
                  change("issuer", { ...draft.issuer, address: v })
                }
                rows={3}
                maxLength={4000}
              />
              <Field
                label="Logo image URL"
                value={draft.issuer?.logoUrl}
                onChange={(v) =>
                  change("issuer", { ...draft.issuer, logoUrl: v })
                }
                placeholder="HTTPS image URL, or leave blank for Team Alpha"
                maxLength={2000}
              />
              <Field label="Upload business logo">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 8 * 1024 * 1024) {
                      setError("Use a logo up to 8 MB.");
                      return;
                    }
                    const form = new FormData();
                    form.append("image", file);
                    setBusy(true);
                    setError("");
                    try {
                      const result = await workspaceRequest(
                        "post",
                        "/api/studio/document-covers",
                        form,
                      );
                      change("issuer", {
                        ...draft.issuer,
                        logoUrl: result.url,
                      });
                    } catch (e) {
                      setError(recordError(e));
                    } finally {
                      setBusy(false);
                      event.target.value = "";
                    }
                  }}
                />
              </Field>
              <Field
                label="Bank details"
                type="textarea"
                value={draft.issuer?.bankDetails}
                onChange={(v) =>
                  change("issuer", { ...draft.issuer, bankDetails: v })
                }
                rows={3}
                maxLength={4000}
              />
              <Field
                label="UPI ID"
                value={draft.issuer?.upiId}
                onChange={(v) =>
                  change("issuer", { ...draft.issuer, upiId: v })
                }
              />
              <Field
                label="Payment instructions"
                type="textarea"
                value={draft.issuer?.paymentInstructions}
                onChange={(v) =>
                  change("issuer", { ...draft.issuer, paymentInstructions: v })
                }
                rows={3}
                maxLength={4000}
              />
              <button
                className="invoice-text-action"
                onClick={() => change("issuer", studioIssuer(context.studio))}
              >
                Restore studio defaults
              </button>
            </>
          )}
          {modal === "discount" && (
            <>
              <div className="invoice-checkboxes">
                <label>
                  <input
                    type="radio"
                    checked={draft.discountType === "fixed"}
                    onChange={() => change("discountType", "fixed")}
                  />
                  Amount off
                </label>
                <label>
                  <input
                    type="radio"
                    checked={draft.discountType === "percent"}
                    onChange={() => change("discountType", "percent")}
                  />
                  Percent off
                </label>
              </div>
              <Field
                label={
                  draft.discountType === "fixed" ? "Amount (₹)" : "Percent (%)"
                }
                type="number"
                value={draft.discountValue}
                min="0"
                max={draft.discountType === "percent" ? 100 : subtotal / 100}
                step="0.01"
                onChange={(v) => change("discountValue", Number(v))}
              />
              <button
                className="invoice-text-action"
                onClick={() => {
                  change("discountValue", 0);
                  setModal("");
                }}
              >
                <Trash2 size={14} /> Delete discount
              </button>
            </>
          )}
          {modal === "tax" && (
            <Field
              label="Tax rate (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.taxRateBps / 100}
              onChange={(v) =>
                change("taxRateBps", Math.round(Number(v) * 100))
              }
            />
          )}
          {modal === "design" && (
            <>
              <Field label="Upload cover photo">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 8 * 1024 * 1024) {
                      setError("Use a cover photo up to 8 MB.");
                      return;
                    }
                    const form = new FormData();
                    form.append("image", file);
                    setBusy(true);
                    setError("");
                    try {
                      const result = await workspaceRequest(
                        "post",
                        "/api/studio/document-covers",
                        form,
                      );
                      change("design", {
                        ...draft.design,
                        coverUrl: result.url,
                      });
                      setNotice("Cover photo uploaded.");
                    } catch (e) {
                      setError(recordError(e));
                    } finally {
                      setBusy(false);
                      event.target.value = "";
                    }
                  }}
                />
              </Field>
              <Field
                label="Cover image URL"
                value={draft.design.coverUrl}
                onChange={(v) =>
                  change("design", { ...draft.design, coverUrl: v })
                }
                placeholder="HTTPS image or /assets/studio-wedding.webp"
              />
              <Field
                label="Accent colour"
                type="color"
                value={draft.design.accentColor}
                onChange={(v) =>
                  change("design", { ...draft.design, accentColor: v })
                }
              />
              <Field label="Font theme">
                <select
                  value={draft.design.fontFamily}
                  onChange={(e) =>
                    change("design", {
                      ...draft.design,
                      fontFamily: e.target.value,
                    })
                  }
                >
                  {["modern", "classic", "editorial"].map((font) => (
                    <option key={font}>{font}</option>
                  ))}
                </select>
              </Field>
              <label className="invoice-checkboxes">
                <input
                  type="checkbox"
                  checked={draft.design.showLogo}
                  onChange={(e) =>
                    change("design", {
                      ...draft.design,
                      showLogo: e.target.checked,
                    })
                  }
                />
                Show studio logo
              </label>
            </>
          )}
          {modal === "link" && (
            <>
              <p>Your client can access the invoice from the following link:</p>
              <input
                ref={shareInput}
                className="invoice-share-url"
                aria-label="Invoice share link"
                readOnly
                value={link}
              />
              <div className="invoice-link-actions">
                <button
                  onClick={async () => {
                    try {
                      if (!navigator.clipboard?.writeText) throw new Error();
                      await navigator.clipboard.writeText(link);
                      setNotice("Link copied to clipboard");
                    } catch {
                      shareInput.current?.focus();
                      shareInput.current?.select();
                      setNotice(
                        "Link selected. Use Copy on your device to copy it.",
                      );
                    }
                  }}
                >
                  <Copy size={15} /> Copy Link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hi ${draft.clientName}, please review your Team Alpha invoice: ${link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share on WhatsApp <ExternalLink size={14} />
                </a>
                <a href={link} target="_blank" rel="noreferrer">
                  View invoice
                </a>
              </div>
            </>
          )}
          {modal === "confirm-link" && (
            <p>
              Your invoice will be marked as sent without being automatically
              emailed. Manually share the invoice using the link on the next
              page.
            </p>
          )}
          {modal === "history" && (
            <div className="invoice-history">
              {draft.deliveries?.length ? (
                [...draft.deliveries].reverse().map((delivery, n) => (
                  <div key={n}>
                    <strong>
                      {delivery.channel} · {delivery.state}
                    </strong>
                    <small>{new Date(delivery.sentAt).toLocaleString()}</small>
                    {delivery.subject && <p>{delivery.subject}</p>}
                    {delivery.error && <p>{delivery.error}</p>}
                  </div>
                ))
              ) : (
                <p>No deliveries recorded yet.</p>
              )}
            </div>
          )}
          {modal === "cancel" && (
            <p>
              Cancel this invoice and close its client link. The invoice remains
              in studio records.
            </p>
          )}
          {modal === "delete" && (
            <p>
              Delete this unsent draft permanently? Sent, paid and
              quotation-linked invoices are retained.
            </p>
          )}
        </OperationsModal>
      )}
      {modal === "send" && (
        <div className="invoice-send-overlay">
          <section className="invoice-send-composer">
            <button className="invoice-send-close" onClick={() => setModal("")}>
              <X size={20} /> Send invoice
            </button>
            <p>
              To: <strong>{draft.clientName}</strong>
              <br />
              {draft.clientEmail ||
                "Add the client email in invoice details to email this invoice."}
            </p>
            <Field
              label="Subject"
              value={compose.subject}
              onChange={(v) => setCompose((c) => ({ ...c, subject: v }))}
              maxLength={200}
            />
            <Field
              label="Message"
              type="textarea"
              value={compose.message}
              onChange={(v) => setCompose((c) => ({ ...c, message: v }))}
              rows={12}
              maxLength={12000}
            />
            <button
              className="invoice-text-action"
              onClick={() =>
                setCompose((c) => ({
                  ...c,
                  message: `Hi ${draft.clientName.split(" ")[0]},\n\nPlease find your invoice for ${money(totalPaise / 100)}. View the invoice for the payment schedule and studio payment instructions.\n\nThank you,\n${draft.issuer?.name || "Team Alpha"}`,
                }))
              }
            >
              Insert email template
            </button>
            {compose.scheduledAt !== "" && (
              <Field
                label="Send on"
                type="datetime-local"
                value={compose.scheduledAt}
                onChange={(v) => setCompose((c) => ({ ...c, scheduledAt: v }))}
              />
            )}
            {error && <p role="alert">{error}</p>}
            <div className="invoice-send-actions">
              <button
                onClick={() =>
                  setCompose((c) => ({
                    ...c,
                    scheduledAt: c.scheduledAt
                      ? ""
                      : new Date(
                          Date.now() +
                            3600000 -
                            new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16),
                  }))
                }
              >
                Schedule
              </button>
              <button onClick={() => setModal("confirm-link")}>
                Send via link
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={compose.sendCopy}
                  onChange={(e) =>
                    setCompose((c) => ({ ...c, sendCopy: e.target.checked }))
                  }
                />
                Send me a copy
              </label>
              <button
                className="invoice-primary"
                disabled={
                  busy || !draft.clientEmail || !context.emailConfigured
                }
                onClick={send}
              >
                {busy
                  ? "Sending…"
                  : compose.scheduledAt
                    ? "Schedule email"
                    : "Send"}
              </button>
            </div>
            {!context.emailConfigured && (
              <small>
                Email delivery is not configured. Use Send via link to share
                manually.
              </small>
            )}
          </section>
          <section className="invoice-email-preview">
            <img
              src={resolveStudioImage(draft.issuer?.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)}
              alt={draft.issuer?.name || "Team Alpha"}
            />
            <div>
              <h3>Invoice {draft.documentNumber}</h3>
              <strong>{money(totalPaise / 100)}</strong>
              <p>Due by {draft.dueDate}</p>
            </div>
            <p>{compose.message}</p>
            <button>VIEW INVOICE</button>
            <small>
              {draft.issuer?.name || "TEAM ALPHA"}
              <br />
              Questions? Reply to this email.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
