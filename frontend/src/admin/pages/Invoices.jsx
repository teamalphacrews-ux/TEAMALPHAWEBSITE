import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import StudioSelect from '../components/common/StudioSelect';
import { useWorkspaceModuleSearch } from '../components/common/WorkspaceModuleSearch';
import { workspaceRequest } from '../components/operations/workspaceData';
import { operationError } from '../components/operations/operationsUtils';
import { WorkspaceHeader, WorkspaceSearch, WorkspaceError, WorkspaceEmpty } from '../components/operations/WorkspaceUI';
import { useStudioIdentity } from '../../utils/studioIdentity';
import { formatStudioDate, studioDayBounds, studioDayKey, studioTimezone } from '../../utils/studioTime';
import './documentRegister.css';
import './invoiceRegister.css';

const amount = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency || '') ? currency : 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function Invoices() {
  const { identity } = useStudioIdentity();
  const timezone = studioTimezone(identity?.timezone);
  const [query, setQuery] = useState('');
  const usesTopbarSearch = useWorkspaceModuleSearch({
    label: 'Find an invoice or client',
    query,
    onChange: setQuery,
    maxLength: 512,
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('overdue');
  const [pages, setPages] = useState({ key: '', entries: [] });
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const criteria = new URLSearchParams({ q: search, filter, sort, tz: timezone }).toString();
  const day = studioDayKey(now, timezone);
  const pageKey = criteria + '|' + day;
  const history = pages.key === pageKey ? pages.entries : [];
  const { offset = 0, cursor } = history.at(-1) || {};
  const path = '/api/invoices/register?' + criteria + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
  useEffect(() => {
    let active = true;
    workspaceRequest('get', path).then(data => {
      if (active) setResponse({ path, day, attempt, data });
    }).catch(error => {
      if (active) setResponse({ path, day, attempt, error: operationError(error, 'The invoice register could not be loaded. Please retry.') });
    });
    return () => { active = false; };
  }, [path, day, attempt]);
  const current = response?.path === path && response.day === day && response.attempt === attempt;
  const loading = !current || search !== query.trim();
  const error = loading ? '' : response.error;
  const data = loading ? null : response.data;
  const { rows = [], total = 0, matched = 0, overdue = 0, nextCursor } = data || {};
  const filtered = !!query.trim() || filter !== 'all';
  const date = value => formatStudioDate(value, { day: 'numeric', month: 'short', year: 'numeric' }, timezone);
  const dueDate = key => date(studioDayBounds(key, timezone).start);
  const reload = () => setAttempt(previous => previous + 1);
  const clearFilters = () => { setQuery(''); setSearch(''); setFilter('all'); setPages({ key: '', entries: [] }); };
  const movePage = direction => {
    if (loading) return;
    if (direction < 0 && history.length) setPages({ key: pageKey, entries: history.slice(0, -1) });
    if (direction > 0 && nextCursor) setPages({ key: pageKey, entries: [...history, { offset: offset + rows.length, cursor: nextCursor }] });
  };

  return <div className="invoice-register-page document-register-page">
    <WorkspaceHeader title="Invoices" description="Prepare and manage client invoices.">
      <Link className="studio-button primary" to="/admin/invoices/new"><Plus size={16} aria-hidden="true" />New invoice</Link>
    </WorkspaceHeader>
    <WorkspaceError error={error} retry={reload} />
    <section className="studio-card invoice-register document-register-panel" aria-labelledby="invoice-register-heading">
      <header className="document-register-heading">
        <div className="document-register-intro">
          <h2 id="invoice-register-heading">Invoice register</h2>
          <p className="document-register-meta">
            <span role="status">
              {loading ? 'Loading invoices…' : error ? 'Invoices unavailable' : `${total} ${total === 1 ? 'invoice' : 'invoices'}`}
              {overdue > 0 && ` · ${overdue} overdue`}
            </span>
            {' · '}Due dates in {timezone}
          </p>
        </div>
        <div className={'document-register-controls invoice-register-toolbar' + (usesTopbarSearch ? ' is-topbar-search' : '')}>
          {!usesTopbarSearch && <WorkspaceSearch value={query} onChange={setQuery} maxLength={512} placeholder="Find an invoice or client…" />}
          <div className="invoice-register-selectors">
            <StudioSelect aria-label="Filter invoices" value={filter} onChange={event => setFilter(event.target.value)}>
              <option value="all">All invoices</option><option value="outstanding">Outstanding balances</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="upcoming">Upcoming payments</option><option value="unscheduled">No due date</option><option value="paid">Paid</option><option value="draft">Drafts</option>
            </StudioSelect>
            <StudioSelect aria-label="Sort invoices" value={sort} onChange={event => setSort(event.target.value)}>
              <option value="overdue">Overdue first</option><option value="due">Due date: earliest</option><option value="newest">Newest invoice</option><option value="balance">Balance: high to low</option>
            </StudioSelect>
          </div>
        </div>
      </header>
      {loading ? <WorkspaceEmpty loading /> : error ? <WorkspaceEmpty title="Invoices unavailable" description="Retry the connection to load your invoice register.">{history.length > 0 && <button type="button" className="studio-button" onClick={() => setPages({ key: pageKey, entries: [] })}>Return to first page</button>}</WorkspaceEmpty> : rows.length ? <div className="studio-table-wrap invoice-register-scroll" role="region" aria-label="Invoice records" tabIndex={0}><table role="table" className="studio-table studio-phone-record-table invoice-register-table" aria-label="Client invoices">
        <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Invoice</th><th role="columnheader" scope="col">Client</th><th role="columnheader" scope="col">Document status</th><th role="columnheader" scope="col">Payment status</th><th role="columnheader" scope="col" className="invoice-register-money">Total</th><th role="columnheader" scope="col" className="invoice-register-money">Balance due</th><th role="columnheader" scope="col">Next due</th></tr></thead>
        <tbody role="rowgroup">{rows.map(({ invoice, documentStatus, paymentStatus, balance, nextDue, daysOverdue, state }) => <tr role="row" key={invoice._id}>
          <td role="cell" data-label="Invoice" className="invoice-register-reference">
            <Link to={'/admin/invoices/' + invoice._id}>
              <span>
                <strong>{invoice.invoiceNumber || invoice.documentNumber || 'Draft invoice'}</strong>
                <small>{date(invoice.invoiceDate || invoice.createdAt)}</small>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </td>
          <td role="cell" data-label="Client" className="invoice-register-client"><strong>{invoice.clientName}</strong>{invoice.title && <small>{invoice.title}</small>}</td>
          <td role="cell" data-label="Document status"><span className="studio-badge">{documentStatus === 'Sent' ? 'Issued' : documentStatus}</span></td>
          <td role="cell" data-label="Payment status"><span className={'studio-badge' + (state === 'paid' ? ' green' : '')}>{paymentStatus}</span></td>
          <td role="cell" data-label="Total" className="invoice-register-money">{amount(invoice.total, invoice.currency)}</td>
          <td role="cell" data-label="Balance due" className="invoice-register-money"><strong>{state === 'inactive' ? '—' : amount(balance, invoice.currency)}</strong></td>
          <td role="cell" data-label="Next due" className="invoice-register-deadline">{nextDue?.dueDate ? <><strong>{dueDate(nextDue.dueDate)}</strong><small>{amount(nextDue.amountPaise / 100, invoice.currency)}</small><span className={'invoice-register-timing' + (state === 'overdue' ? ' is-overdue' : '')}>{daysOverdue ? `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue` : state === 'today' ? 'Due today' : 'Upcoming'}</span></> : <span className="studio-muted">{state === 'paid' ? 'Settled' : state === 'inactive' ? '—' : 'Not set'}</span>}</td>
        </tr>)}</tbody>
      </table></div> : history.length ? <WorkspaceEmpty title="No more invoices" description="Return to the previous page to see your invoices." /> : <WorkspaceEmpty title={filtered ? 'No matching invoices' : 'No invoices yet'} description={filtered ? 'Try another client, invoice number or payment filter.' : 'Create an invoice to get started.'}>{filtered && <button type="button" className="studio-button" onClick={clearFilters}>Clear filters</button>}</WorkspaceEmpty>}
      {(total > 0 || history.length > 0 || response?.data?.nextCursor) && <footer className="invoice-register-footer">
        <div aria-live="polite">
          {!loading && !error && <span>{rows.length ? `Showing ${offset + 1}–${offset + rows.length} of ${matched}` : 'Showing 0 matching invoices'}</span>}
          <span>Advances apply to the earliest scheduled payment.</span>
        </div>
        {(nextCursor || history.length > 0 || response?.data?.nextCursor) && <nav className="invoice-register-pages" aria-label="Invoice pages">
          <button type="button" className="studio-button" disabled={loading || !history.length} onClick={() => movePage(-1)}><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
          <button type="button" className="studio-button" disabled={loading || !nextCursor} onClick={() => movePage(1)}>Next <ChevronRight size={16} aria-hidden="true" /></button>
        </nav>}
      </footer>}
    </section>
  </div>;
}
