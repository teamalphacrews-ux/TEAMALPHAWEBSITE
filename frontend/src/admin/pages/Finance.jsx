import StudioIcon from '../components/common/StudioIcon';
import StudioSelect from '../components/common/StudioSelect';
import { useEffect, useState, useRef } from "react";
import {
  Plus,
  FileText,
  ArrowUpRight,
  Wallet, CreditCard,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStudioIdentity } from '../../utils/studioIdentity';
import { formatStudioDate, studioDayKey, studioTimezone } from '../../utils/studioTime';
import { invoiceDueQueue, invoiceOutstandingBalance } from '../components/finance/duePayments';
import DuePayments from '../components/finance/DuePayments.jsx';
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
  rupees,
} from "../components/operations/workspaceData";
import { remainingAmount } from "../components/studio/leadUtils";
import { FinanceInsights, ExpenseBreakdown } from "../components/finance/FinanceInsights";
import { bookingCollections } from "../components/operations/insightData";
import API from '../../utils/apiConfig';
import ReceiptCapture from '../components/finance/ReceiptCapture';
import {WorkspaceActionMenu} from '../components/operations/WorkspaceActionMenu';
import {useAuth} from '../../context/AuthContext';
export default function Finance() {
  const navigate=useNavigate();
  const {token}=useAuth();
  const [receiptFile,setReceiptFile]=useState(null),[openingReceipt,setOpeningReceipt]=useState('');
  const expenseRequest=useRef(''),saveLock=useRef(false);
  const [params, setParams] = useSearchParams();
  const tab = ['due', 'invoices', 'ledger'].includes(params.get('view')) ? params.get('view') : 'bookings';
  const setTab = value => setParams(current => { const next = new URLSearchParams(current); next.set('view', value); return next; });
  const { identity } = useStudioIdentity();
  const timezone = studioTimezone(identity?.timezone);
  const recordDate = value => formatStudioDate(value, {}, timezone);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/finance",
    "/api/invoices",
    "/api/studio-projects",
  ]);
  const { leads = [], entries = [] } = data[0] || {};
  const invoices = data[1] || [];
  const projects=data[2]||[];
  const collections = bookingCollections(leads);
  const [query, setQuery] = useState(""),
    [entry, setEntry] = useState(undefined),
    [form, setForm] = useState({}),
    [payment, setPayment] = useState(null),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [updatingInvoice, setUpdatingInvoice] = useState(""),
    [deleting, setDeleting] = useState(null);
  const bookings = leads.filter((lead) => lead.status === "Converted");
  const dueRows = invoiceDueQueue(invoices, now, timezone);
  const paidExpenses = entries.filter(
    (row) => row.type === "expense" && row.status === "Paid",
  );
  const sum = (rows, key) =>
    rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const invoiceBalance = invoiceOutstandingBalance;
  const openEntry = (row) => {
    setReceiptFile(null);
    setEntry(row || null);
    setForm(
      row
        ? {
            title: row.description,
            studioProjectId:row.studioProjectId||"",
            amount: row.amount,
            category: row.category,
            date: studioDayKey(row.date, timezone),
            type: row.type,
            status: row.status,
          }
        : {
            title: "",
            studioProjectId:"",
            amount: "",
            category: "Operational",
            date: studioDayKey(now, timezone),
            type: "expense",
            status: "Paid",
          },
    );
    setSaveError("");
  };
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  useEffect(()=>{
    if(params.get('new')!=='expense'||expenseRequest.current===params.toString())return;
    const signature=params.toString();let active=true;Promise.resolve().then(()=>{if(active){expenseRequest.current=signature;openEntry(null);}});return()=>{active=false;};
    // New-entry defaults follow the current studio date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[params,timezone]);
  const closeEntry=()=>{setEntry(undefined);setReceiptFile(null);setParams(current=>{const next=new URLSearchParams(current);next.delete('new');return next;},{replace:true});expenseRequest.current='';};
  const saveEntry=async event=>{
    event.preventDefault();if(saveLock.current)return;saveLock.current=true;setBusy(true);setSaveError('');
    let record=entry;
    try{
      record=await workspaceRequest(entry?'put':'post',entry?'/api/studio/ledger/'+entry._id:'/api/studio/ledger',{...form,amount:String(form.amount)});
      if(!record?._id)throw new Error('The server did not confirm the transaction.');
      setEntry(record);
      if(receiptFile&&form.type==='expense'){
        const body=new FormData();body.append('receipt',receiptFile,'receipt.jpg');
        const response=await fetch(API+'/api/studio/ledger/'+record._id+'/receipt',{method:'POST',headers:{Authorization:'Bearer '+token},body});
        if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Receipt upload failed. The expense is saved; retry to attach its photo.');}
      }
      closeEntry();reload();toast.success('Transaction saved');
    }catch(err){if(record?._id){setEntry(record);reload();setSaveError('The expense is saved. '+(err.message||recordError(err))+' Retry here to update this same record.');}else setSaveError(recordError(err));}
    finally{setBusy(false);saveLock.current=false;}
  };
  const viewReceipt=async row=>{
    if(openingReceipt)return;setOpeningReceipt(row._id);
    try{
      const response=await fetch(API+'/api/studio/ledger/'+row._id+'/receipt',{headers:{Authorization:'Bearer '+token}});
      if(!response.ok)throw new Error('Receipt could not be loaded.');
      const file=await response.blob(),name='receipt-'+row._id+'.'+(file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg');
      if(window.StudioOSNative?.saveFile)await window.StudioOSNative.saveFile(file,name);
      else{const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    }catch(err){toast.error(err.message);}finally{setOpeningReceipt('');}
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
    if (updatingInvoice || status === row.status) return;
    setUpdatingInvoice(row._id);
    try {
      await workspaceRequest("put", "/api/invoices/" + row._id, { status });
      reload();
      toast.success("Invoice status updated");
    } catch (err) {
      toast.error(recordError(err));
    } finally {
      setUpdatingInvoice("");
    }
  };
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
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div>
      <WorkspaceHeader
        eyebrow="A CONSIDERED VIEW OF YOUR BUSINESS"
        title="Finance"
        description="Bookings, invoices and your cash ledger, each with a clear purpose."
      >
        <button className="studio-button" onClick={() => navigate("/admin/invoices/new")}>
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
            value: rupees(collections.received),
            note: "CRM payment records only",
          },
          {
            label: "Booking balances",
            value: rupees(collections.remaining),
            note: "Confirmed enquiry balances",
          },
          {
            label: "Paid expenses",
            value: rupees(expenseTotal),
            note: "From your cash ledger",
          },
          {
            label: "Due now",
            value: <Link className="finance-due-summary-link" to="/admin/finance?view=due" aria-label="Review invoice payments due now">{rupees(dueRows.reduce((sum, row) => sum + Math.round(row.amountDue * 100), 0) / 100)}<ArrowUpRight size={17} /></Link>,
            note: "Issued INR invoices · today & overdue",
          },
        ]}
      />
      <WorkspaceError error={error} retry={reload} />
      <details className="finance-balance-explainer"><summary><Wallet size={16} />How balances work</summary>
        <p>
          Booking and invoice balances are shown separately to avoid counting
          the same client payment twice. Ledger totals reflect only the
          transactions entered there.
        </p>
      </details>
      <div className={tab === 'due' ? 'finance-due-layout' : 'workspace-two-column'}>
        <section className="studio-card">
          <div className="studio-phone-filter finance-view-filter"><StudioSelect aria-label="View finance records" value={tab} onChange={event=>{setTab(event.target.value);setQuery("");}}>{[["bookings","Booking payments"],["due","Due now"],["invoices","Invoices"],["ledger","Cash ledger"]].map(([key,label])=><option key={key} value={key}>{label}</option>)}</StudioSelect></div><div className="studio-tabs finance-register-tabs">
            {[
              ["bookings", "Booking payments"],
              ["due", "Due now"],
              ["invoices", "Invoices"],
              ["ledger", "Cash ledger"],
            ].map(([key, label]) => (
              <button
                className={tab === key ? "active" : ""}
                aria-pressed={tab === key}
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
          {tab === 'due' ? <DuePayments rows={dueRows} loading={loading || (!!error && !data.length)} query={query} timezone={timezone} /> : loading || !visible.length ? (
            <WorkspaceEmpty
              loading={loading}
              title={query.trim() ? "No matching financial records" : "A clear ledger starts here"}
              description={query.trim() ? "Try another client, category or status." : "Your existing studio records will appear in this view."}
            />
          ) : (
            <div className="studio-table-wrap">
              <table role="table" aria-label="Financial records" className="studio-table studio-phone-record-table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th role="columnheader">{tab === "ledger" ? "Transaction" : "Client"}</th>
                    <th role="columnheader">{tab === "ledger" ? "Amount" : "Total"}</th>
                    <th role="columnheader">{tab === "ledger" ? "Date" : "Balance"}</th>
                    <th role="columnheader">Status</th>
                    <th role="columnheader">Actions</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {visible.map((row) => (
                    <tr role="row" key={row._id}>
                      <td role="cell" data-label="Record">
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
                      <td role="cell" data-label={tab === "ledger" ? "Amount" : "Total"}>
                        {rupees(
                          tab === "ledger"
                            ? row.amount
                            : tab === "bookings"
                              ? row.totalAmount
                              : row.total,
                        )}
                      </td>
                      <td role="cell" data-label={tab === "ledger" ? "Date" : "Balance"}>
                        {tab === "ledger"
                          ? recordDate(row.date)
                          : rupees(
                              tab === "bookings"
                                ? remainingAmount(row)
                                : invoiceBalance(row),
                            )}
                      </td>
                      <td role="cell" data-label="Status">
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
                          {tab === "invoices" && row.documentStatus === "Sent" && row.status === "Paid" && <StudioIcon icon={CreditCard} size={16} status="success" label="Payment recorded as paid" />}
                          {row.documentStatus === "Draft" ? "Draft" : row.documentStatus === "Cancelled" ? "Cancelled" : row.paymentStatus || row.status}
                        </span>
                        {tab === "invoices" && (
                          <StudioSelect
                            className="studio-input workspace-invoice-status"
                            aria-label={"Invoice status for " + row.clientName}
                            disabled={Boolean(updatingInvoice) || ["Draft", "Cancelled"].includes(row.documentStatus)}
                            value={row.status}
                            onChange={(e) => invoiceStatus(row, e.target.value)}
                          >
                            {["Pending", "Paid", "Cancelled"].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </StudioSelect>
                        )}
                      </td>
                      <td role="cell" data-label="Actions">
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
                            onClick={() => navigate("/admin/invoices/"+row._id)}
                          >
                            <ArrowUpRight size={15} /><span className="studio-phone-action-label">Open invoice</span>
                          </button>
                        ) : row.type === "expense" ? (
                          <WorkspaceActionMenu label="Expense options">
                            <button type="button" onClick={()=>openEntry(row)}>Edit expense / receipt</button>
                            {row.receipt?.bytes>0&&<button type="button" disabled={Boolean(openingReceipt)} onClick={()=>viewReceipt(row)}>View receipt</button>}
                            <button type="button" onClick={()=>{setDeleting(row);setSaveError('');}}>Remove expense</button>
                          </WorkspaceActionMenu>
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
        {tab !== 'due' && <aside className="workspace-rail">
          <ExpenseBreakdown entries={entries} loading={loading} onCategory={category => { setTab("ledger"); setQuery(category); }} />
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
        </aside>}
      </div>
      {tab!=='due'&&<details className="studio-card finance-analysis-disclosure"><summary>Business insights & trends</summary><FinanceInsights entries={entries} leads={leads} loading={loading||!!error}/></details>}
      {entry !== undefined && (
        <WorkspaceDialog
          title={entry ? "Edit expense" : "Record a transaction"}
          onClose={closeEntry}
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
                options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]}
              />
            )}
            {form.type==='expense'&&<WorkspaceField label="Project (optional)" name="studioProjectId" value={form.studioProjectId||''} onChange={change} options={[{value:'',label:'Studio overhead'},...projects.map(project=>({value:project._id,label:project.name}))]}/>}
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
          {form.type==='expense'&&<ReceiptCapture file={receiptFile} onChange={setReceiptFile} disabled={busy} existing={Boolean(entry?.receipt?.bytes)}/>}
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

    </div>
  );
}
