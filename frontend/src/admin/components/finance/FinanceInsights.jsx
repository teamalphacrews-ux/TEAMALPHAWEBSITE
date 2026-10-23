import { useId, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowDownLeft, ArrowUpRight, BarChart3 } from "lucide-react";
import {
  ledgerCashFlow,
  bookingCollections,
  expenseAllocation,
} from "../operations/insightData";
import { ProgressRing } from "../operations/StudioInsights";
import useReducedStudioMotion from "../operations/useReducedStudioMotion";
import { rupees } from "../operations/workspaceData";

const compactMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 1,
  }).format(value);
function CashTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      className="studio-chart-tooltip"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <strong>{row.fullLabel}</strong>
      <span>
        <i className="income" />
        Income <b>{rupees(row.income)}</b>
      </span>
      <span>
        <i className="expense" />
        Expenses <b>{rupees(row.expenses)}</b>
      </span>
      <small>
        Net cash flow <b>{rupees(row.net)}</b>
      </small>
    </div>
  );
}
export function FinanceInsights({ entries, leads, loading }) {
  const [period, setPeriod] = useState(6),
    [showData, setShowData] = useState(false);
  const reducedMotion = useReducedStudioMotion(),
    id = useId();
  const rows = ledgerCashFlow(entries, period),
    collections = bookingCollections(leads);
  const income = rows.reduce((sum, row) => sum + row.incomePaise, 0) / 100,
    expenses = rows.reduce((sum, row) => sum + row.expensesPaise, 0) / 100;
  return (
    <div className="studio-finance-insights">
      <section
        className="studio-card studio-cash-flow"
        aria-labelledby={`${id}-cash-title`}
      >
        <div className="studio-insight-heading">
          <div>
            <h2 id={`${id}-cash-title`}>Cash flow</h2>
            <p>Received income and paid expenses in your ledger.</p>
          </div>
          <div
            className="studio-insight-period"
            role="group"
            aria-label="Cash flow period"
          >
            {[3, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                aria-pressed={period === months}
                onClick={() => setPeriod(months)}
              >
                {months}M
              </button>
            ))}
          </div>
        </div>
        <div className="studio-cash-summary" aria-live="polite">
          <div>
            <span>
              <ArrowDownLeft size={13} />
              Income
            </span>
            <strong>{loading ? "—" : rupees(income)}</strong>
          </div>
          <div>
            <span>
              <ArrowUpRight size={13} />
              Expenses
            </span>
            <strong>{loading ? "—" : rupees(expenses)}</strong>
          </div>
          <div>
            <span>Net cash flow</span>
            <strong className={income < expenses ? "is-negative" : ""}>
              {loading ? "—" : rupees(income - expenses)}
            </strong>
          </div>
        </div>
        {showData ? (
          <div className="studio-chart-data">
            <table className="studio-table">
              <caption className="studio-sr-only">
                Monthly cash ledger values in rupees
              </caption>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Expenses</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.fullLabel}</th>
                    <td>{rupees(row.income)}</td>
                    <td>{rupees(row.expenses)}</td>
                    <td>{rupees(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="studio-cash-chart" aria-busy={loading}>
            {loading ? (
              <div className="studio-chart-placeholder" role="status">
                <span className="studio-loader" />
                Loading cash flow…
              </div>
            ) : income || expenses ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={rows}
                  margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
                  barGap={4}
                  accessibilityLayer
                  aria-label="Monthly ledger income and expenses. Use arrow keys to inspect values, or choose View data."
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--brand-stone)"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--brand-muted)" }}
                    minTickGap={16}
                    dy={8}
                  />
                  <YAxis
                    tickFormatter={compactMoney}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--brand-muted)" }}
                    width={58}
                  />
                  <Tooltip
                    content={<CashTooltip />}
                    cursor={{ fill: "var(--brand-paper)" }}
                    isAnimationActive={!reducedMotion}
                    animationDuration={160}
                  />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="var(--chart-income)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={!reducedMotion}
                    animationBegin={0}
                    animationDuration={500}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="var(--chart-expense)"
                    stroke="var(--brand-accent)"
                    strokeWidth={0.75}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={!reducedMotion}
                    animationBegin={0}
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="studio-chart-placeholder">
                <BarChart3 size={26} />
                <strong>No cash activity in this period</strong>
                <span>Received income and paid expenses will appear here.</span>
              </div>
            )}
          </div>
        )}
        <div className="studio-chart-footer">
          <div className="studio-chart-legend">
            <span>
              <i className="income" />
              Income
            </span>
            <span>
              <i className="expense" />
              Expenses
            </span>
          </div>
          <button
            type="button"
            className="studio-insight-text-button"
            disabled={loading}
            aria-pressed={showData}
            onClick={() => setShowData((value) => !value)}
          >
            {showData ? "Show chart" : "View data"}
          </button>
        </div>
      </section>
      <section
        className="studio-card studio-booking-collections"
        aria-labelledby={`${id}-bookings-title`}
      >
        <div className="studio-insight-heading">
          <div>
            <h2 id={`${id}-bookings-title`}>Booking collections</h2>
            <p>Payment progress on confirmed bookings.</p>
          </div>
        </div>
        {loading ? (
          <div className="studio-chart-placeholder" role="status">
            Loading collections…
          </div>
        ) : (
          <>
            <ProgressRing
              value={collections.received}
              total={collections.total}
              label="Collected"
              emptyLabel="No booking value"
            />
            <dl className="studio-collection-values">
              <div>
                <dt>
                  <i className="income" />
                  Received
                </dt>
                <dd>{rupees(collections.received)}</dd>
              </div>
              <div>
                <dt>
                  <i className="expense" />
                  Outstanding
                </dt>
                <dd>{rupees(collections.remaining)}</dd>
              </div>
            </dl>
            <p className="studio-insight-note">
              {collections.count} confirmed{" "}
              {collections.count === 1 ? "booking" : "bookings"} · CRM payment
              records
            </p>
          </>
        )}
      </section>
    </div>
  );
}
export function ExpenseBreakdown({ entries, loading, onCategory }) {
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
