import { expenseAllocation } from "../operations/insightData";
import { rupees } from "../operations/workspaceData";

export default function ExpenseBreakdown({ entries, loading, onCategory }) {
  const rows = expenseAllocation(entries),
    total =
      rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
  return (
    <section className="studio-card studio-expense-insight">
      <div className="studio-insight-heading">
        <div>
          <h2>Expense breakdown</h2>
          <p>All paid ledger expenses, by category.</p>
        </div>
      </div>
      {loading ? (
        <p className="studio-empty">Loading expenses…</p>
      ) : rows.length ? (
        <>
          <strong className="studio-expense-total">{rupees(total)}</strong>
          <div className="studio-expense-bars">
            {rows.map((row) => (
              <button
                type="button"
                key={row.label}
                className="studio-expense-row"
                onClick={() => onCategory(row.label)}
                aria-label={`View ${row.label} in the ledger, ${rupees(row.amount)}, ${Math.round(row.percent)}% of paid expenses`}
              >
                <span>
                  <span>{row.label}</span>
                  <strong>{rupees(row.amount)}</strong>
                </span>
                <div className="studio-insight-track" aria-hidden="true">
                  <i style={{ width: `${row.percent}%` }} />
                </div>
                <small>{Math.round(row.percent)}%</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="studio-empty">
          Record paid expenses to see their allocation.
        </p>
      )}
    </section>
  );
}
