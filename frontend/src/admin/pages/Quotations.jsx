import { useEffect, useRef, useState } from "react";
import { TEAM_ALPHA_LOGO } from "../../utils/branding";
import { quotationDefaults, addDocumentDays, documentCommunication, resolveStudioImage } from '../../utils/settingsDefaults';
import { API_BASE_URL } from '../../utils/apiConfig';
import { quotationStatus } from '../../utils/quotationStatus';
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  X,
  ChevronDown,
  Trash2,
  Copy,
  Pencil,
  MoveUp,
  MoveDown,
  ImagePlus,
  Printer,
  Search,
  ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { OperationsModal } from "../components/operations/OperationsUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
  rupees,
  recordDate,
} from "../components/operations/workspaceData";
import "./quotationWorkspace.css";
import "./documentWorkspaceRefinements.css";
import "./quotationList.css";
import { WorkspaceActionMenu } from "../components/operations/WorkspaceActionMenu";
const covers = [
  "/assets/banner.jpg",
  "/assets/services/wedding.jpg",
  "/assets/services/pre_wedding.jpg",
  "/assets/services/engagement.jpg",
  "/assets/services/haldi.jpg",
  "/assets/studio-wedding.webp",
  "/assets/studio-pre-wedding.webp",
];
const blankItem = () => ({
  title: "Photography coverage",
  description: "",
  quantity: 1,
  unitPricePaise: 0,
});
const dateOnly = (d) => new Date(d).toISOString().slice(0, 10);
const quoteNumber = (q) =>
  q.documentNumber || q._id?.slice(-6).toUpperCase() || "New";
