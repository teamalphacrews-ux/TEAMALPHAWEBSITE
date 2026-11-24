import { useId } from 'react';
import { ledgerCashFlow } from '../operations/insightData';
import { rupees } from '../operations/workspaceData';

const compactAmount = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
});

export default function AccountCashFlow({ entries, loading, unavailable }) {
  const id = useId();
  const months = ledgerCashFlow(entries, 6);
  const maximum = Math.max(0, ...months.flatMap(month => [month.income, month.expenses]));
  const points = field => months.map((month, index) => {
    const x = 46 + index * 108;
    const y = 148 - month[field] / maximum * 128;
    return x + ',' + y;
  }).join(' ');
  return (
    <section className="account-flow-card" aria-labelledby={id}>
      <header><div><h2 id={id}>Money in and out</h2><p>Last six months of recorded ledger activity</p></div>
        <span className="account-flow-legend"><i />In <i />Out</span>
      </header>
      {loading ? <p className="studio-empty" role="status">Loading ledger activity…</p>
        : unavailable ? <p className="account-flow-empty">Ledger activity could not be loaded.</p>
        : maximum === 0 ? <p className="account-flow-empty">No received income or paid expenses recorded in this period.</p>
        : <>
          <svg viewBox="0 0 620 178" className="account-flow-chart" role="img" aria-label="Monthly income and expenses. Exact amounts are under Monthly figures.">
            <defs><linearGradient id={id + '-shade'} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".20" /><stop offset="1" stopColor="currentColor" stopOpacity=".015" /></linearGradient></defs>
            {[0, .5, 1].map(fraction => <g key={fraction}><line className="flow-grid" x1="46" x2="586" y1={148 - 128*fraction} y2={148 - 128*fraction} /><text x="0" y={148 - 128*fraction + 3}>{compactAmount.format(maximum*fraction)}</text></g>)}
            <polygon points={'46,148 ' + points('income') + ' 586,148'} fill={'url(#' + id + '-shade)'} />
            <polyline className="flow-series income" points={points('income')} />
            <polyline className="flow-series expenses" points={points('expenses')} />
            {months.map((month, index) => <text key={month.key} x={46 + index * 108} y="173" textAnchor="middle">{month.label}</text>)}
          </svg>
          <details className="account-flow-data"><summary>Monthly figures</summary>
            <table><thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Expenses</th></tr></thead>
              <tbody>{months.map(month => <tr key={month.key}><th scope="row">{month.fullLabel}</th><td>{rupees(month.income)}</td><td>{rupees(month.expenses)}</td></tr>)}</tbody>
            </table>
          </details>
        </>}
    </section>
  );
}
