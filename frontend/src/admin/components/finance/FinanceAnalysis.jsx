import { lazy, Suspense, useState } from "react";

const FinanceInsights = lazy(() => import("./FinanceInsights").then(module => ({ default: module.FinanceInsights })));

export default function FinanceAnalysis(props) {
  const [hasOpened, setHasOpened] = useState(false);
  return (
    <details
      className="studio-card finance-analysis-disclosure"
      onToggle={event => { if (event.currentTarget.open) setHasOpened(true); }}
    >
      <summary>Business insights &amp; trends</summary>
      {hasOpened && (
        <Suspense fallback={<p className="studio-empty" role="status">Loading business insights…</p>}>
          <FinanceInsights {...props} />
        </Suspense>
      )}
    </details>
  );
}
