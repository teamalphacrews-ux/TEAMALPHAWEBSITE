import { useEffect, useRef, useState } from "react";
import { TEAM_ALPHA_LOGO } from "../utils/branding";
import axios from "axios";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  FolderOpen,
  MessageSquare,
  LockKeyhole,
  RefreshCw,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import { API_BASE_URL } from "../utils/apiConfig";
import { resolveStudioImage } from '../utils/settingsDefaults';
import {
  clientMoney as money,
  clientDate as date,
  paymentRows,
  messageRequestId,
} from "../utils/clientProjectData";
import { InvoiceDocument } from "./PublicInvoice";
import "./clientProjectWorkspace.css";

const projectSections = ["quotation", "invoice", "delivery", "crew"];
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
    [activeSection, setActiveSection] = useState(sectionFromHash),
    [openPayment, setOpenPayment] = useState(null),
    [openDelivery, setOpenDelivery] = useState(null),
    [openCrew, setOpenCrew] = useState(null),
    [chatOpen, setChatOpen] = useState(
      () => window.location.hash === "#project-support",
    );
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
  }, [endpoint]);
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
  const invoice = project?.invoice?.document,
    production = project?.production,
    deliveries = production?.deliveries || [];
  const visibility = project?.visibility || {}, chatEnabled = !!project && visibility.allowChat !== false;
  const approved = project?.invoice?.state === 'issued' && !!invoice,
    invoiceIssued = approved || project?.invoice?.state === 'hidden',
    started = ["in_progress", "delivered", 'deliveries_only'].includes(production?.state);
  const completed = deliveries.filter((task) =>
    ["Ready", "Uploaded to Drive", "Delivered"].includes(task.stage),
  ).length;
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
      title="Invoice & payments"
      subtitle={
        invoice?.documentNumber ||
        project?.invoice?.number ||
        "Prepared after quote acceptance"
      }
      icon={FileText}
      badge={
        approved
          ? "Issued"
          : project?.invoice?.state === "cancelled"
            ? "Cancelled"
            : "Awaiting studio approval"
      }
      good={approved}
      open={activeSection === "invoice"}
      onToggle={() => toggleSection("invoice")}
    >
      {approved ? (
        <>
          <div className="cp-money-grid">
            <div>
              <small>Total</small>
              <strong>{money(invoice.total)}</strong>
            </div>
            <div>
              <small>Received</small>
              <strong>
                {money(
                  invoice.status === "Paid"
                    ? invoice.total
                    : invoice.advancePaid,
                )}
              </strong>
            </div>
            <div>
              <small>Balance due</small>
              <strong>
                {money(
                  Math.max(
                    0,
                    invoice.total -
                      (invoice.status === "Paid"
                        ? invoice.total
                        : invoice.advancePaid || 0),
                  ),
                )}
              </strong>
            </div>
          </div>
          <h3>Payment schedule</h3>
          <div className="cp-payment-list" aria-label="Payment schedule">
            {paymentRows(invoice).map((row) => (
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
              </ProjectSection>
            ))}
          </div>
          <div className="cp-card-footer">
            <span>Payments are updated when confirmed by the studio.</span>
          </div>
          <details
            className="cp-document-disclosure"
            data-document="invoice"
            open={openPayment === "document"}
            onClickCapture={() => selectPrintDocument("invoice")}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                setOpenPayment((current) =>
                  current === "document" ? null : "document",
                );
              }}
            >
              View full invoice & payment details <ChevronDown size={17} />
            </summary>
            <div className="cp-embedded-invoice">
              <InvoiceDocument invoice={invoice} />
            </div>
          </details>
        </>
      ) : (
        <div className="cp-empty-inline">
          <Clock3 size={24} />
          <div>
            <h3>
              {project?.invoice?.state === "cancelled"
                ? "Please contact your studio"
                : "Your invoice is being reviewed"}
            </h3>
            <p>
              {project?.invoice?.state === "cancelled"
                ? "The studio has cancelled this invoice. You can contact us below for the next step."
                : "Your quote is accepted. Your studio will review the generated invoice and publish its payment schedule here. Keep this same link."}
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
          ? visibility.showProgress === false ? 'Files published by your studio.' : `${completed} of ${deliveries.length} deliverables ready`
          : "Updates appear here when production starts."
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
    project?.invoice?.state === "cancelled"
      ? "Your studio is here to help"
      : delivered
        ? "Your story, delivered"
        : started
          ? "Your story is taking shape"
          : invoiceIssued
            ? "Ready for the next chapter"
            : "A beautiful beginning";
  const journey = [
    { label: "Quotation", state: "Accepted", done: true },
    {
      label: "Invoice & payments",
      state:
        project?.invoice?.state === "cancelled"
          ? "Cancelled"
          : approved
            ? invoice?.status === "Paid"
              ? "Paid"
              : "Issued"
            : "Studio review",
      done: approved,
    },
    {
      label: "Post-production",
      state: delivered ? "Complete" : started ? "In progress" : "Not started",
      done: delivered,
    },
    {
      label: "Final delivery",
      state: delivered ? "Delivered" : "Upcoming",
      done: delivered,
    },
  ].filter(step => visibility.showPayments !== false || step.label !== 'Invoice & payments');
  return (
    <div
      className="client-project"
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
            <small>CLIENT EXPERIENCE</small>
          </span>
        </div>
        <span className="cp-private-label">
          <LockKeyhole size={13} strokeWidth={1.5} aria-hidden="true" /> Private
          project
        </span>
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
            <span className="cp-eyebrow">PREPARED FOR {quote.clientName}</span>
            <h1 id="client-project-title">
              {quote.title || "Your celebration, thoughtfully together."}
            </h1>
            <p>Every detail of your story, beautifully together.</p>
            <div className="cp-cover-footer">
              <span>{quote.documentNumber}</span>
              <span>
                <span className="cp-status-dot" />
                {currentStage}
              </span>
            </div>
          </div>
        </section>
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
          <h2>A little closer to your story.</h2>
          <p>
            Your documents, creative progress and the people making it happen.
          </p>
        </div>
        {error && (
          <div className="cp-error" role="alert">
            {error}
          </div>
        )}
        {!project && !error && (
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
          badge="Accepted"
          good
          open={activeSection === "quotation"}
          onToggle={() => toggleSection("quotation")}
        >
          <p className="cp-accepted-note">
            <CheckCircle2 size={17} />
            Accepted on {date(quote.acceptedAt)}. Your studio has your
            confirmation.
          </p>
          <div
            className="cp-quote-document"
            onClickCapture={() => selectPrintDocument("quote")}
          >
            {children}
          </div>
        </ProjectSection>
        {visibility.showPayments !== false && invoiceSummary}
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
