import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import {
  workspaceRequest,
  recordError,
} from "../components/operations/workspaceData";
import { messageRequestId } from "../../utils/clientProjectData";
import "./projectSupport.css";

export default function ProjectSupport() {
  const [search, setSearch] = useSearchParams();
  const [threads, setThreads] = useState([]),
    [selected, setSelected] = useState(search.get("quote") || ""),
    [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [threadError, setThreadError] = useState("");
  const [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [sendError, setSendError] = useState(""),
    [olderBusy, setOlderBusy] = useState(false);
  const requestId = useRef(""),
    firstList = useRef(true);
  const current = detail?.id === selected ? detail.data : null;
  useEffect(() => {
    let active = true,
      fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const data = await workspaceRequest("get", "/api/project-support");
        if (active) {
          setThreads(data);
          if (firstList.current) {
            if (window.innerWidth > 700)
              setSelected((id) => id || data[0]?._id || "");
            firstList.current = false;
          }
          setError("");
        }
      } catch (e) {
        if (active) setError(recordError(e));
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    load();
    const poll = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(poll, 10000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true,
      fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const data = await workspaceRequest(
          "get",
          "/api/project-support/" + selected + "/messages",
        );
        if (active) {
          setDetail((old) => {
            const previous = old?.id === selected ? old.data.messages : [];
            const ids = new Set(data.messages.map((message) => message._id));
            return {
              id: selected,
              data: {
                ...data,
                nextCursor:
                  previous.length > data.messages.length
                    ? old.data.nextCursor
                    : data.nextCursor,
                messages: [
                  ...previous.filter(
                    (message) =>
                      !ids.has(message._id) &&
                      data.messages[0] &&
                      message.createdAt < data.messages[0].createdAt,
                  ),
                  ...data.messages,
                ],
              },
            };
          });
          setThreadError("");
          window.dispatchEvent(new Event("studio-support-read"));
          setThreads((old) =>
            old.map((thread) =>
              thread._id === selected
                ? {
                    ...thread,
                    clientUnread: data.clientUnread ?? thread.clientUnread,
                  }
                : thread,
            ),
          );
        }
      } catch (e) {
        if (active) setThreadError(recordError(e));
      } finally {
        fetching = false;
      }
    };
    load();
    const poll = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(poll, 10000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [selected]);
  const choose = (id) => {
    setSelected(id);
    setSearch({ quote: id }, { replace: true });
    setText("");
    setSendError("");
    requestId.current = "";
    setThreadError("");
  };
  const send = async (event) => {
    event.preventDefault();
    if (sending || !text.trim() || !selected) return;
    const id = selected;
    requestId.current ||= messageRequestId();
    setSending(true);
    setSendError("");
    try {
      const message = await workspaceRequest(
        "post",
        "/api/project-support/" + id + "/messages",
        { text: text.trim(), requestId: requestId.current },
      );
      setDetail((old) =>
        old?.id !== id
          ? old
          : {
              ...old,
              data: {
                ...old.data,
                messages: old.data.messages.some((m) => m._id === message._id)
                  ? old.data.messages
                  : [...old.data.messages, message],
              },
            },
      );
      setText("");
      requestId.current = "";
      setThreads((old) =>
        old.map((thread) =>
          thread._id === id ? { ...thread, latestMessage: message } : thread,
        ),
      );
    } catch (e) {
      setSendError(recordError(e));
    } finally {
      setSending(false);
    }
  };
  const older = async () => {
    if (!current?.nextCursor || olderBusy) return;
    const id = selected;
    setOlderBusy(true);
    try {
      const data = await workspaceRequest(
        "get",
        "/api/project-support/" + id + "/messages?before=" + current.nextCursor,
      );
      setDetail((old) =>
        old?.id !== id
          ? old
          : {
              ...old,
              data: {
                ...old.data,
                messages: [
                  ...data.messages.filter(
                    (message) =>
                      !old.data.messages.some((m) => m._id === message._id),
                  ),
                  ...old.data.messages,
                ],
                nextCursor: data.nextCursor,
              },
            },
      );
      setThreads((old) =>
        old.map((thread) =>
          thread._id === id
            ? {
                ...thread,
                clientUnread: data.clientUnread ?? thread.clientUnread,
              }
            : thread,
        ),
      );
      window.dispatchEvent(new Event("studio-support-read"));
    } catch (e) {
      setSendError(recordError(e));
    } finally {
      setOlderBusy(false);
    }
  };
  const filtered = threads.filter((thread) =>
    `${thread.clientName} ${thread.title} ${thread.documentNumber}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="project-support">
      <div className="studio-page-heading">
        <div>
          <span className="studio-eyebrow">CLIENT CONVERSATIONS</span>
          <h1>Client support</h1>
          <p className="studio-muted">
            Project questions and replies, connected to each client’s original
            quote link.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      <div className={"support-workspace" + (selected ? " has-thread" : "")}>
        <aside className="support-inbox">
          <label className="studio-search">
            <Search size={15} />
            <input
              aria-label="Search client conversations"
              placeholder="Search conversations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="support-thread-list">
            {loading ? (
              <p className="support-empty" role="status">
                Loading conversations…
              </p>
            ) : filtered.length ? (
              filtered.map((thread) => (
                <button
                  key={thread._id}
                  className={thread._id === selected ? "selected" : ""}
                  disabled={sending}
                  onClick={() => choose(thread._id)}
                >
                  <span className="support-avatar">
                    {thread.clientName
                      ?.split(" ")
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>{thread.clientName}</strong>
                    <small>
                      {thread.latestMessage?.text ||
                        thread.title ||
                        "No messages yet"}
                    </small>
                  </span>
                  {thread.clientUnread > 0 && <b>{thread.clientUnread}</b>}
                </button>
              ))
            ) : (
              <div className="support-empty">
                <MessageSquare size={28} />
                <h3>No conversations yet</h3>
                <p>
                  Accepted quotes appear here. Clients can message you from the
                  same project link.
                </p>
              </div>
            )}
          </div>
        </aside>
        <section
          className="support-conversation"
          aria-label="Client conversation"
        >
          {selected ? (
            <>
              <header>
                <button
                  className="support-back studio-icon-button"
                  aria-label="Back to conversations"
                  onClick={() => {
                    setSelected("");
                    setSearch({}, { replace: true });
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2>
                    {current?.quote.clientName || "Loading conversation…"}
                  </h2>
                  <p>{current?.quote.title}</p>
                </div>
                <div className="support-context-links">
                  {current?.quote.invoiceId && (
                    <Link to={"/admin/invoices/" + current.quote.invoiceId}>
                      Invoice <ArrowUpRight size={13} />
                    </Link>
                  )}
                  {current?.clientUrl && (
                    <a
                      href={current.clientUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Client page <ArrowUpRight size={13} />
                    </a>
                  )}
                </div>
              </header>
              {threadError && (
                <p className="studio-error" role="alert">
                  {threadError}
                </p>
              )}
              <div className="support-message-list" aria-live="polite">
                {current?.nextCursor && (
                  <button
                    className="support-earlier"
                    disabled={olderBusy}
                    onClick={older}
                  >
                    {olderBusy ? "Loading…" : "Load earlier messages"}
                  </button>
                )}
                {current ? (
                  current.messages.length ? (
                    current.messages.map((message) => (
                      <article key={message._id} className={message.author}>
                        <strong>
                          {message.author === "studio"
                            ? "Studio team"
                            : current.quote.clientName}
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
                    <div className="support-empty">
                      <MessageSquare size={28} />
                      <h3>Start the conversation</h3>
                      <p>
                        Your reply will be visible on the client’s project page.
                      </p>
                    </div>
                  )
                ) : (
                  !threadError && (
                    <p className="support-empty" role="status">
                      Loading messages…
                    </p>
                  )
                )}
              </div>
              <form className="support-composer" onSubmit={send}>
                <label htmlFor="studio-support-reply">Reply to client</label>
                <textarea
                  id="studio-support-reply"
                  disabled={sending || !current}
                  rows={3}
                  maxLength={2000}
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    requestId.current = "";
                  }}
                  placeholder="Write a helpful reply…"
                />
                {sendError && (
                  <p className="studio-error" role="alert">
                    {sendError}
                  </p>
                )}
                <div>
                  <small>
                    Visible to the client on their project link · {text.length}
                    /2,000
                  </small>
                  <button
                    className="studio-button primary"
                    disabled={sending || !current || !text.trim()}
                  >
                    {sending ? "Sending…" : "Send reply"}
                    <Send size={15} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="support-empty">
              <MessageSquare size={34} />
              <h3>One conversation per project</h3>
              <p>Select a client to read their messages and reply.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
