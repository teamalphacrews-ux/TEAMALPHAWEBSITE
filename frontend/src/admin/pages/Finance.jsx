import { useState } from "react";
import {
  Plus,
  FileText,
  ArrowUpRight,
  Pencil,
  Wallet,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import InvoiceForm from "../components/crm/InvoiceForm";
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
import { paidAmount, remainingAmount } from "../components/studio/leadUtils";
export default function Finance() {
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/finance",
  ]);
  const { leads = [], invoices = [], entries = [] } = data[0] || {};
  const [tab, setTab] = useState("bookings"),
    [query, setQuery] = useState(""),
    [entry, setEntry] = useState(undefined),
    [form, setForm] = useState({}),
    [payment, setPayment] = useState(null),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [invoice, setInvoice] = useState(undefined),
    [deleting, setDeleting] = useState(null);
  const bookings = leads.filter((lead) => lead.status === "Converted");
  const paidExpenses = entries.filter(
    (row) => row.type === "expense" && row.status === "Paid",
  );
  const sum = (rows, key) =>
    rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const invoiceBalance = (row) =>
    row.status === "Paid" || row.status === "Cancelled"
      ? 0
      : Math.max(0, (row.total || 0) - (row.advancePaid || 0));
  const openEntry = (row) => {
    setEntry(row || null);
    setForm(
      row
        ? {
            title: row.description,
            amount: row.amount,
            category: row.category,
            date: new Date(row.date).toISOString().slice(0, 10),
            type: row.type,
            status: row.status,
          }
        : {
            title: "",
            amount: "",
            category: "Operational",
            date: new Date().toISOString().slice(0, 10),
            type: "expense",
            status: "Paid",
          },
    );
    setSaveError("");
  };
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const saveEntry = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      await workspaceRequest(
        entry ? "put" : "post",
        entry ? "/api/studio/ledger/" + entry._id : "/api/studio/ledger",
        { ...form, amount: String(form.amount) },
      );
      setEntry(undefined);
      reload();
      toast.success("Ledger record saved");
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const savePayment = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const totalAmount = Number(form.totalAmount),
        depositAmount = Number(form.depositAmount);
      if (totalAmount < 0 || depositAmount < 0 || depositAmount > totalAmount)
        throw new Error("Deposit must be between zero and the project value.");
      await workspaceRequest(
        "patch",
        "/api/studio/booking-payments/" + payment._id,
        {
          paymentStatus: form.paymentStatus,
          totalAmount,
          depositAmount,
        },
      );
      setPayment(null);
      reload();
      toast.success("Booking payment record saved");
    } catch (err) {
      setSaveError(
        err.message === "Deposit must be between zero and the project value."
          ? err.message
          : recordError(err),
      );
    } finally {
      setBusy(false);
    }
  };
  const removeExpense = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await workspaceRequest("delete", "/api/studio/ledger/" + deleting._id);
      setDeleting(null);
      reload();
      toast.success("Expense removed");
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const invoiceStatus = async (row, status) => {
    try {
      await workspaceRequest("put", "/api/invoices/" + row._id, { status });
      reload();
      toast.success("Invoice status updated");
    } catch (err) {
      toast.error(recordError(err));
    }
  };
  const categories = paidExpenses.reduce(
    (map, row) => ({
      ...map,
      [row.category || "Other"]:
        (map[row.category || "Other"] || 0) + row.amount,
    }),
    {},
  );
  const expenseTotal = sum(paidExpenses, "amount");
  const visible = (
    tab === "bookings" ? bookings : tab === "invoices" ? invoices : entries
  ).filter((row) =>
    [
      row.name,
      row.clientName,
      row.description,
      row.category,
      row.status,
      row.paymentStatus,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <WorkspaceHeader
        eyebrow="A CONSIDERED VIEW OF YOUR BUSINESS"
        title="Financial clarity."
        description="Bookings, invoices and your cash ledger, each with a clear purpose."
      >
        <button className="studio-button" onClick={() => setInvoice(null)}>
          <FileText size={14} />
          New invoice
        </button>
        <button
          className="studio-button primary"
          onClick={() => openEntry(null)}
        >
          <Plus size={14} />
          Record transaction
        </button>
      </WorkspaceHeader>
      <WorkspaceMetrics
        loading={loading || (!!error && !data.length)}
        items={[
          {
            label: "Received on bookings",
            value: rupees(bookings.reduce((s, l) => s + paidAmount(l), 0)),
            note: "CRM payment records only",
          },
          {
            label: "Booking balances",
            value: rupees(bookings.reduce((s, l) => s + remainingAmount(l), 0)),
            note: "Confirmed enquiry balances",
          },
          {
            label: "Paid expenses",
            value: rupees(expenseTotal),
            note: "From your cash ledger",
          },
          {
            label: "Invoice balances",
            value: rupees(invoices.reduce((s, i) => s + invoiceBalance(i), 0)),
            note: "Separate from booking balances",
          },
        ]}
      />
      <WorkspaceError error={error} retry={reload} />
      <div className="workspace-info">
        <Wallet size={16} />
        <p>
          Booking and invoice balances are shown separately to avoid counting
          the same client payment twice. Ledger totals reflect only the
          transactions entered there.
        </p>
      </div>
      <div className="workspace-two-column">
        <section className="studio-card">
          <div className="studio-tabs">
            {[
              ["bookings", "Booking payments"],
              ["invoices", "Invoices"],
              ["ledger", "Cash ledger"],
            ].map(([key, label]) => (
              <button
                className={tab === key ? "active" : ""}
                key={key}
                onClick={() => {
                  setTab(key);
                  setQuery("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="studio-toolbar">
            <WorkspaceSearch
              value={query}
              onChange={setQuery}
              placeholder="Search financial records…"
            />
          </div>
          {loading || !visible.length ? (
            <WorkspaceEmpty
              loading={loading}
              title="A clear ledger starts here"
              description="Your existing studio records will appear in this view."
            />
          ) : (
            <div className="studio-table-wrap">
              <table className="studio-table">
                <thead>
                  <tr>
                    <th>{tab === "ledger" ? "Transaction" : "Client"}</th>
                    <th>{tab === "ledger" ? "Amount" : "Total"}</th>
                    <th>{tab === "ledger" ? "Date" : "Balance"}</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <strong>
                          {row.name || row.clientName || row.description}
                        </strong>
                        <small>
                          {tab === "ledger"
                            ? row.type + " · " + row.category
                            : tab === "bookings"
                              ? recordDate(row.eventDate)
                              : recordDate(row.invoiceDate)}
                        </small>
                      </td>
                      <td>
                        {rupees(
                          tab === "ledger"
                            ? row.amount
                            : tab === "bookings"
                              ? row.totalAmount
                              : row.total,
                        )}
                      </td>
                      <td>
                        {tab === "ledger"
                          ? recordDate(row.date)
                          : rupees(
                              tab === "bookings"
                                ? remainingAmount(row)
                                : invoiceBalance(row),
                            )}
                      </td>
                      <td>
                        <span
                          className={
                            "studio-badge " +
                            (["Paid", "Received"].includes(
                              row.status || row.paymentStatus,
                            )
                              ? "green"
                              : "gold")
                          }
                        >
                          {row.paymentStatus || row.status}
                        </span>
                        {tab === "invoices" && (
                          <select
                            className="studio-input workspace-invoice-status"
                            aria-label={"Invoice status for " + row.clientName}
                            value={row.status}
                            onChange={(e) => invoiceStatus(row, e.target.value)}
                          >
                            {["Pending", "Paid", "Cancelled"].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {tab === "bookings" ? (
                          <button
                            className="studio-button small"
                            onClick={() => {
                              setPayment(row);
                              setForm({
                                paymentStatus: row.paymentStatus,
                                totalAmount: row.totalAmount,
                                depositAmount: row.depositAmount,
                              });
                              setSaveError("");
                            }}
                          >
                            Record payment
                          </button>
                        ) : tab === "invoices" ? (
                          <button
                            className="studio-icon-button"
                            aria-label={"View invoice " + row.clientName}
                            onClick={() => setInvoice(row)}
                          >
                            <ArrowUpRight size={15} />
                          </button>
                        ) : row.type === "expense" ? (
                          <>
                            <button
                              className="studio-icon-button"
                              aria-label={"Edit expense " + row.description}
                              onClick={() => openEntry(row)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="studio-icon-button"
                              aria-label={"Remove expense " + row.description}
                              onClick={() => {
                                setDeleting(row);
                                setSaveError("");
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="studio-muted">Receipt</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="workspace-rail">
          <section className="studio-card">
            <h2 className="studio-section-title">Expense allocation</h2>
            <p className="studio-card-subtitle">
              Paid cash-ledger expenses by category.
            </p>
            {Object.entries(categories)
              .sort((a, b) => b[1] - a[1])
              .map(([label, value]) => (
                <div className="workspace-allocation" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{rupees(value)}</strong>
                  </div>
                  <div className="workspace-progress">
                    <span
                      style={{
                        width:
                          (expenseTotal ? (value / expenseTotal) * 100 : 0) +
                          "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            {!paidExpenses.length && (
              <WorkspaceEmpty
                title="No paid expenses yet"
                description="Record expenses to see the allocation."
              />
            )}
          </section>
          <section className="studio-card">
            <h2 className="studio-section-title">Cash ledger snapshot</h2>
            <p className="studio-card-subtitle">
              Manual ledger receipts and payments.
            </p>
            <dl className="workspace-summary">
              <dt>Received income</dt>
              <dd>
                {rupees(
                  sum(
                    entries.filter(
                      (r) =>
                        r.type === "income" &&
                        ["Received", "Paid"].includes(r.status),
                    ),
                    "amount",
                  ),
                )}
              </dd>
              <dt>Paid expenses</dt>
              <dd>{rupees(expenseTotal)}</dd>
            </dl>
            <p className="studio-muted">
              Updating a booking payment records its CRM status. Add a ledger
              receipt separately when using the cash ledger.
            </p>
          </section>
        </aside>
      </div>
      {entry !== undefined && (
        <WorkspaceDialog
          title={entry ? "Edit expense" : "Record a transaction"}
          onClose={() => setEntry(undefined)}
          onSubmit={saveEntry}
          busy={busy}
          error={saveError}
        >
          <div className="studio-form-grid">
            {!entry && (
              <WorkspaceField
                label="Transaction type"
                name="type"
                value={form.type}
                onChange={(name, value) =>
                  setForm((c) => ({
                    ...c,
                    [name]: value,
                    status: value === "income" ? "Received" : "Paid",
                  }))
                }
                options={["expense", "income"]}
              />
            )}
            <WorkspaceField
              label="Description"
              name="title"
              value={form.title}
              onChange={change}
              required
            />
            <WorkspaceField
              label="Amount (₹)"
              name="amount"
              value={form.amount}
              onChange={change}
              type="number"
              min="0.01"
              step="0.01"
              required
            />
            <WorkspaceField
              label="Category"
              name="category"
              value={form.category}
              onChange={change}
              required
            />
            <WorkspaceField
              label="Date"
              name="date"
              value={form.date}
              onChange={change}
              type="date"
              required
            />
            <WorkspaceField
              label="Status"
              name="status"
              value={form.status}
              onChange={change}
              options={
                form.type === "income"
                  ? ["Received", "Pending"]
                  : ["Paid", "Pending"]
              }
            />
          </div>
        </WorkspaceDialog>
      )}
      {payment && (
        <WorkspaceDialog
          title={"Payment record · " + payment.name}
          onClose={() => setPayment(null)}
          onSubmit={savePayment}
          busy={busy}
          error={saveError}
        >
          <div className="studio-form-grid">
            <WorkspaceField
              label="Project value (₹)"
              name="totalAmount"
              value={form.totalAmount}
              onChange={change}
              type="number"
              min="0"
              step="0.01"
              required
            />
            <WorkspaceField
              label="Deposit received (₹)"
              name="depositAmount"
              value={form.depositAmount}
              onChange={change}
              type="number"
              min="0"
              step="0.01"
              required
            />
            <WorkspaceField
              wide
              label="Payment status"
              name="paymentStatus"
              value={form.paymentStatus}
              onChange={change}
              options={["Unpaid", "Deposit Paid", "Paid"]}
            />
          </div>
          <p className="studio-muted">
            This updates the booking record. No money is transferred.
          </p>
        </WorkspaceDialog>
      )}
      {deleting && (
        <WorkspaceDialog
          title="Remove this expense?"
          onClose={() => setDeleting(null)}
          onSubmit={removeExpense}
          busy={busy}
          error={saveError}
          submitLabel="Remove expense"
        >
          <p>
            {deleting.description} will be permanently removed from the cash
            ledger.
          </p>
        </WorkspaceDialog>
      )}
      {invoice !== undefined && (
        <InvoiceForm
          initialData={invoice}
          onClose={() => {
            setInvoice(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}
