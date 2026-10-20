import { Link } from "react-router-dom";
import { recordDate, rupees } from "../operations/workspaceData";
import { contactPaymentTotals } from "./contactPaymentTotals";
export function ContactDocuments({
  quotations = [],
  invoices = [],
  documents = [],
  onDraft,
}) {
  const rows = [
    ...quotations.map((item) => ({
      ...item,
      label:
        (item.documentNumber ? `Quote #${item.documentNumber} · ` : "") +
        item.title,
      kind: "Quote",
      amount: rupees(item.totalPaise / 100),
      url: "/admin/quotations?quote=" + item._id,
    })),
    ...invoices.map((item) => ({
      ...item,
      label:
        "Invoice" +
        (item.invoiceNumber || item.documentNumber
          ? ` #${item.invoiceNumber || item.documentNumber}`
          : " · " + item.clientName),
      status: item.documentStatus || item.status,
      kind: "Invoice",
      amount: rupees(item.total),
      url: "/admin/invoices/" + item._id,
    })),
    ...documents
      .filter((item) => item.type !== "Message")
      .map((item) => ({
        ...item,
        label: item.title,
        kind: item.type,
        amount: "—",
      })),
  ];
  return rows.length ? (
    <div className="reference-table-scroll">
      <table className="reference-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={`${item.kind}-${item._id}`}>
              <td>
                {item.url ? (
                  <Link className="reference-green-link" to={item.url}>
                    {item.label}
                  </Link>
                ) : (
                  <button
                    className="reference-text-button"
                    onClick={() => onDraft(item)}
                  >
                    {item.label}
                  </button>
                )}
              </td>
              <td>{item.kind}</td>
              <td>
                <span className="reference-status neutral">{item.status}</span>
              </td>
              <td>{item.amount}</td>
              <td>{recordDate(item.createdAt || item.invoiceDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="reference-empty">
      No documents yet. Create an invoice, quote, contract, or questionnaire.
    </p>
  );
}
export function ContactPayments({ invoices = [] }) {
  const issued = invoices.filter(
    (item) =>
      !["Draft", "Cancelled", "Archived"].includes(item.documentStatus) &&
      item.status !== "Cancelled",
  );
  return issued.length ? (
    <div className="reference-table-scroll">
      <table className="reference-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Total</th>
            <th>Advance recorded</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {issued.map((item) => (
            <tr key={item._id}>
              <td>
                <Link
                  className="reference-green-link"
                  to={`/admin/invoices/${item._id}`}
                >
                  {item.invoiceNumber || item.documentNumber || item.clientName}
                </Link>
              </td>
              <td>{rupees(item.total)}</td>
              <td>{rupees(item.advancePaid)}</td>
              <td>
                {rupees(
                  item.status === "Paid"
                    ? 0
                    : Math.max(0, (item.total || 0) - (item.advancePaid || 0)),
                )}
              </td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="reference-empty">
      No issued invoices or payment records for this contact yet.
    </p>
  );
}
export function ContactPaymentSummary({ invoices = [] }) {
  const totals = contactPaymentTotals(invoices);
  return (
    <div className="reference-payment-summary">
      {[
        ["Paid", totals.paid],
        ["Upcoming", totals.upcoming],
        ["Past due", totals.pastDue],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{rupees(value)}</strong>
        </div>
      ))}
    </div>
  );
}
export function ContactSessions({ sessions = [] }) {
  return sessions.length ? (
    <div className="reference-list">
      {sessions.map((item) => (
        <Link
          to="/admin/calendar"
          className="reference-list-row"
          key={item._id}
        >
          <span>
            <strong>{item.title}</strong>
            <small>
              {recordDate(item.start)} ·{" "}
              {new Date(item.start).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              })}
              {item.location ? " · " + item.location : ""}
            </small>
          </span>
          <span className="reference-status neutral">{item.type}</span>
        </Link>
      ))}
    </div>
  ) : (
    <p className="reference-empty">No sessions scheduled yet.</p>
  );
}
export function ContactConversations({ documents = [], onDraft }) {
  const messages = documents.filter((item) => item.type === "Message");
  return messages.length ? (
    <div className="reference-list">
      {messages.map((item) => (
        <button
          className="reference-list-row"
          key={item._id}
          onClick={() => onDraft(item)}
        >
          <span>
            <strong>{item.title}</strong>
            <small>{item.content.slice(0, 110) || "No message text yet"}</small>
          </span>
          <span className="reference-status neutral">Draft</span>
        </button>
      ))}
    </div>
  ) : (
    <p className="reference-empty">No conversations from this contact yet.</p>
  );
}
