import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useWorkspaceData, rupees, recordDate } from '../components/operations/workspaceData';
import { WorkspaceHeader, WorkspaceSearch, WorkspaceError, WorkspaceEmpty } from '../components/operations/WorkspaceUI';
export default function Invoices() {
  const { data, loading, error, reload } = useWorkspaceData(['/api/invoices']);
  const [query, setQuery] = useState('');
  const rows = (data[0] || []).filter(row => [row.clientName, row.invoiceNumber, row.documentNumber, row.title].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <div><WorkspaceHeader title="Invoices" description="Prepare and manage client invoices."><Link className="studio-button primary" to="/admin/invoices/new"><Plus size={16} />New invoice</Link></WorkspaceHeader><WorkspaceError error={error} retry={reload} /><section className="studio-card"><WorkspaceSearch value={query} onChange={setQuery} placeholder="Find an invoice…" />{loading ? <WorkspaceEmpty loading /> : rows.length ? <div className="studio-table-wrap"><table className="studio-table studio-phone-record-table"><thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>{rows.map(row => <tr key={row._id}><td data-label="Invoice"><Link to={'/admin/invoices/' + row._id}>{row.invoiceNumber || row.documentNumber || 'Draft invoice'}</Link></td><td data-label="Client">{row.clientName}</td><td data-label="Status">{row.documentStatus || row.status}</td><td data-label="Total">{rupees(row.total)}</td><td data-label="Date">{recordDate(row.invoiceDate || row.createdAt)}</td></tr>)}</tbody></table></div> : <WorkspaceEmpty title={query ? 'No matching invoices' : 'No invoices yet'} description="Create an invoice to get started." />}</section></div>;
}
