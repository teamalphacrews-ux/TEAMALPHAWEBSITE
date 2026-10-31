import { useCallback, useEffect, useRef, useState } from "react";
import { TEAM_ALPHA_LOGO } from "../utils/branding";
import axios from "axios";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Wallet,
  Receipt,
  Clapperboard,
  FolderOpen,
  MessageSquare,
  LockKeyhole,
  RefreshCw,
  Send,
  UsersRound,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { API_BASE_URL } from "../utils/apiConfig";
import { resolveStudioImage } from '../utils/settingsDefaults';
import {
  clientDate as date,
  messageRequestId,
} from "../utils/clientProjectData";
import { InvoiceDocument } from "./PublicInvoice";
import ClientFeatureCard from './ClientFeatureCard';
import ClientPaymentDialog from './ClientPaymentDialog';
import { clientDashboardSummary, clientPaymentRows } from '../utils/clientDashboardData';
import "./clientProjectWorkspace.css";
import './clientSmartDashboard.css';

const projectSections = ["quotation", "invoice", "payments", "delivery", "crew"];
const sectionFromHash = () => {
  const id = window.location.hash.replace("#project-", "");
  return projectSections.includes(id) ? id : null;
};

function ProjectSection({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  good,
  open,
  onToggle,
  children,
  nested = false,
  level = 2,
}) {
  const Heading = `h${level}`;
  return (
    <section
      id={id}
      className={`cp-accordion ${nested ? "cp-nested-accordion" : "cp-card"}`}
      data-open={open || undefined}
    >
      <Heading className="cp-accordion-heading">
        <button
          id={id + "-toggle"}
          type="button"
          aria-expanded={open}
          aria-controls={id + "-panel"}
          onClick={onToggle}
        >
          {!nested && (
            <span className="cp-section-index" aria-hidden="true">
              {String(
                projectSections.indexOf(id.replace("project-", "")) + 1,
              ).padStart(2, "0")}
            </span>
          )}
          {Icon && (
            <span className="cp-icon">
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
          <span className="cp-accordion-label">
            <span>{title}</span>
            {subtitle && <small>{subtitle}</small>}
          </span>
          {badge && (
            <span
              className={
                "cp-badge " +
                (good ? "good" : badge === "Overdue" ? "attention" : "")
              }
            >
              {badge}
            </span>
          )}
          <ChevronDown
            className="cp-accordion-chevron"
            size={18}
            aria-hidden="true"
          />
        </button>
      </Heading>
      <div
        id={id + "-panel"}
        className="cp-section-body"
        role="region"
        aria-labelledby={id + "-toggle"}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
}

export default function ClientProjectWorkspace({ token, quote, children }) {
  const [project, setProject] = useState(null),
    [messages, setMessages] = useState([]),
    [cursor, setCursor] = useState(null),
    [activeSection, setActiveSection] = useState(() => sectionFromHash() || (quote.status === 'Accepted' ? null : 'quotation')),
    [openPayment, setOpenPayment] = useState(null),
    [openDelivery, setOpenDelivery] = useState(null),
    [openCrew, setOpenCrew] = useState(null),
    [chatOpen, setChatOpen] = useState(
      () => window.location.hash === "#project-support",
    );
  const [refreshKey, setRefreshKey] = useState(0);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const closePayment = useCallback(() => setPaymentRequest(null), []);
  const [appearance, setAppearance] = useState(() => { try { return localStorage.getItem('teamalpha-client-appearance') === 'dark' ? 'dark' : 'daylight'; } catch { return 'daylight'; } });
  useEffect(() => { try { localStorage.setItem('teamalpha-client-appearance', appearance); } catch { /* Appearance still works for this visit. */ } }, [appearance]);
  const accepted = quote.status === 'Accepted';
  const [error, setError] = useState(""),
    [messageError, setMessageError] = useState(""),
    [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [olderBusy, setOlderBusy] = useState(false);
  const requestId = useRef(""),
    threadRef = useRef(null),
    loadedEarlier = useRef(false),
    workspaceRef = useRef(null),
    chatRef = useRef(null),
    chatLauncherRef = useRef(null),
    chatCloseRef = useRef(null),
    stickToLatest = useRef(true);
  const endpoint = `${API_BASE_URL}/api/quotes/${token}`;
  useEffect(() => {
    if (!accepted) return;
    let active = true,
      fetching = false;
    const controller = new AbortController();
    const load = async () => {
      if (fetching) return;
      fetching = true;
      const [projectResult] = await Promise.allSettled([axios.get(endpoint + '/project', { signal: controller.signal })]);
      const [messageResult] = projectResult.status === 'fulfilled' && projectResult.value.data.visibility?.allowChat !== false
        ? await Promise.allSettled([axios.get(endpoint + '/messages', { signal: controller.signal })])
        : [{ status: 'fulfilled', value: { data: { messages: [], nextCursor: null } } }];
      const result = [projectResult, messageResult];
      if (active) {
        if (result[0].status === "fulfilled") {
          setProject(result[0].value.data);
          setError("");
        } else if (!axios.isCancel(result[0].reason)) {
          setProject(null);
          setError(
            result[0].reason.response?.data?.error ||
              "Project updates are unavailable. Please try again shortly.",
          );
        }
        if (result[1].status === "fulfilled") {
          setMessages((old) => {
            const recent = result[1].value.data.messages;
            const ids = new Set(recent.map((m) => m._id));
            return [
              ...old.filter(
                (m) =>
                  !ids.has(m._id) &&
                  recent[0] &&
                  m.createdAt < recent[0].createdAt,
              ),
              ...recent,
            ];
          });
          if (!loadedEarlier.current)
            setCursor(result[1].value.data.nextCursor);
        }
      }
      fetching = false;
    };
    load();
    const visibleLoad = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(visibleLoad, 10000);
    document.addEventListener("visibilitychange", visibleLoad);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibleLoad);
    };
  }, [endpoint, accepted, refreshKey]);
  useEffect(() => {
    let restore = null;
    const beforePrint = () => {
      const workspace = workspaceRef.current;
      const selected = workspace?.querySelector(
        `details[data-document="${workspace.dataset.printDocument}"]`,
      );
      if (selected && !selected.open) {
        selected.open = true;
        restore = selected;
      }
    };
    const afterPrint = () => {
      if (restore) restore.open = false;
      restore = null;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  useEffect(() => {
    const hashChanged = () => {
      if (window.location.hash === "#project-support") {
        stickToLatest.current = true;
        setChatOpen(true);
      } else {
        const id = window.location.hash.replace("#project-", "");
        if (projectSections.includes(id)) setActiveSection(id);
      }
    };
    window.addEventListener("hashchange", hashChanged);
    return () => window.removeEventListener("hashchange", hashChanged);
  }, []);
  useEffect(() => {
    if (!chatOpen) return;
    chatCloseRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && chatRef.current?.contains(event.target)) {
        event.preventDefault();
        setChatOpen(false);
        chatLauncherRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [chatOpen]);
  useEffect(() => {
    if (chatOpen && stickToLatest.current && threadRef.current)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [chatOpen, messages]);
  const toggleSection = (id) =>
    setActiveSection((current) => (current === id ? null : id));
  const openSection = id => {
    setActiveSection(id);
    window.history.replaceState(window.history.state, '', '#project-' + id);
    requestAnimationFrame(() => {
      const section = document.getElementById('project-' + id);
      section?.querySelector('.cp-accordion-heading > button')?.focus({ preventScroll: true });
      section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  };
  const closeChat = () => {
    setChatOpen(false);
    chatLauncherRef.current?.focus({ preventScroll: true });
  };
  const selectPrintDocument = (document) => {
    if (workspaceRef.current)
      workspaceRef.current.dataset.printDocument = document;
  };
  const sendMessage = async (event) => {
    event.preventDefault();
    if (sending || !text.trim()) return;
    setSending(true);
    setMessageError("");
    requestId.current ||= messageRequestId();
    try {
      const { data } = await axios.post(endpoint + "/messages", {
        text: text.trim(),
        requestId: requestId.current,
      });
      setMessages((old) =>
        old.some((message) => message._id === data._id) ? old : [...old, data],
      );
      setText("");
      requestId.current = "";
      stickToLatest.current = true;
    } catch (e) {
      setMessageError(
        e.response?.data?.error ||
          "Your message could not be sent. Retry to send it safely.",
      );
    } finally {
      setSending(false);
    }
  };
  const olderMessages = async () => {
    stickToLatest.current = false;
    setOlderBusy(true);
    try {
      const { data } = await axios.get(endpoint + "/messages", {
        params: { before: cursor },
      });
      setMessages((old) => [
        ...data.messages.filter(
          (message) => !old.some((m) => m._id === message._id),
        ),
        ...old,
      ]);
      loadedEarlier.current = true;
      setCursor(data.nextCursor);
    } catch {
      setMessageError("Earlier messages could not be loaded.");
    } finally {
      setOlderBusy(false);
    }
  };
  const summary = clientDashboardSummary({ quote, project });
  const money = (value, currency = summary.invoice.currency || summary.quotation.currency) => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  const invoice = summary.invoice.available ? project.invoice.document : null,
    production = project?.production,
    deliveries = production?.deliveries || [];
  const visibility = project?.visibility || {}, chatEnabled = !!project && visibility.allowChat !== false;
  const approved = summary.invoice.available,
    invoiceIssued = approved,
    started = ['in_progress', 'delivered'].includes(production?.state) || (production?.state === 'deliveries_only' && deliveries.length > 0);
  const completed = summary.production.ready;
  const waiting = !accepted ? 'After acceptance' : error ? 'Temporarily unavailable' : !project ? 'Loading' : 'Studio review';
  const invoiceStatus = approved ? 'Issued' : summary.invoice.state === 'cancelled' ? 'Cancelled' : summary.invoice.state === 'hidden' ? 'Studio-managed' : waiting;
  const paymentStatus = summary.payments.available ? summary.payments.balance === 0 ? 'Paid in full' : !summary.payments.scheduleKnown ? 'Schedule pending' : summary.payments.next?.state === 'Awaiting date' ? 'Date to confirm' : summary.payments.dueNow > 0 ? 'Payment due' : 'Scheduled' : invoiceStatus;
  const crew = project?.crew || [
    ...new Map(
      deliveries
        .filter((task) => task.crew)
        .map((task) => [task.crew.name + task.crew.role, task.crew]),
    ).values(),
  ];
  const invoiceSummary = (
    <ProjectSection
      id="project-invoice"
      title="Your invoice"
      subtitle={
        invoice?.documentNumber ||
        project?.invoice?.number ||
        "Prepared after quote acceptance"
      }
      icon={FileText}
      badge={invoiceStatus}
      good={approved}
      open={activeSection === "invoice"}
      onToggle={() => toggleSection("invoice")}
    >
      {approved ? (
        <>
          <div className="cp-money-grid">
            <div>
              <small>Total</small>
              <strong>{money(summary.invoice.total)}</strong>
            </div>
            <div>
              <small>Received</small>
              <strong>{money(summary.invoice.paid)}</strong>
            </div>
            <div>
              <small>Balance due</small>
              <strong>{money(summary.invoice.balance)}</strong>
            </div>
          </div>
          <details
            className="cp-document-disclosure"
            data-document="invoice"
            onClickCapture={() => selectPrintDocument("invoice")}
          >
            <summary>View full invoice <ChevronDown size={17} /></summary>
            <div className="cp-embedded-invoice"><InvoiceDocument invoice={invoice} /></div>
          </details>
        </>
      ) : (
        <div className="cp-empty-inline"><Receipt size={24} /><div>
          <h3>{!accepted ? 'Your invoice follows your confirmation' : summary.invoice.state === 'cancelled' ? 'Please contact your studio' : error ? 'Please refresh your project' : 'Your invoice is being reviewed'}</h3>
          <p>{!accepted ? 'Review and accept your quotation. Your studio will then review and issue your invoice here, through this same link.' : summary.invoice.state === 'cancelled' ? 'The studio has cancelled this invoice. Contact us below for the next step.' : 'Your quote is accepted. Your studio will review the invoice and publish it here. Keep this same link.'}</p>
        </div></div>
      )}
    </ProjectSection>
  );
  const paymentsSummary = (
    <ProjectSection id="project-payments" title="Payments & schedule" subtitle="Confirmed payments and your next instalment." icon={Wallet} badge={paymentStatus} good={summary.payments.available && summary.payments.balance === 0} open={activeSection === 'payments'} onToggle={() => toggleSection('payments')}>
      {summary.payments.available ? (<>
          {summary.payments.balance > 0 && <div className="cp-payment-action"><div><h3>Ready for your next payment?</h3><p>Use your studio’s UPI or bank transfer details.</p></div><button type="button" className="cp-button" onClick={() => setPaymentRequest({})}><Wallet size={16} /> Make payment</button></div>}
          <div className="cp-money-grid">
            <div><small>Received</small><strong>{money(summary.invoice.paid)}</strong></div>
            <div><small>Balance</small><strong>{money(summary.payments.balance)}</strong></div>
            <div><small>Due now</small><strong>{money(summary.payments.dueNow)}</strong></div>
          </div>
          <h3>Payment schedule</h3>
          <div className="cp-payment-list" aria-label="Payment schedule">
            {clientPaymentRows(invoice).map((row) => (
              <ProjectSection
                key={row.number}
                id={"project-payment-" + row.number}
                nested
                level={4}
                title={row.label || "Payment " + row.number}
                subtitle={
                  date(row.dueDate) + " · " + money(row.amountPaise / 100)
                }
                badge={row.state}
                good={row.state === "Paid"}
                open={openPayment === row.number}
                onToggle={() =>
                  setOpenPayment((current) =>
                    current === row.number ? null : row.number,
                  )
                }
              >
                <dl>
                  <div>
                    <dt>Due date</dt>
                    <dd>{date(row.dueDate)}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>{money(row.amountPaise / 100)}</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{money(row.remaining / 100)}</dd>
                  </div>
                </dl>
                {row.remaining > 0 && <button type="button" className="cp-button secondary" onClick={() => setPaymentRequest({ amountPaise: row.remaining })}>Make payment · {money(row.remaining / 100)}<ArrowUpRight size={15} /></button>}
              </ProjectSection>
            ))}
          </div>
          <div className="cp-card-footer">
            <span>Payments are updated when confirmed by the studio.</span>
          </div>
          {!summary.payments.scheduleKnown && <p className="cp-muted">Your studio is finalising the instalment dates. Please check back or contact the studio.</p>}
        </>
      ) : (
        <div className="cp-empty-inline">
          <Clock3 size={24} />
          <div>
            <h3>
              {project?.invoice?.state === "cancelled"
                ? "Please contact your studio"
                : "Your payment schedule will appear here"}
            </h3>
            <p>
              {project?.invoice?.state === "cancelled"
                ? "The studio has cancelled this invoice. You can contact us below for the next step."
                : !accepted ? 'Once you accept the quotation and your studio issues the invoice, you can see instalments, due dates and confirmed payments here.' : 'Your studio will publish the payment schedule after reviewing and issuing your invoice.'}
            </p>
          </div>
        </div>
      )}
    </ProjectSection>
  );
  const deliveryCards = (
    <ProjectSection
      id="project-delivery"
      title="Post-production & delivery"
      subtitle={
        started
          ? visibility.showProgress === false ? 'Files published by your studio.' : completed === null ? 'Your studio is preparing the next update.' : `${completed} of ${deliveries.length} deliverables ready`
          : "Photos, album and films, all in one place."
      }
      icon={FolderOpen}
      open={activeSection === "delivery"}
      onToggle={() => toggleSection("delivery")}
    >
      {started ? (
        <div className="cp-deliveries">
          {deliveries.map((task) => (
            <ProjectSection
              key={task.id}
              id={"project-deliverable-" + task.id}
              nested
              level={3}
              title={task.title}
              subtitle={task.type}
              badge={task.stage}
              good={["Ready", "Uploaded to Drive", "Delivered"].includes(
                task.stage,
              )}
              open={openDelivery === task.id}
              onToggle={() =>
                setOpenDelivery((current) =>
                  current === task.id ? null : task.id,
                )
              }
            >
              {task.update && <p className="cp-public-update">{task.update}</p>}
              <div className="cp-delivery-meta">
                {visibility.showProgress !== false &&
                <span>
                  <Clock3 size={14} />
                  {date(task.dueDate)}
                </span>}
                {task.crew && (
                  <span>
                    <UsersRound size={14} />
                    {task.crew.name}
                  </span>
                )}
              </div>
              {task.url && (
                <a
                  className="cp-button secondary"
                  href={task.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {task.type === "Album" ? "View album" : "Open delivery"}
                  <ArrowUpRight size={15} />
                </a>
              )}
            </ProjectSection>
          ))}
        </div>
      ) : (
        <div className="cp-empty-inline">
          <FolderOpen size={26} />
          <div>
            <h3>
              {invoiceIssued
                ? "We’ll keep you in the loop"
                : "First, your studio will issue the invoice"}
            </h3>
            <p>
              Photos, album design, traditional video and cinematic film updates
              will appear here as your studio publishes them.
            </p>
          </div>
        </div>
      )}
    </ProjectSection>
  );
  const cover = quote.design?.coverImage || "";
  const coverUrl =
    /^\/assets\/[\w./-]+$/.test(cover) || /^https:\/\//.test(cover)
      ? cover
      : "/assets/studio-wedding.webp";
  const delivered = production?.state === "delivered";
  const currentStage =
    !accepted
      ? summary.quotation.status === 'Expired' ? 'Please contact your studio' : 'Your story starts here'
      : error ? 'Project updates are temporarily unavailable'
      : project?.invoice?.state === "cancelled"
      ? "Your studio is here to help"
      : delivered
        ? "Your story, delivered"
        : started
          ? "Your story is taking shape"
          : invoiceIssued
            ? "Ready for the next chapter"
            : "A beautiful beginning";
  const journey = [
    { label: "Quotation", state: accepted ? 'Accepted' : summary.quotation.status === 'Expired' ? 'Expired' : 'Your review', done: accepted },
    {
      label: "Invoice & payments",
      state:
        project?.invoice?.state === "cancelled"
          ? "Cancelled"
          : approved
            ? invoice?.status === "Paid"
              ? "Paid"
              : "Issued"
            : !accepted ? 'Upcoming' : error ? 'Unavailable' : 'Studio review',
      done: approved,
    },
    {
      label: "Post-production",
      state: !accepted ? 'Upcoming' : error ? 'Unavailable' : !project ? 'Loading' : delivered ? "Complete" : started ? "In progress" : "Not started",
      done: delivered,
    },
    {
      label: "Final delivery",
      state: error ? 'Unavailable' : delivered ? "Delivered" : "Upcoming",
      done: delivered,
    },
  ].filter(step => visibility.showPayments !== false || step.label !== 'Invoice & payments');
  const featureCards = [
    { id: 'quotation', label: 'Quotation', icon: FileText, tone: 'quote', status: accepted ? 'Accepted' : summary.quotation.status === 'Expired' ? 'Expired' : 'Ready to review', value: money(summary.quotation.total, summary.quotation.currency), detail: accepted ? 'Your celebration, confirmed.' : 'Your proposal, thoughtfully prepared.', footnote: accepted ? 'View accepted quotation' : 'Review your quotation' },
    { id: 'invoice', label: 'Invoice', icon: Receipt, tone: 'invoice', status: invoiceStatus, value: approved ? money(summary.invoice.total) : '—', detail: approved ? summary.invoice.number : !accepted ? 'Available after quote acceptance.' : summary.invoice.state === 'hidden' ? 'Managed by your studio.' : error ? 'Please refresh for updates.' : 'Your studio will issue it here.', footnote: approved ? 'View issued invoice' : 'See the next step', disabled: summary.invoice.state === 'hidden' },
    { id: 'payments', label: 'Payments', icon: Wallet, tone: 'payments', status: paymentStatus, value: summary.payments.available ? money(summary.payments.balance) : '—', detail: summary.payments.available ? summary.payments.balance === 0 ? 'All confirmed payments received.' : 'Remaining balance' : !accepted ? 'Instalments follow your invoice.' : summary.invoice.state === 'hidden' ? 'Managed by your studio.' : 'Dates appear once your invoice is issued.', footnote: summary.payments.next ? `${summary.payments.next.state} · ${date(summary.payments.next.dueDate)}` : 'View payment schedule', disabled: summary.invoice.state === 'hidden' },
    { id: 'delivery', label: 'Post-production', icon: Clapperboard, tone: 'production', status: summary.production.state === 'hidden' ? 'Studio-managed' : delivered ? 'Delivered' : started ? visibility.showProgress === false ? 'Files available' : 'In progress' : !accepted ? 'After your event' : error ? 'Unavailable' : 'Updates to follow', value: summary.production.completionPercent !== null ? `${summary.production.completionPercent}%` : summary.production.published > 0 ? `${summary.production.published} files` : '—', detail: summary.production.total > 0 ? `${summary.production.completed} of ${summary.production.total} deliverables complete` : summary.production.state === 'hidden' ? 'Managed by your studio.' : 'Photos, album, traditional & cinematic films.', footnote: 'Follow your creative progress', progress: summary.production.completionPercent, disabled: summary.production.state === 'hidden' },
  ];
  return (
    <div
      className="client-project cp-dashboard"
      data-theme={appearance}
      ref={workspaceRef}
      data-print-document={approved ? "invoice" : "quote"}
    >
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="no-referrer" />
      <header className="cp-topbar">
        <div>
          <img src={resolveStudioImage(quote.studio.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)} alt={quote.studio.name} />
          <span>
            {quote.studio.name}
            <small>YOUR CLIENT DASHBOARD</small>
          </span>
        </div>
        <div className="cp-topbar-tools">
          <button type="button" className="cp-theme-toggle" aria-label={appearance === 'dark' ? 'Switch to Daylight mode' : 'Switch to Dark mode'} onClick={() => setAppearance(mode => mode === 'dark' ? 'daylight' : 'dark')}>{appearance === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button>
        <span className="cp-private-label">
          <LockKeyhole size={13} strokeWidth={1.5} aria-hidden="true" /> Private
          project
        </span>
        </div>
      </header>
      <main className="cp-main">
        <section className="cp-welcome" aria-labelledby="client-project-title">
          <img
            className="cp-cover-image"
            src={coverUrl}
            alt=""
            fetchPriority="high"
          />
          <div className="cp-cover-shade" />
          <div className="cp-welcome-content">
            <span className="cp-eyebrow">YOUR PROJECT OVERVIEW</span>
            <h1 id="client-project-title">
              {quote.clientName || 'Your celebration'}
            </h1>
            <p>{quote.title || 'Your quotation, payments and creative journey.'}</p>
            <div className="cp-cover-footer">
              <span>{quote.documentNumber}</span>
              <span>
                <span className="cp-status-dot" />
                {currentStage}
              </span>
            </div>
          </div>
        </section>
        <section className="cp-feature-grid" aria-label="Your project at a glance">
          {featureCards.map(card => <ClientFeatureCard key={card.id} {...card} open={activeSection === card.id} onClick={() => openSection(card.id)} />)}
        </section>
        {summary.payments.available && summary.payments.balance > 0 && <section className="cp-payment-action cp-next-action" aria-label="Your next payment"><div><span className="cp-eyebrow">{summary.payments.next ? 'NEXT PAYMENT' : 'REMAINING BALANCE'}</span><h2>{money(summary.payments.next?.amount ?? summary.payments.balance)} <span>{summary.payments.next ? `${summary.payments.next.state} · ${date(summary.payments.next.dueDate)}` : 'Contact your studio for the schedule'}</span></h2><p>{summary.invoice.number} · Updated after your studio confirms receipt.</p></div><button type="button" className="cp-button" onClick={() => setPaymentRequest({})}><Wallet size={17} /> Make payment<ArrowUpRight size={15} /></button></section>}
        {visibility.showProgress !== false && <section
          className="cp-journey-card"
          aria-labelledby="client-journey-title"
        >
          <div className="cp-journey-heading">
            <h2 id="client-journey-title">Your journey</h2>
            <span>FROM THE FIRST YES TO THE FINAL FRAME</span>
          </div>
          <ol className="cp-journey">
            {journey.map((step, index) => (
              <li
                key={step.label}
                className={
                  step.done
                    ? "complete"
                    : step.state === "In progress"
                      ? "current"
                      : ""
                }
              >
                <span className="cp-step-marker">
                  {step.done ? (
                    <Check size={12} strokeWidth={1.7} aria-hidden="true" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="cp-step-label">{step.label}</span>
                <small>{step.state}</small>
              </li>
            ))}
          </ol>
        </section>}
        <div className="cp-workspace-heading">
          <span className="cp-eyebrow">YOUR PROJECT</span>
          <h2>Every detail, in one place.</h2>
          <p>
            Open a section to explore your documents, updates and project team.
          </p>
        </div>
        {error && (
          <div className="cp-error" role="alert">
            <span>{error}</span>
            <button type="button" className="cp-button secondary" onClick={() => setRefreshKey(key => key + 1)}><RefreshCw size={15} /> Try again</button>
          </div>
        )}
        {accepted && !project && !error && (
          <p className="cp-loading" role="status">
            <RefreshCw size={18} />
            Loading your project…
          </p>
        )}
        <ProjectSection
          id="project-quotation"
          title="Your quotation"
          subtitle={quote.documentNumber}
          icon={CheckCircle2}
          badge={accepted ? 'Accepted' : summary.quotation.status === 'Expired' ? 'Expired' : 'Open'}
          good={accepted}
          open={activeSection === "quotation"}
          onToggle={() => toggleSection("quotation")}
        >
          {accepted && <p className="cp-accepted-note">
            <CheckCircle2 size={17} />
            Accepted on {date(quote.acceptedAt)}. Your studio has your
            confirmation.
          </p>}
          <div
            className="cp-quote-document"
            onClickCapture={() => selectPrintDocument("quote")}
          >
            {children}
          </div>
        </ProjectSection>
        {visibility.showPayments !== false && invoiceSummary}
        {visibility.showPayments !== false && paymentsSummary}
        {(visibility.showProgress !== false || visibility.showDeliverables !== false) && deliveryCards}
        {visibility.showCrew !== false && <ProjectSection
          id="project-crew"
          title="The people on your project"
          subtitle="Assigned work and its current stage."
          icon={UsersRound}
          open={activeSection === "crew"}
          onToggle={() => toggleSection("crew")}
        >
          {crew.length ? (
            <div className="cp-crew-grid">
              {crew.map((person) => (
                <ProjectSection
                  key={person.name + person.role}
                  id={"project-person-" + crew.indexOf(person)}
                  nested
                  level={3}
                  title={person.name}
                  subtitle={person.role.replaceAll("_", " ").toLowerCase()}
                  open={openCrew === person.name + person.role}
                  onToggle={() =>
                    setOpenCrew((current) =>
                      current === person.name + person.role
                        ? null
                        : person.name + person.role,
                    )
                  }
                >
                  <ul>
                    {deliveries
                      .filter((task) => task.crew?.name === person.name)
                      .map((task) => (
                        <li key={task.id}>
                          <strong>{task.title}</strong>
                          <span>{task.stage}</span>
                        </li>
                      ))}
                  </ul>
                </ProjectSection>
              ))}
            </div>
          ) : (
            <p className="cp-muted">
              Your studio will publish crew assignments with your production
              updates.
            </p>
          )}
        </ProjectSection>}
      </main>
      {paymentRequest && invoice && <ClientPaymentDialog invoice={invoice} theme={appearance} amountPaise={paymentRequest.amountPaise} onClose={closePayment} />}
      {chatEnabled && <><aside
        id="project-support"
        className="cp-chat-popup"
        ref={chatRef}
        aria-labelledby="project-support-title"
        hidden={!chatOpen}
      >
        <header className="cp-chat-heading">
          <span className="cp-chat-avatar">
            <img src={resolveStudioImage(quote.studio.logoUrl || TEAM_ALPHA_LOGO, API_BASE_URL)} alt="" />
          </span>
          <div>
            <h2 id="project-support-title">{quote.studio.name}</h2>
            <p>{project?.supportHours || 'A little help, whenever you need it.'}</p>
          </div>
          <button
            type="button"
            className="cp-chat-close"
            aria-label="Close support chat"
            onClick={closeChat}
            ref={chatCloseRef}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div
          className="cp-messages"
          ref={threadRef}
          onScroll={(event) => {
            const list = event.currentTarget;
            stickToLatest.current =
              list.scrollHeight - list.scrollTop - list.clientHeight < 48;
          }}
          aria-label="Project support messages"
          aria-live="polite"
        >
          {cursor && (
            <button
              className="cp-earlier"
              disabled={olderBusy}
              onClick={olderMessages}
            >
              {olderBusy ? "Loading…" : "Load earlier messages"}
            </button>
          )}
          {messages.length ? (
            messages.map((message) => (
              <article
                key={message._id}
                className={"cp-message " + message.author}
              >
                <strong>
                  {message.author === "studio" ? quote.studio.name : "You"}
                </strong>
                <p>{message.text}</p>
                <time>
                  {new Date(message.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Asia/Kolkata",
                  })}
                </time>
              </article>
            ))
          ) : (
            <div className="cp-support-empty">
              <MessageSquare size={30} />
              <h3>We’re here for your questions</h3>
              <p>
                Send a message and your studio can reply here. Keep this link to
                check the conversation.
              </p>
            </div>
          )}
        </div>
        <form className="cp-compose" onSubmit={sendMessage}>
          <label htmlFor="client-project-message">Your message</label>
          <textarea
            id="client-project-message"
            rows={3}
            maxLength={2000}
            value={text}
            disabled={sending}
            placeholder="How can we help?"
            onChange={(event) => {
              setText(event.target.value);
              requestId.current = "";
            }}
          />
          {messageError && (
            <p role="alert" className="cp-error">
              {messageError}
            </p>
          )}
          <div>
            <small>{text.length}/2,000</small>
            <button className="cp-button" disabled={sending || !text.trim()}>
              {sending ? "Sending…" : "Send message"}
              <Send size={15} />
            </button>
          </div>
        </form>
      </aside>
      <button
        type="button"
        className="cp-chat-launcher"
        ref={chatLauncherRef}
        aria-label={chatOpen ? "Close support chat" : "Open support chat"}
        aria-expanded={chatOpen}
        aria-controls="project-support"
        onClick={() => {
          if (chatOpen) closeChat();
          else {
            stickToLatest.current = true;
            setChatOpen(true);
          }
        }}
      >
        {chatOpen ? (
          <X size={22} aria-hidden="true" />
        ) : (
          <MessageSquare size={24} aria-hidden="true" />
        )}
      </button></>}
      <footer className="cp-footer">
        {quote.studio.name} ·{" "}
        {quote.studio.email && (
          <a href={`mailto:${quote.studio.email}`}>{quote.studio.email}</a>
        )}
      </footer>
    </div>
  );
}
