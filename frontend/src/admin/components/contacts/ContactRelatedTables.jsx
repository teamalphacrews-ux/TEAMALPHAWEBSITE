import {useStudioPreferences} from '../common/StudioPreferences';
import {useStudioIdentity} from '../../../utils/studioIdentity';
import {formatWorkspaceDate,formatWorkspaceTime,resolveWorkspaceTimezone} from '../../../utils/workspaceLocale';
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { recordDate, rupees } from "../operations/workspaceData";
import { contactPaymentTotals } from "./contactPaymentTotals";
import { quotationStatus } from "../../../utils/quotationStatus";
export function ContactDocuments({
  quotations = [],
  invoices = [],
  documents = [],
  onDraft,
}) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  const rows = [
    ...quotations.map((item) => ({
      ...item,
      label:
        (item.documentNumber ? `Quote #${item.documentNumber} · ` : "") +
        item.title,
      kind: "Quote",
      status: quotationStatus(item, clock),
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
      <table role="table" aria-label="Client documents" className="reference-table studio-phone-record-table studio-phone-detail-table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">Document</th>
            <th role="columnheader">Type</th>
            <th role="columnheader">Status</th>
            <th role="columnheader">Amount</th>
            <th role="columnheader">Created</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((item) => (
            <tr role="row" key={`${item.kind}-${item._id}`}>
              <td role="cell" data-label="Document">
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
              <td role="cell" data-label="Type">{item.kind}</td>
              <td role="cell" data-label="Status">
                <span className="reference-status neutral">{item.status}</span>
              </td>
              <td role="cell" data-label="Amount">{item.amount}</td>
              <td role="cell" data-label="Created">{recordDate(item.createdAt || item.invoiceDate)}</td>
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
      <table role="table" aria-label="Client payments" className="reference-table studio-phone-record-table studio-phone-detail-table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">Invoice</th>
            <th role="columnheader">Total</th>
            <th role="columnheader">Advance recorded</th>
            <th role="columnheader">Balance</th>
            <th role="columnheader">Status</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {issued.map((item) => (
            <tr role="row" key={item._id}>
              <td role="cell" data-label="Invoice">
                <Link
                  className="reference-green-link"
                  to={`/admin/invoices/${item._id}`}
                >
                  {item.invoiceNumber || item.documentNumber || item.clientName}
                </Link>
              </td>
              <td role="cell" data-label="Total">{rupees(item.total)}</td>
              <td role="cell" data-label="Advance recorded">{rupees(item.advancePaid)}</td>
              <td role="cell" data-label="Balance">
                {rupees(
                  item.status === "Paid"
                    ? 0
                    : Math.max(0, (item.total || 0) - (item.advancePaid || 0)),
                )}
              </td>
              <td role="cell" data-label="Status">{item.status}</td>
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
  const {preferences}=useStudioPreferences(),{identity}=useStudioIdentity(),timezone=resolveWorkspaceTimezone(preferences,identity?.timezone);
  return sessions.length ? (
    <div className="reference-list">
      {sessions.map((item) => (
        <Link
          to={'/admin/calendar?event='+item._id}
          className="reference-list-row"
          key={item._id}
        >
          <span>
            <strong>{item.title}</strong>
            <small>
              {formatWorkspaceDate(item.start,preferences,timezone)} ·{" "}
              {item.allDay?'All day':formatWorkspaceTime(item.start,preferences,timezone)} · {timezone}
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
