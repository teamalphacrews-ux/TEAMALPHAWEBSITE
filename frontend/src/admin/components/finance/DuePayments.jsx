import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { WorkspaceEmpty } from '../operations/WorkspaceUI';
import { rupees } from '../operations/workspaceData';
import { calendarDateLabel } from '../calendar/calendarData';
import './financeDue.css';

export default function DuePayments({ rows, loading, query, timezone }) {
  const visible = rows.filter(row => [row.invoice.clientName, row.invoice.reference, ...row.installments.map(item => item.label)].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="finance-due-queue" aria-label="Due now invoice queue">
    <header><div><h2>Due now</h2><p>Outstanding payments due today or earlier, with the earliest deadline first.</p></div><strong>{loading ? '—' : rupees(rows.reduce((sum, row) => sum + Math.round(row.amountDue * 100), 0) / 100)}<small>INR due across {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'}</small></strong></header>
    {loading ? <WorkspaceEmpty loading /> : !visible.length ? <WorkspaceEmpty title={query.trim() ? 'No matching due payments' : 'No invoice payments due now'} description={query.trim() ? 'Try another client, invoice reference or payment label.' : 'Issued invoices with unpaid payments due today or earlier will appear here.'} /> : <div className="studio-table-wrap finance-due-records"><table className="studio-table finance-due-table" role="table"><thead><tr><th scope="col">Client / invoice</th><th scope="col">Amount due now</th><th scope="col">Earliest due date</th><th scope="col">Payment timing</th><th scope="col">Invoice</th></tr></thead><tbody role="rowgroup">{visible.map(row => <tr key={row.invoice._id} role="row">
      <td className="finance-due-client" role="cell"><strong>{row.invoice.clientName || 'Client'}</strong><small>{row.invoice.reference || 'Invoice'}</small></td>
      <td className="finance-due-amount" role="cell" data-label="Due now"><strong>{rupees(row.amountDue)}</strong><small>{rupees(row.outstanding)} total balance</small></td>
      <td className="finance-due-deadline" role="cell" data-label="Earliest due date"><span className="finance-due-date"><CalendarClock size={14} />{calendarDateLabel(row.dueDate, {}, timezone)}</span>{row.installments.length > 1 && <small>{row.installments.length} due installments</small>}</td>
      <td className="finance-due-timing" role="cell"><span className={'studio-badge ' + (row.daysOverdue ? 'rose' : 'gold')}>{row.daysOverdue ? `${row.daysOverdue} ${row.daysOverdue === 1 ? 'day' : 'days'} overdue` : 'Due today'}</span></td>
      <td className="finance-due-action" role="cell"><Link className="studio-button small" to={'/admin/invoices/' + row.invoice._id} aria-label={'Open invoice ' + (row.invoice.reference || '') + ' for ' + (row.invoice.clientName || 'client')}>Open <ArrowUpRight size={14} /></Link></td>
    </tr>)}</tbody></table></div>}
    {!loading && <footer>Showing {visible.length} of {rows.length} due invoices · {timezone}. Drafts, cancelled invoices, settled balances, future installments and non-INR invoices are excluded.</footer>}
  </section>;
}