const quoteFilters = ["All", "Draft", "Open", "Accepted", "Expired", "Declined", "Cancelled", "Archived"];
const defaultForm = (settings) => ({
  clientName: "",
  email: "",
  lead: "",
  contactId: "",
  studioProjectId: "",
  title: "Wedding photography & cinematography",
  documentNumber: "",
  issueDate: dateOnly(Date.now()),
  validUntil: dateOnly(Date.now() + (settings.quotationValidityDays ?? 14) * 86400000),
  status: "Draft",
  items: [blankItem()],
  discountType: "amount",
  discountValue: 0,
  discountPaise: 0,
  taxRateBps: 0,
  terms: settings.quotationTerms || "",
  notes: settings.defaultDeliverables || "",
  autoCreateInvoice: true,
  expiryEnabled: true,
  remindersEnabled: false,
  reminderDays: [3, 7, 14, 21, 30],
  ...quotationDefaults(settings),
  design: {
    coverImage: settings.coverImage || covers[0],
    colorTheme: settings.colorTheme || "#202622",
    fontTheme: settings.fontTheme || "modern",
  },
});
const normalize = (q) => ({
  ...q,
  issueDate: dateOnly(q.issueDate || q.createdAt || Date.now()),
  validUntil: q.validUntil ? dateOnly(q.validUntil) : "",
  lead: q.lead?._id || q.lead || "",
  contactId: q.contactId?._id || q.contactId || "",
  studioProjectId: q.studioProjectId?._id || q.studioProjectId || "",
  discountType: q.discountType || "amount",
  discountValue: q.discountValue ?? q.discountPaise / 100,
  items: q.items.map((i) => ({
    ...i,
    title: i.title || i.description.split("\n")[0],
    description: i.title
      ? i.description
      : i.description.split("\n").slice(1).join("\n"),
  })),
  autoCreateInvoice: q.autoCreateInvoice !== false,
  expiryEnabled: q.expiryEnabled !== false,
  reminderDays: q.reminderDays || [3, 7, 14, 21, 30],
  design: q.design || {
    coverImage: covers[0],
    colorTheme: "#202622",
    fontTheme: "modern",
  },
});
function Field({ label, children }) {
  return (
    <label className="qw-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Toggle({ label, checked, onChange, help }) {
  return (
    <div className="qw-setting">
      <strong>{label}</strong>
      <label className="qw-toggle studio-switch-control">
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="studio-switch-track" aria-hidden="true" />
        {checked ? "On" : "Off"}
      </label>
      {help && <p>{help}</p>}
    </div>
  );
}
export default function Quotations() {
  const [searchParams, setSearchParams] = useSearchParams(),
    location = useLocation();
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/quotations",
    "/api/leads",
    "/api/studio/settings",
    "/api/studio/quote-templates",
    "/api/contacts",
    "/api/studio-projects",
  ]);
  const [
    quotes = [],
    leads = [],
    settings = {},
    templates = [],
    contacts = [],
    projects = [],
  ] = data;
  const [filter, setFilter] = useState("All"),
    [search, setSearch] = useState(""),
    [current, setCurrent] = useState(null),
    [form, setForm] = useState({}),
    [mode, setMode] = useState("list"),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [dirty, setDirty] = useState(false),
    [savedAt, setSavedAt] = useState(""),
    [actionMenu, setActionMenu] = useState(false),
    [designOpen, setDesignOpen] = useState(false),
    [modal, setModal] = useState(""),
    [modalValue, setModalValue] = useState(""),
    [shareUrl, setShareUrl] = useState(""),
    [discount, setDiscount] = useState({ type: "amount", value: 0 }),
    [email, setEmail] = useState({
      subject: "",
      message: "",
      sendCopy: true,
      scheduledFor: "",
    }),
    [history, setHistory] = useState([]),
    [clock, setClock] = useState(() => Date.now());
  const formRef = useRef(form),
    currentRef = useRef(current),
    saveRef = useRef(null),
    timerRef = useRef(null),
    versionRef = useRef(0),
    prefilled = useRef(""),
    generationRef = useRef(0),
    lastSavedVersion = useRef(-1);
  useEffect(() => {
    const documentGeneration = generationRef;
    const t = setInterval(() => setClock(Date.now()), 60000);
    return () => {
      documentGeneration.current++;
      clearInterval(t);
      clearTimeout(timerRef.current);
    };
  }, []);
  const loadQuote = (q) => {
    versionRef.current++;
    lastSavedVersion.current = versionRef.current;
    generationRef.current++;
    clearTimeout(timerRef.current);
    setCurrent(q);
    currentRef.current = q;
    const f = normalize(q);
    formRef.current = f;
    setForm(f);
    setMode(q.status === "Accepted" ? "detail" : "editor");
    setDirty(false);
    setSaveError("");
    setSavedAt("All changes saved");
    setBusy(false);
  };
  const saveDraft = async () => {
    const invocation = generationRef.current;
    const stale = () => Object.assign(new Error("This quotation is no longer open."), { cancelled: true });
    clearTimeout(timerRef.current);
    // All callers wait on the full save, including revision and identity updates.
    // A second waiter rechecks the lock before starting its own write.
    while (saveRef.current) {
      const pending = saveRef.current;
      try { await pending.promise; }
      catch (error) { if (pending.generation === invocation) throw error; }
      if (generationRef.current !== invocation) throw stale();
    }
    if (generationRef.current !== invocation) throw stale();
    if (versionRef.current === lastSavedVersion.current && currentRef.current)
      return currentRef.current;
    const snapshot = formRef.current, record = currentRef.current;
    const version = versionRef.current, generation = generationRef.current;
    if (!snapshot.clientName?.trim() || !snapshot.email?.trim() || !snapshot.items?.length ||
        snapshot.items.some(i => !i.title?.trim() && !i.description?.trim())) {
      const error = new Error("Complete the client name, email and quotation items before continuing.");
      setSaveError(error.message);
      throw error;
    }
    setBusy(true);
    setSaveError("");
    const promise = (async () => {
      try {
        const result = await workspaceRequest(record ? "put" : "post",
          `/api/studio/quotations${record ? "/" + record._id : ""}`,
          { ...snapshot, status: snapshot.status === "Sent" ? "Draft" : snapshot.status, revision: record?.revision });
        if (generation !== generationRef.current) throw stale();
        lastSavedVersion.current = version;
        if (!record) {
          prefilled.current = "?quote=" + encodeURIComponent(result._id);
          setSearchParams({ quote: result._id }, { replace: true });
        }
        setCurrent(result);
        currentRef.current = result;
        if (version === versionRef.current) {
          const next = normalize(result);
          setForm(next); formRef.current = next;
          setDirty(false); setSavedAt("All changes saved");
        } else if (formRef.current.contactId === snapshot.contactId && formRef.current.studioProjectId === snapshot.studioProjectId && !formRef.current.lead) {
          const next = { ...formRef.current, lead: result.lead?._id || result.lead || "" };
          formRef.current = next; setForm(next);
        }
        reload();
        return result;
      } catch (error) {
        if (generation === generationRef.current && !error.cancelled) setSaveError(recordError(error));
        throw error;
      } finally {
        if (saveRef.current?.promise === promise) saveRef.current = null;
        if (generation === generationRef.current) setBusy(false);
      }
    })();
    saveRef.current = { promise, generation, version };
    const result = await promise;
    if (generation === generationRef.current && versionRef.current !== lastSavedVersion.current) return saveDraft();
    return result;
  };
  const change = (name, value) => {
    const next = { ...formRef.current, [name]: value };
    formRef.current = next;
    setForm(next);
    versionRef.current++;
    setDirty(true);
    setSavedAt("Unsaved changes");
    clearTimeout(timerRef.current);
    if (currentRef.current && currentRef.current.status !== "Accepted")
      timerRef.current = setTimeout(() => {
        saveDraft().catch(() => {});
      }, 1100);
  };
  const setDraft = (value) => {
    setBusy(false);
    versionRef.current++;
    lastSavedVersion.current = -1;
    generationRef.current++;
    clearTimeout(timerRef.current);
    currentRef.current = null;
    setCurrent(null);
    formRef.current = value;
    setForm(value);
    setDirty(true);
    setMode("editor");
    setStep(0);
    setSaveError("");
    setSavedAt("Unsaved changes");
  };

  const status = (quote) => quotationStatus(quote, clock);
  const subtotal = (form.items || []).reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unitPricePaise),
    0,
  );
  const discountPaise =
    form.discountType === "percent"
      ? Math.round((subtotal * Number(form.discountValue || 0)) / 100)
      : Math.round(Number(form.discountValue || 0) * 100);
  const tax = Math.round(
      ((subtotal - discountPaise) * Number(form.taxRateBps || 0)) / 10000,
    ),
    total = subtotal - discountPaise + tax;
  const close = () => {
    if (dirty) {
      setModal("leave");
      return;
    }
    generationRef.current++;
    clearTimeout(timerRef.current);
    setMode("list");
    setCurrent(null);
    currentRef.current = null;
    setActionMenu(false);
    setSearchParams({});
  };
  const updateItem = (index, patch) =>
    change(
      "items",
      form.items.map((i, n) => (n === index ? { ...i, ...patch } : i)),
    );
  const reorder = (index, offset) => {
    const a = [...form.items];
    [a[index], a[index + offset]] = [a[index + offset], a[index]];
    change("items", a);
  };
  const act = async (action) => {
    const generation = generationRef.current;
    setBusy(true);
    setSaveError("");
    try {
      let q = currentRef.current;
      if (dirty || !q) q = await saveDraft();
      if (generation !== generationRef.current) return;
      if (!q) throw Error("Complete the client and item fields first.");
      const result = await workspaceRequest(
        "post",
        `/api/studio/quotations/${q._id}/${action}`,
        {},
      );
      if (generation !== generationRef.current) return;
      if (action === "duplicate") {
        loadQuote(result);
        toast.success("Quotation duplicated");
      } else if (action === "share") {
        setCurrent(result.quote);
        currentRef.current = result.quote;
        setShareUrl(`${window.location.origin}/quote/${result.token}`);
        setMode("detail");
        setModal("link");
      } else {
        setMode("list");
        setCurrent(null);
        currentRef.current = null;
        toast.success(
          action === "cancel" ? "Quote cancelled" : "Quote archived",
        );
      }
      reload();
      setActionMenu(false);
    } catch (e) {
      if (generation === generationRef.current && !e.cancelled) setSaveError(recordError(e));
    } finally {
      if (generation === generationRef.current) setBusy(false);
    }
  };
  const preview = async () => {
    const generation = generationRef.current;
    try {
      const q =
        dirty || !currentRef.current ? await saveDraft() : currentRef.current;
      if (q && generation === generationRef.current)
        window.open(`/quote-preview/${q._id}`, "_blank", "noopener,noreferrer");
    } catch {
      /* inline error */
    }
  };
  const prepareSend = async () => {
    const generation = generationRef.current;
    try {
      const q =
        dirty || !currentRef.current ? await saveDraft() : currentRef.current;
      if (!q || generation !== generationRef.current) return;
      setCurrent(q);
      setEmail({
        ...documentCommunication(settings, 'quote', q),
        sendCopy: true,
        scheduledFor: "",
        idempotencyKey: crypto.randomUUID(),
      });
      setMode("send");
    } catch {
      /* inline error */
    }
  };
  const send = async (schedule) => {
    setBusy(true);
    setSaveError("");
    try {
      const response = await workspaceRequest(
        "post",
        `/api/studio/quotations/${current._id}/${schedule ? "schedule" : "email"}`,
        {
          ...email,
          ...(schedule
            ? { scheduledFor: new Date(email.scheduledFor).toISOString() }
            : {}),
        },
      );
      if (schedule) toast.success("Quote scheduled");
      else if (response.delivery?.status === "sent")
        toast.success("Quote email sent");
      else toast("Delivery is pending. Check Email history before resending.");
      setMode("list");
      reload();
    } catch (e) {
      setSaveError(recordError(e));
    } finally {
      setBusy(false);
    }
  };
  const manageClientLink = async regenerate => {
    if (!current?._id || busy) return;
    if (dirty) { setSaveError('Save and share the revised quote before managing its client link.'); return; }
    setBusy(true);
    try {
      const result = await workspaceRequest(regenerate ? 'post' : 'delete', `/api/studio/quotations/${current._id}/share${regenerate ? '/regenerate' : ''}`, {});
      if (result.quote) loadQuote(result.quote);
      if (regenerate) { setShareUrl(`${window.location.origin}/quote/${result.token}`); setModal('link'); }
      toast.success(regenerate ? 'New link created with current studio visibility settings. Previous copies no longer work.' : 'Client link revoked');
      reload();
    } catch (error) { setSaveError(recordError(error)); }
    finally { setBusy(false); setActionMenu(false); }
  };
  const actionItems = () => (
    <>
      {!current?.acceptedAt && current?.status !== "Accepted" && (
        <button
          onClick={() => {
            setModalValue(form.documentNumber || quoteNumber(current || {}));
            setModal("number");
            setActionMenu(false);
          }}
        >
          Edit quote number
        </button>
      )}
      <button
        onClick={() => {
          setModalValue(form.title);
          setModal("template");
          setActionMenu(false);
        }}
      >
        Save as template
      </button>
      <button
        onClick={() => {
          setModalValue(form.studioProjectId || "");
          setModal("project");
          setActionMenu(false);
        }}
      >
        Link to project
      </button>
      <button onClick={() => act("duplicate")}>Duplicate</button>
      {['Sent', 'Accepted'].includes(current?.status) && <>
        <button onClick={() => manageClientLink(false)}>Revoke client link</button>
        <button onClick={() => manageClientLink(true)}>Regenerate client link</button>
      </>}
      {!current?.acceptedAt && current?.status !== "Accepted" && (
        <button
          onClick={() => {
            setModal("cancel");
            setActionMenu(false);
          }}
        >
          Cancel quote
        </button>
      )}
      <button
        onClick={() => {
          setModal("archive");
          setActionMenu(false);
        }}
      >
        Delete
      </button>
      <button
        onClick={async () => {
          try {
            await workspaceRequest(
              "delete",
              `/api/studio/quotations/${current._id}/schedule`,
            );
            toast.success("Scheduled sending cancelled");
          } catch (e) {
            setSaveError(recordError(e));
          }
          setActionMenu(false);
        }}
      >
        Cancel scheduled sending
      </button>
      <button
        onClick={async () => {
          try {
            setHistory(
              await workspaceRequest(
                "get",
                `/api/studio/quotations/${current._id}/email-history`,
              ),
            );
            setModal("history");
          } catch (e) {
            setSaveError(recordError(e));
          }
          setActionMenu(false);
        }}
      >
        Email history
      </button>
    </>
  );
  const applyTemplate = (t) => {
    lastSavedVersion.current = -1;
    const f = {
      ...formRef.current,
      title: t.title,
      items: t.items.map((i) => ({
        ...i,
        title: i.title || i.description,
        description: i.title ? i.description : "",
      })),
      discountType: t.discountType || "amount",
      discountValue: t.discountValue ?? t.discountPaise / 100,
      taxRateBps: t.taxRateBps,
      terms: t.terms,
      notes: t.notes || "",
      autoCreateInvoice: t.autoCreateInvoice !== false,
      expiryEnabled: t.expiryEnabled !== false,
      remindersEnabled: !!t.remindersEnabled,
      reminderDays: t.reminderDays || [3, 7, 14, 21, 30],
      design: t.design || formRef.current.design,
      validUntil: addDocumentDays(quotationDefaults(settings, clock).issueDate, t.validityDays ?? settings.quotationValidityDays ?? 14),
    };
    setDraft(f);
  };
  useEffect(() => {
    const signature = location.search;
    if (
      !signature ||
      prefilled.current === signature ||
      loading ||
      !data.length
    )
      return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      prefilled.current = signature;
      if (searchParams.get("quote") === currentRef.current?._id) return;
      const quote = quotes.find((q) => q._id === searchParams.get("quote"));
      if (quote) {
        loadQuote(quote);
        return;
      }
      const template = templates.find(
        (t) => t._id === searchParams.get("template"),
      );
      if (template) {
        formRef.current = defaultForm(settings);
        applyTemplate(template);
        setMode("wizard");
        setStep(1);
        return;
      }
      const contact = contacts.find(
        (c) => c._id === searchParams.get("contact"),
      );
      if (contact) {
        const f = {
          ...defaultForm(settings),
          clientName: [contact.firstName, contact.lastName]
            .filter(Boolean)
            .join(" "),
          email: contact.email,
          contactId: contact._id,
          studioProjectId: searchParams.get("project") || "",
        };
        setDraft(f);
        setMode("wizard");
        setStep(0);
      }
    });
    return () => {
      active = false;
    };
    // Query-driven navigation initializes a specific document only after its records load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, location.search]);
  const visible = quotes.filter(
    (q) =>
      (filter === "All" || status(q) === filter) &&
      [q.clientName, q.documentNumber, q.title]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const startNewQuote = () => {
    setDraft(defaultForm(settings));
    setMode("wizard");
  };
  const openListQuote = quote => {
    loadQuote(quote);
    setMode(quote.status === "Draft" ? "editor" : "detail");
  };
  return (
    <div className={'qw-page' + (mode === 'list' ? ' qw-list-workspace' : '')}>
      {mode === "list" && (
        <>
          <header className="qw-list-header">
            <div><h1>Quotations</h1><p>Create proposals and follow every client decision.</p></div>
            <div className="qw-list-actions">
              <Link className="studio-button" to="/admin/quote-templates"><Copy size={15} />Templates</Link>
              <button className="studio-button primary" onClick={startNewQuote}><Plus size={16} />New quote</button>
            </div>
          </header>
          <section className="qw-list-panel" aria-label="Quotation list">
            <div className="qw-list-toolbar">
              <label className="studio-search qw-list-search"><Search size={17} aria-hidden="true" /><input aria-label="Search quotes" placeholder="Search quote or client name" value={search} onChange={event => setSearch(event.target.value)} /></label>
              <label className="qw-list-status-filter"><span>Status</span><select className="studio-input" aria-label="Quote status" value={filter} onChange={event => setFilter(event.target.value)}>{quoteFilters.map(value => <option key={value}>{value}</option>)}</select></label>
              <span className="qw-list-count" role="status">{error ? 'Unavailable' : loading ? 'Loading…' : `${visible.length} of ${quotes.length} quotes`}</span>
            </div>
            <div className="qw-list-filters" role="group" aria-label="Filter quotations by status">{quoteFilters.map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
            {error ? <div className="studio-error" role="alert"><span>{error}</span><button className="studio-button small" onClick={reload}>Retry</button></div> : loading ? <div className="qw-list-empty" role="status"><span className="studio-loader" />Loading quotations…</div> : visible.length ? <>
              <div className="qw-list-columns" aria-hidden="true"><span>Quote</span><div className="qw-quote-metadata"><span>Client</span><span>Amount</span><span>Expires</span><span>Status</span></div><span /></div>
              <div className="qw-quote-records">{visible.map(quote => <article className="qw-quote-row" key={quote._id} aria-labelledby={'quote-list-' + quote._id}>
                <div className="qw-quote-description"><h2 id={'quote-list-' + quote._id}><button className="qw-quote-title" onClick={() => openListQuote(quote)}>Quote #{quoteNumber(quote)}</button></h2><p>{quote.title}</p></div>
                <dl className="qw-quote-metadata">
                  <div><dt>Client</dt><dd>{quote.clientName || 'Client to be confirmed'}</dd></div>
                  <div className="qw-quote-amount"><dt>Amount</dt><dd>{rupees(quote.totalPaise / 100)}</dd></div>
                  <div><dt>Expires</dt><dd>{quote.expiryEnabled === false ? 'No expiry' : recordDate(quote.validUntil)}</dd></div>
                  <div><dt>Status</dt><dd><span className="qw-badge" data-status={status(quote).toLowerCase()}>{status(quote)}</span></dd></div>
                </dl>
                <button className="studio-icon-button qw-quote-open" aria-label={'Open quote ' + quote.clientName} onClick={() => openListQuote(quote)}><ArrowUpRight size={18} /></button>
              </article>)}</div>
            </> : <div className="qw-list-empty" role="status"><h2>{search.trim() || filter !== 'All' ? 'No matching quotations' : 'Your next proposal starts here'}</h2><p>{search.trim() || filter !== 'All' ? 'Try another client name or choose a different status.' : 'Create a quotation to start a new client conversation.'}</p>{search.trim() || filter !== 'All' ? <button className="studio-button" onClick={() => { setSearch(''); setFilter('All'); }}>Reset filters</button> : <button className="studio-button primary" onClick={startNewQuote}><Plus size={16} />New quote</button>}</div>}
          </section>
        </>
      )}
      {mode === "wizard" && (
        <div className="qw-fullscreen">
          <header className="qw-doc-header">
            <button
              onClick={() => {
                setDirty(false);
                setMode("list");
              }}
            >
              <X size={18} /> New Quote
            </button>
          </header>
          <div className="qw-wizard">
            <h1>
              {step === 0
                ? "How would you like to start?"
                : "Who’s this new Quote for?"}
            </h1>
            {step === 0 ? (
              <>
                <button
                  className="qw-template-choice"
                  onClick={() => {
                    setStep(1);
                  }}
                >
                  <Plus size={18} /> Blank quote
                </button>
                <p>Start with a template</p>
                {templates.map((t) => (
                  <button
                    className="qw-template-choice"
                    key={t._id}
                    onClick={() => {
                      applyTemplate(t);
                      setMode("wizard");
                      setStep(1);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
                {!templates.length && (
                  <p>
                    No templates saved yet. Prepare a blank quote, then use
                    Save as template.
                  </p>
                )}
              </>
            ) : (
              <>
                <Field label="Client">
                  <select
                    value={form.contactId || form.lead || ""}
                    onChange={(e) => {
                      const c = contacts.find((c) => c._id === e.target.value),
                        l = leads.find((l) => l._id === e.target.value);
                      if (c) {
                        if (form.contactId !== c._id) {
                          const linked = projects.filter(p => String(p.contactId?._id || p.contactId) === c._id);
                          change("studioProjectId", linked.length === 1 ? linked[0]._id : "");
                        }
                        change("lead", "");
                        change("contactId", c._id);
                        change(
                          "clientName",
                          [c.firstName, c.lastName].filter(Boolean).join(" "),
                        );
                        change("email", c.email);
                      } else if (l) {
                        change("contactId", l.contactId?._id || l.contactId || "");
                        change("studioProjectId", l.studioProjectId?._id || l.studioProjectId || "");
                        change("lead", l._id);
                        change("clientName", l.name);
                        change("email", l.email);
                      }
                    }}
                  >
                    <option value="">Select contact or enquiry</option>
                    <optgroup label="Contacts">
                      {contacts.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Enquiries">
                      {leads.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
                {form.contactId && <Field label="Project">
                  <select value={form.studioProjectId || ""} onChange={e => change("studioProjectId", e.target.value)}>
                    <option value="">Select a project</option>
                    {projects.filter(p => String(p.contactId?._id || p.contactId) === form.contactId).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <small>Link a project to keep this quote visible in its enquiry.</small>
                </Field>}
                <Field label="Client name">
                  <input
                    value={form.clientName}
                    onChange={(e) => change("clientName", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => change("email", e.target.value)}
                    required
                  />
                </Field>
                <button
                  className="qw-primary"
                  disabled={!form.clientName || !form.email}
                  onClick={async () => {
                    setMode("editor");
                    try {
                      await saveDraft();
                    } catch {
                      /* inline */
                    }
                  }}
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {(mode === "editor" || mode === "detail") && (
        <div className="qw-fullscreen">
          <header className="qw-doc-header">
            <button aria-label="Back to quotes" onClick={close}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <strong>Quote #{quoteNumber(current || {})}</strong>
              <button
                aria-label="Edit quote number"
                disabled={
                  !!current?.acceptedAt || current?.status === "Accepted"
                }
                onClick={() => {
                  setModalValue(form.documentNumber || "");
                  setModal("number");
                }}
              >
                <Pencil size={12} />
              </button>
              <small>
                {form.studioProjectId ? (
                  <Link to={`/admin/studio-projects/${form.studioProjectId}`}>
                    Linked project ↗
                  </Link>
                ) : (
                  form.title
                )}
              </small>
            </div>
            <span className="qw-badge">
              {status(current || { status: "Draft" })}
            </span>
            <span className="qw-save-state">{busy ? "Saving…" : savedAt}</span>
            <div className="qw-header-actions">
              <WorkspaceActionMenu label="Actions" className="qw-menu" menuClassName="qw-dropdown" open={actionMenu} onOpenChange={setActionMenu} disabled={busy}>
                {actionItems()}
              </WorkspaceActionMenu>
              {mode === "editor" ? (
                <>
                  <button onClick={() => setDesignOpen(!designOpen)}>
                    Edit design
                  </button>
                  <button onClick={preview}>Preview</button>
                  <button
                    onClick={() => saveDraft().catch(() => {})}
                    disabled={busy}
                  >
                    Save
                  </button>
                  <button
                    className="qw-primary"
                    disabled={busy}
                    onClick={prepareSend}
                  >
                    Send quote
                  </button>
                </>
              ) : (
                <>
                  {!current?.acceptedAt && current?.status !== "Accepted" && (
                    <button
                      onClick={() => {
                        if (["Cancelled", "Declined"].includes(form.status))
                          change("status", "Draft");
                        setMode("editor");
                      }}
                    >
                      Edit quote
                    </button>
                  )}
                  <button onClick={preview}>View quote</button>
                  {current?.invoiceId ? (
                    <Link
                      className="qw-primary"
                      to={`/admin/invoices/${current.invoiceId}`}
                    >
                      View invoice
                    </Link>
                  ) : (
                    <button className="qw-primary" onClick={() => act("share")}>
                      Share
                    </button>
                  )}
                </>
              )}
            </div>
          </header>
          {saveError && (
            <p className="qw-error" role="alert">
              {saveError}
            </p>
          )}
          {mode === "editor" ? (
            <div className="qw-editor">
              <aside className="qw-settings">
                <h3>Client</h3>
                <div className="qw-client">
                  <span>{form.clientName?.[0]}</span>
                  <div>
                    <strong>{form.clientName}</strong>
                    <small>{form.email}</small>
                  </div>
                  <button
                    aria-label="Change client"
                    onClick={() => {
                      setMode("wizard");
                      setStep(1);
                    }}
                  >
                    •••
                  </button>
                </div>
                <h3>Settings</h3>
                <Toggle
                  label="Auto create invoice"
                  checked={form.autoCreateInvoice}
                  onChange={(v) => change("autoCreateInvoice", v)}
                  help="Automatically generate a draft invoice once the quote is accepted."
                />
                <Toggle
                  label="Document Expiry"
                  checked={form.expiryEnabled}
                  onChange={(v) => change("expiryEnabled", v)}
                />
                {form.expiryEnabled && (
                  <>
                    <input
                      aria-label="Quote expiry date"
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => change("validUntil", e.target.value)}
                    />
                    <p>
                      This document cannot be accepted after{" "}
                      {recordDate(form.validUntil)}. Expiry is at 11:59 PM IST.
                    </p>
                  </>
                )}
                <Toggle
                  label="Document Reminders"
                  checked={form.remindersEnabled}
                  onChange={(v) => change("remindersEnabled", v)}
                />
                {form.remindersEnabled && (
                  <div className="qw-check-list">
                    {[...new Set([3, 7, 14, 21, 30, ...(form.reminderDays || [])])].sort((a, b) => a - b).map((day) => (
                      <label key={day}>
                        <input
                          type="checkbox"
                          checked={form.reminderDays.includes(day)}
                          onChange={(e) =>
                            change(
                              "reminderDays",
                              e.target.checked
                                ? [...form.reminderDays, day]
                                : form.reminderDays.filter((d) => d !== day),
                            )
                          }
                        />
                        {day} days after sending
                      </label>
                    ))}
                    <p>
                      Automatically email contacts who have not accepted.
                      Requires configured studio email.
                    </p>
                  </div>
                )}
                <Field label="Currency">
                  <select value="INR" onChange={() => {}}>
                    <option value="INR">INR · Indian Rupee</option>
                  </select>
                </Field>
                <Field label="Quote date">
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => change("issueDate", e.target.value)}
                  />
                </Field>
              </aside>
              <section className="qw-editor-scroll">
                <div className="qw-paper">
                  <Field label="Proposal title">
                    <input
                      className="qw-title"
                      value={form.title}
                      onChange={(e) => change("title", e.target.value)}
                    />
                  </Field>
                  <h2>Items</h2>
                  <div className="qw-item-labels">
                    <span>ITEMS</span>
                    <span>QTY</span>
                    <span>PRICE</span>
                    <span>AMOUNT</span>
                  </div>
                  {form.items?.map((item, index) => (
                    <div className="qw-item" key={index}>
                      <div className="qw-item-copy">
                        <input
                          aria-label={`Item title ${index + 1}`}
                          value={item.title}
                          onChange={(e) =>
                            updateItem(index, { title: e.target.value })
                          }
                          maxLength={300}
                        />
                        <textarea
                          aria-label={`Item description ${index + 1}`}
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, { description: e.target.value })
                          }
                          rows={Math.max(
                            3,
                            Math.min(
                              10,
                              item.description?.split("\n").length || 3,
                            ),
                          )}
                          maxLength={4000}
                        />
                      </div>
                      <input
                        aria-label={`Quantity ${index + 1}`}
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        aria-label={`Price ${index + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPricePaise / 100}
                        onChange={(e) =>
                          updateItem(index, {
                            unitPricePaise: Math.round(
                              Number(e.target.value) * 100,
                            ),
                          })
                        }
                      />
                      <strong>
                        {rupees((item.quantity * item.unitPricePaise) / 100)}
                      </strong>
                      <div className="qw-item-tools">
                        <button
                          aria-label={`Move item ${index + 1} up`}
                          disabled={index === 0}
                          onClick={() => reorder(index, -1)}
                        >
                          <MoveUp size={12} />
                        </button>
                        <button
                          aria-label={`Move item ${index + 1} down`}
                          disabled={index === form.items.length - 1}
                          onClick={() => reorder(index, 1)}
                        >
                          <MoveDown size={12} />
                        </button>
                        <button
                          aria-label={`Duplicate item ${index + 1}`}
                          disabled={form.items.length >= 40}
                          onClick={() =>
                            change("items", [
                              ...form.items.slice(0, index + 1),
                              { ...item },
                              ...form.items.slice(index + 1),
                            ])
                          }
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          aria-label={`Delete item ${index + 1}`}
                          disabled={form.items.length === 1}
                          onClick={() =>
                            change(
                              "items",
                              form.items.filter((_, n) => n !== index),
                            )
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="qw-total-area">
                    <button
                      className="qw-text-button"
                      disabled={form.items?.length >= 40}
                      onClick={() =>
                        change("items", [...form.items, blankItem()])
                      }
                    >
                      + Add Item
                    </button>
                    <dl>
                      <dt>Subtotal</dt>
                      <dd>{rupees(subtotal / 100)}</dd>
                      <dt>
                        <button
                          onClick={() => {
                            setDiscount({
                              type: form.discountType,
                              value: form.discountValue,
                            });
                            setModal("discount");
                          }}
                        >
                          {discountPaise ? "Discount" : "Add discount"}
                        </button>
                      </dt>
                      <dd>
                        {discountPaise
                          ? `− ${rupees(discountPaise / 100)}`
                          : ""}
                      </dd>
                      <dt>
                        <button
                          onClick={() => {
                            setModalValue(form.taxRateBps / 100);
                            setModal("tax");
                          }}
                        >
                          {form.taxRateBps ? "Tax" : "Add tax"}
                        </button>
                      </dt>
                      <dd>{tax ? rupees(tax / 100) : ""}</dd>
                      <dt>Total</dt>
                      <dd>
                        <strong>{rupees(total / 100)}</strong>
                      </dd>
                    </dl>
                  </div>
                  <Field label="Notes">
                    <textarea
                      value={form.notes || ""}
                      onChange={(e) => change("notes", e.target.value)}
                      rows={5}
                    />
                  </Field>
                  <Field label="Terms & conditions">
                    <textarea
                      value={form.terms || ""}
                      onChange={(e) => change("terms", e.target.value)}
                      rows={5}
                    />
                  </Field>
                </div>
              </section>
            </div>
          ) : (
            <section className="qw-detail">
              <div className="qw-detail-summary">
                <div>
                  <span>Quote to</span>
                  <strong>{form.clientName}</strong>
                </div>
                <div>
                  <span>Quote Amount</span>
                  <strong>{rupees(current.totalPaise / 100)}</strong>
                </div>
              </div>
              <h2>Quote Details</h2>
              <div className="qw-detail-meta">
                <div>
                  Client<strong>{form.clientName}</strong>
                </div>
                <div>
                  Project
                  <strong>
                    {form.studioProjectId ? (
                      <Link
                        to={`/admin/studio-projects/${form.studioProjectId}`}
                      >
                        View project
                      </Link>
                    ) : (
                      "None"
                    )}
                  </strong>
                </div>
                <div>
                  Invoice
                  <strong>
                    {current.invoiceId ? (
                      <Link to={`/admin/invoices/${current.invoiceId}`}>
                        {String(current.invoiceId).slice(-6).toUpperCase()}
                      </Link>
                    ) : (
                      "None"
                    )}
                  </strong>
                </div>
                <div>
                  Quote number<strong>{quoteNumber(current)}</strong>
                </div>
                <div>
                  Quote date<strong>{recordDate(form.issueDate)}</strong>
                </div>
                <div>
                  Document expiry
                  <strong>
                    {form.expiryEnabled ? recordDate(form.validUntil) : "Off"}
                  </strong>
                </div>
                <div>
                  Reminders
                  <strong>{form.remindersEnabled ? "On" : "Off"}</strong>
                </div>
              </div>
              <div className="qw-read-paper">
                <QuoteReadDocument quote={current} settings={settings} />
              </div>
              <h2>Timeline</h2>
              <div className="qw-timeline">
                {(current.timeline?.length
                  ? current.timeline
                  : [
                      {
                        message: "Draft quote created.",
                        at: current.createdAt,
                      },
                      ...(current.sharedAt
                        ? [
                            {
                              message: "Quote finalized and shared.",
                              at: current.sharedAt,
                            },
                          ]
                        : []),
                      ...(current.acceptedAt
                        ? [
                            {
                              message: `Quote accepted by ${current.acceptedBy}.`,
                              at: current.acceptedAt,
                            },
                          ]
                        : []),
                    ]
                )
                  .slice()
                  .reverse()
                  .map((event, i) => (
                    <p key={i}>
                      <i />
                      {event.message || event.action}
                      <small>
                        {new Date(event.at || event.createdAt).toLocaleString(
                          "en-IN",
                        )}
                      </small>
                    </p>
                  ))}
              </div>
            </section>
          )}
          {designOpen && (
            <aside className="qw-design">
              <header>
                <h2>Edit design</h2>
                <button
                  aria-label="Close design"
                  onClick={() => setDesignOpen(false)}
                >
                  <X size={16} />
                </button>
              </header>
              <strong>Cover Image</strong>
              <button
                className="qw-text-button"
                onClick={() => {
                  setModalValue("");
                  setModal("photo");
                }}
              >
                <ImagePlus size={14} /> Add photo
              </button>
              <div className="qw-cover-grid">
                {covers.map((src) => (
                  <button
                    className={form.design?.coverImage === src ? "active" : ""}
                    key={src}
                    onClick={() =>
                      change("design", { ...form.design, coverImage: src })
                    }
                  >
                    <img src={src} alt="Document cover option" />
                  </button>
                ))}
              </div>
              <p>
                Select a unique cover image for this document. Set default
                cover, color and font in{" "}
                <Link to="/admin/settings">Settings → Branding</Link>.
              </p>
              <Field label="Color theme">
                <input
                  type="color"
                  value={form.design?.colorTheme || "#202622"}
                  onChange={(e) =>
                    change("design", {
                      ...form.design,
                      colorTheme: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Font theme">
                <select
                  value={form.design?.fontTheme || "modern"}
                  onChange={(e) =>
                    change("design", {
                      ...form.design,
                      fontTheme: e.target.value,
                    })
                  }
                >
                  {["modern", "classic", "editorial"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <h3>Preview</h3>
              <img
                className="qw-cover-preview"
                src={form.design?.coverImage || covers[0]}
                alt="Selected quotation cover"
              />
              <button className="qw-primary" onClick={preview}>
                Preview Quote
              </button>
            </aside>
          )}
        </div>
      )}
      {mode === "send" && (
        <div className="qw-fullscreen">
          <header className="qw-doc-header">
            <button onClick={() => setMode("editor")}>
              <X size={16} /> Send quote
            </button>
          </header>
          <div className="qw-send">
            <section>
              <p>
                To: <strong>{current.clientName}</strong> · {current.email}
              </p>
              <input
                aria-label="Email subject"
                value={email.subject}
                onChange={(e) =>
                  setEmail({ ...email, subject: e.target.value })
                }
              />
              <textarea
                aria-label="Email message"
                value={email.message}
                onChange={(e) =>
                  setEmail({ ...email, message: e.target.value })
                }
              />
              <button
                className="qw-text-button"
                onClick={() =>
                  setEmail({
                    ...email,
                    message: `Hi ${current.clientName},\n\nYour quote is ready to review. Please review and accept by ${recordDate(current.validUntil)}.\n\nThanks,\n${settings.studioName || "TEAM ALPHA"}`,
                  })
                }
              >
                Insert email template
              </button>
              <div className="qw-send-footer">
                <button onClick={() => setModal("schedule")}>Schedule</button>
                <button onClick={() => setModal("manual")}>
                  Send via link
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={email.sendCopy}
                    onChange={(e) =>
                      setEmail({ ...email, sendCopy: e.target.checked })
                    }
                  />
                  Send me a copy
                </label>
                <button
                  className="qw-primary"
                  disabled={busy}
                  onClick={() => send(false)}
                >
                  Send
                </button>
              </div>
              {saveError && (
                <p className="qw-error" role="alert">
                  {saveError}
                </p>
              )}
            </section>
            <section className="qw-email-preview">
              <img src={resolveStudioImage(current?.issuer?.logoUrl || settings.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)} alt="Team Alpha" />
              <div>
                Your quote is ready for review
                <strong>Quote #{quoteNumber(current)}</strong>
                {current.expiryEnabled !== false && (
                  <span>Complete by {recordDate(current.validUntil)}</span>
                )}
              </div>
              <p>{email.message}</p>
              <button>REVIEW QUOTE</button>
              <small>{settings.studioName || "TEAM ALPHA"}</small>
            </section>
          </div>
        </div>
      )}
      {modal && (
        <OperationsModal
          title={
            {
              discount: "Add discount",
              tax: "Add tax",
              template: "Create template",
              number: "Edit quote number",
              project: "Link to project",
              photo: "Add photo",
              link: "Get Quote Link",
              manual: "Send via link",
              schedule: "Schedule Quote",
              history: "Email history",
              cancel: "Cancel quote",
              archive: "Delete Quote",
              leave: "Unsaved changes",
            }[modal]
          }
          onClose={() => setModal("")}
          footer={
            <>
              <button className="qw-button" onClick={() => setModal("")}>
                Cancel
              </button>
              {modal === "discount" ? (
                <>
                  <button
                    className="qw-button"
                    onClick={() => {
                      change("discountValue", 0);
                      setModal("");
                    }}
                  >
                    Delete
                  </button>
                  <button
                    className="qw-primary"
                    onClick={() => {
                      change("discountType", discount.type);
                      change("discountValue", Number(discount.value));
                      setModal("");
                    }}
                  >
                    Apply
                  </button>
                </>
              ) : modal === "link" ? (
                <button
                  className="qw-primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied to clipboard");
                    } catch {
                      toast.error("Select and copy the link.");
                    }
                  }}
                >
                  Copy Link
                </button>
              ) : (
                modal !== "history" && (
                  <button
                    className="qw-primary"
                    disabled={busy}
                    onClick={async () => {
                      const generation = generationRef.current;
                      let loaded = false;
                      setBusy(true);
                      try {
                        if (modal === "manual") {
                          setModal("");
                          await act("share");
                          return;
                        }
                        if (modal === "schedule") {
                          await send(true);
                          setModal("");
                          return;
                        }
                        if (modal === "cancel" || modal === "archive") {
                          setModal("");
                          await act(modal);
                          return;
                        }
                        if (modal === "leave") {
                          generationRef.current++;
                          currentRef.current = null;
                          setCurrent(null);
                          setSearchParams({});
                          setBusy(false);
                          clearTimeout(timerRef.current);
                          setMode("list");
                          setDirty(false);
                          setModal("");
                          return;
                        }
                        if (modal === "tax") {
                          change(
                            "taxRateBps",
                            Math.round(Number(modalValue) * 100),
                          );
                          setModal("");
                          return;
                        }
                        if (modal === "photo") {
                          if (!/^https:\/\//.test(modalValue))
                            throw Error("Use an HTTPS image URL.");
                          change("design", {
                            ...form.design,
                            coverImage: modalValue,
                          });
                          setModal("");
                          return;
                        }
                        const q =
                          dirty || !currentRef.current
                            ? await saveDraft()
                            : currentRef.current;
                        if (!q || generation !== generationRef.current) return;
                        if (modal === "template")
                          await workspaceRequest(
                            "post",
                            "/api/studio/quote-templates",
                            {
                              ...form,
                              name: modalValue,
                              validityDays:
                                Math.max(
                                  1,
                                  Math.round(
                                    (Date.parse(form.validUntil) -
                                      Date.parse(form.issueDate)) /
                                      86400000,
                                  ),
                                ) || 30,
                            },
                          );
                        if (modal === "number") {
                          const r = await workspaceRequest(
                            "patch",
                            `/api/studio/quotations/${q._id}/number`,
                            { documentNumber: modalValue },
                          );
                          if (generation !== generationRef.current) return;
                          loadQuote(r); loaded = true;
                        }
                        if (modal === "project") {
                          const r = await workspaceRequest(
                            "patch",
                            `/api/studio/quotations/${q._id}/project`,
                            {
                              studioProjectId: modalValue || null,
                              contactId: form.contactId || null,
                              lead: form.lead || null,
                            },
                          );
                          if (generation !== generationRef.current) return;
                          loadQuote(r); loaded = true;
                        }
                        if (!loaded && generation !== generationRef.current) return;
                        setModal("");
                        reload();
                        toast.success("Saved");
                      } catch (e) {
                        if (generation === generationRef.current && !e.cancelled) toast.error(recordError(e));
                      } finally {
                        if (loaded || generation === generationRef.current) setBusy(false);
                      }
                    }}
                  >
                    {["cancel", "archive", "manual", "leave"].includes(modal)
                      ? "Confirm"
                      : modal === "schedule"
                        ? "Schedule"
                        : "Save"}
                  </button>
                )
              )}
            </>
          }
        >
          {modal === "photo" && (
            <Field label="Upload an image">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const data = new FormData();
                    data.append("image", file);
                    const result = await workspaceRequest(
                      "post",
                      "/api/studio/document-covers",
                      data,
                    );
                    change("design", {
                      ...formRef.current.design,
                      coverImage: result.url,
                    });
                    setModal("");
                    toast.success("Cover photo uploaded");
                  } catch (error) {
                    toast.error(recordError(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <small>JPEG, PNG or WebP · up to 8 MB</small>
            </Field>
          )}
          {modal === "discount" ? (
            <>
              <Field label="Type">
                <div className="qw-radio">
                  <label>
                    <input
                      type="radio"
                      checked={discount.type === "amount"}
                      onChange={() =>
                        setDiscount({ ...discount, type: "amount" })
                      }
                    />{" "}
                    Amount off
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={discount.type === "percent"}
                      onChange={() =>
                        setDiscount({ ...discount, type: "percent" })
                      }
                    />{" "}
                    Percent off
                  </label>
                </div>
              </Field>
              <Field
                label={discount.type === "percent" ? "Percent" : "Amount (₹)"}
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={discount.type === "percent" ? 100 : subtotal / 100}
                  value={discount.value}
                  onChange={(e) =>
                    setDiscount({ ...discount, value: e.target.value })
                  }
                />
              </Field>
            </>
          ) : modal === "link" ? (
            <>
              <p>Your contact can access the quote from the following link:</p>
              <input
                className="qw-link-input"
                aria-label="Quote share link"
                readOnly
                value={shareUrl}
              />
              <div className="qw-share-options">
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Hi ${current?.clientName}, please review your Team Alpha quote: ${shareUrl}`)}`}
                >
                  Share via WhatsApp ↗
                </a>
                <a target="_blank" rel="noreferrer" href={shareUrl}>
                  View client quote ↗
                </a>
              </div>
            </>
          ) : modal === "manual" ? (
            <p>
              This quote will be marked as sent without being automatically
              emailed to your contact. Please send the link manually.
            </p>
          ) : modal === "schedule" ? (
            <Field label="Send date and time">
              <input
                type="datetime-local"
                value={email.scheduledFor}
                onChange={(e) =>
                  setEmail({ ...email, scheduledFor: e.target.value })
                }
              />
            </Field>
          ) : modal === "history" ? (
            <>
              {!history.length ? (
                <p>No email deliveries recorded.</p>
              ) : (
                history.map((h, i) => (
                  <p key={i}>
                    {h.subject || h.kind} · {h.status} ·{" "}
                    {recordDate(h.sentAt || h.dueAt || h.createdAt)}
                    {h.error && <small>{h.error}</small>}
                  </p>
                ))
              )}
            </>
          ) : ["cancel", "archive", "leave"].includes(modal) ? (
            <p>
              {modal === "cancel"
                ? "Cancel this quotation and revoke client acceptance access?"
                : modal === "archive"
                  ? "Archive this quotation and remove it from active quotes? Its history is retained."
                  : "Leave without saving these changes?"}
            </p>
          ) : modal === "project" ? (
            <Field label="Project">
              <select
                value={modalValue}
                onChange={(e) => setModalValue(e.target.value)}
              >
                <option value="">No project</option>
                {projects
                  .filter(
                    (p) =>
                      !form.contactId ||
                      String(p.contactId?._id || p.contactId) ===
                        form.contactId,
                  )
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field
              label={
                {
                  tax: "Tax rate (%)",
                  template: "Template name",
                  number: "Quote number",
                  photo: "HTTPS image URL",
                }[modal]
              }
            >
              <input
                type={modal === "tax" ? "number" : "text"}
                min="0"
                max={modal === "tax" ? 100 : undefined}
                step="0.01"
                value={modalValue}
                onChange={(e) => setModalValue(e.target.value)}
              />
            </Field>
          )}
        </OperationsModal>
      )}
    </div>
  );
}
export function QuoteReadDocument({ quote, settings = {} }) {
  return (
    <article className="qw-read-document">
      <div className="qw-document-brand">
        <img src={resolveStudioImage(quote.issuer?.logoUrl || settings.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)} alt="" width="88" height="88" />
        <span>{quote.issuer?.name || settings.legalName || settings.studioName || "TEAM ALPHA"}</span>
        {quote.issuer?.address && <small>{quote.issuer.address}</small>}
        {quote.issuer?.taxId && <small>GSTIN: {quote.issuer.taxId}</small>}
      </div>
      <h2>Items</h2>
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
                <strong>{i.title}</strong>
                <p>{i.description}</p>
              </td>
              <td>{i.quantity}</td>
              <td>{rupees(i.unitPricePaise / 100)}</td>
              <td>{rupees((i.unitPricePaise * i.quantity) / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        <dt>Subtotal</dt>
        <dd>{rupees(quote.subtotalPaise / 100)}</dd>
        <dt>Discount</dt>
        <dd>− {rupees(quote.discountPaise / 100)}</dd>
        <dt>Tax</dt>
        <dd>{rupees(quote.taxPaise / 100)}</dd>
        <dt>Total</dt>
        <dd>
          <strong>{rupees(quote.totalPaise / 100)}</strong>
        </dd>
      </dl>
      <h3>Notes</h3>
      <p>{quote.notes || quote.terms}</p>
      {quote.notes && quote.terms && (
        <>
          <h3>Terms</h3>
          <p>{quote.terms}</p>
        </>
      )}
      <button className="qw-print" onClick={() => window.print()}>
        <Printer size={14} /> Print / save PDF
      </button>
    </article>
  );
}
