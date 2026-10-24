import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import API from '../../../utils/apiConfig';
import { overviewFinanceTotals } from './overviewFinanceData';
import { rupees } from '../operations/workspaceData';

export default function OverviewFinanceCard({ remove, refreshKey }) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const key = `${refreshKey}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    const load = () => {
      const id = ++sequence;
      return axios.get(API + '/api/studio/finance', { signal: controller.signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
      .then(({ data }) => {
        if (!Array.isArray(data?.entries) || !Array.isArray(data?.invoices)) throw new Error('Finance data unavailable');
        if (id === sequence) setResult({ key, data: overviewFinanceTotals(data.entries, data.invoices) });
      }).catch(error => { if (!axios.isCancel(error) && id === sequence) setResult({ key, error: true }); });
    };
    load();
    const poll = () => { if (!document.hidden) load(); };
    const timer = setInterval(poll, 60000);
    document.addEventListener('visibilitychange', poll);
    return () => { sequence++; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [key]);
  const loading = result?.key !== key;
  const totals = !loading && !result.error ? result.data : null;
  const value = name => totals ? rupees(totals[name]) : '—';
  return <section className="overview-feature-card finance" data-overview-card="financePulse" aria-label="Finance pulse" aria-busy={loading}>
    {remove}
    <div className="overview-fluid-glow" aria-hidden="true"><i /><i /><i /></div>
    <div className="overview-card-motion overview-finance-waves" aria-hidden="true"><svg viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0 90 C150 10 450 170 600 90 C750 10 1050 170 1200 90 V200 H0Z" /><path d="M0 120 C150 190 450 50 600 120 C750 190 1050 50 1200 120 V200 H0Z" /></svg></div>
    <div className="overview-feature-label"><Wallet size={15} /><span>Finance pulse</span></div>
    <span className="overview-finance-profit-label">Net profit</span>
    <strong className="overview-feature-number overview-finance-profit">{value('netProfit')}</strong>
    <dl className="overview-finance-amounts"><div><dt>Upcoming amount</dt><dd>{value('upcoming')}</dd><small>Future & undated</small></div><div><dt>Due amount</dt><dd>{value('due')}</dd><small>Today & overdue</small></div></dl>
    {result?.key === key && result.error ? <p className="overview-finance-note" role="status">Finance couldn’t load. <button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={11} />Retry</button></p> : <p className="overview-finance-note">{loading ? 'Loading finance…' : 'Received income − paid expenses · all time · INR'}</p>}
    {totals?.excludedCurrencies > 0 && <p className="overview-finance-note">{totals.excludedCurrencies} non-INR invoices excluded</p>}
    <Link to="/admin/finance">Open finance<ArrowUpRight size={15} /></Link>
  </section>;
}
