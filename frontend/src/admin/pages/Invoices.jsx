import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import StudioSelect from '../components/common/StudioSelect';
import { useWorkspaceData } from '../components/operations/workspaceData';
import { WorkspaceHeader, WorkspaceSearch, WorkspaceError, WorkspaceEmpty } from '../components/operations/WorkspaceUI';
import { useStudioIdentity } from '../../utils/studioIdentity';
import { formatStudioDate, studioDayBounds, studioTimezone } from '../../utils/studioTime';
import { filterInvoiceRegister, invoiceRegisterEntries } from '../components/finance/invoiceRegister';
import './invoiceRegister.css';

const amount = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency || '') ? currency : 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function Invoices() {
  const { data, loading, error, reload } = useWorkspaceData(['/api/invoices']);
  const { identity } = useStudioIdentity();
  const timezone = studioTimezone(identity?.timezone);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('overdue');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const entries = useMemo(() => invoiceRegisterEntries(data[0] || [], now, timezone), [data, now, timezone]);
  const rows = filterInvoiceRegister(entries, { query, filter, sort });
  const overdueCount = entries.filter(row => row.state === 'overdue').length;
  const filtered = !!query.trim() || filter !== 'all';
  const date = value => formatStudioDate(value, { day: 'numeric', month: 'short', year: 'numeric' }, timezone);
  const dueDate = key => date(studioDayBounds(key, timezone).start);
  const clearFilters = () => { setQuery(''); setFilter('all'); };

  return <div className="invoice-register-page">
    <WorkspaceHeader title="Invoices" description="Prepare and manage client invoices.">
      <Link className="studio-button primary" to="/admin/invoices/new"><Plus size={16} />New invoice</Link>
    </WorkspaceHeader>
    <WorkspaceError error={error} retry={reload} />
    <section className="studio-card invoice-register" aria-label="Invoice register">
      <div className="invoice-register-heading"><div><h2>Invoice register</h2><p>{loading ? 'Loading invoices…' : `${entries.length} ${entries.length === 1 ? 'invoice' : 'invoices'}`}{!loading && overdueCount > 0 && <span> · {overdueCount} overdue</span>}</p></div><span className="invoice-register-zone">Due dates in {timezone}</span></div>
      <div className="studio-toolbar invoice-register-toolbar">
        <WorkspaceSearch value={query} onChange={setQuery} placeholder="Find an invoice or client…" />
        <StudioSelect aria-label="Filter invoices" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">All invoices</option><option value="outstanding">Outstanding balances</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="upcoming">Upcoming payments</option><option value="unscheduled">No due date</option><option value="paid">Paid</option><option value="draft">Drafts</option>
        </StudioSelect>
        <StudioSelect aria-label="Sort invoices" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="overdue">Overdue first</option><option value="due">Due date: earliest</option><option value="newest">Newest invoice</option><option value="balance">Balance: high to low</option>
        </StudioSelect>
      </div>
      {loading ? <WorkspaceEmpty loading /> : error && !entries.length ? <WorkspaceEmpty title="Invoices unavailable" description="Retry the connection to load your invoice register." /> : rows.length ? <div className="studio-table-wrap invoice-register-scroll"><table role="table" className="studio-table studio-phone-record-table invoice-register-table" aria-label="Client invoices">
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Invoice</th><th role="columnheader" scope="col">Client</th><th role="columnheader" scope="col">Document</th><th role="columnheader" scope="col">Payment</th><th role="columnheader" scope="col">Total</th><th role="columnheader" scope="col">Balance due</th><th role="columnheader" scope="col">Next due</th></tr></thead>
        <tbody role="rowgroup">{rows.map(({ invoice, documentStatus, paymentStatus, balance, nextDue, daysOverdue, state }) => <tr role="row" key={invoice._id}>
          <td role="cell" data-label="Invoice" className="invoice-register-reference"><Link to={'/admin/invoices/' + invoice._id}>{invoice.invoiceNumber || invoice.documentNumber || 'Draft invoice'}<ArrowUpRight size={13} aria-hidden="true" /></Link><small>{date(invoice.invoiceDate || invoice.createdAt)}</small></td>
          <td role="cell" data-label="Client" className="invoice-register-client"><strong>{invoice.clientName}</strong>{invoice.title && <small>{invoice.title}</small>}</td>
          <td role="cell" data-label="Document"><span className="studio-badge">{documentStatus === 'Sent' ? 'Issued' : documentStatus}</span></td>
          <td role="cell" data-label="Payment"><span className={'studio-badge' + (state === 'paid' ? ' green' : '')}>{paymentStatus}</span></td>
          <td role="cell" data-label="Total" className="invoice-register-money">{amount(invoice.total, invoice.currency)}</td>
          <td role="cell" data-label="Balance due" className="invoice-register-money"><strong>{state === 'inactive' ? '—' : amount(balance, invoice.currency)}</strong></td>
          <td role="cell" data-label="Next due" className="invoice-register-deadline">{nextDue?.dueDate ? <><strong>{dueDate(nextDue.dueDate)}</strong><small>{amount(nextDue.amountPaise / 100, invoice.currency)}</small><span className={'invoice-register-timing' + (state === 'overdue' ? ' is-overdue' : '')}>{daysOverdue ? `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue` : state === 'today' ? 'Due today' : 'Upcoming'}</span></> : <span className="studio-muted">{state === 'paid' ? 'Settled' : state === 'inactive' ? '—' : 'Not set'}</span>}</td>
        </tr>)}</tbody>
      </table></div> : <WorkspaceEmpty title={filtered ? 'No matching invoices' : 'No invoices yet'} description={filtered ? 'Try another client, invoice number or payment filter.' : 'Create an invoice to get started.'}>{filtered && <button type="button" className="studio-button" onClick={clearFilters}>Clear filters</button>}</WorkspaceEmpty>}
      {!loading && entries.length > 0 && <footer className="invoice-register-footer"><span>Showing {rows.length} of {entries.length} invoices</span><span>Advances apply to the earliest scheduled payment.</span></footer>}
    </section>
  </div>;
}
