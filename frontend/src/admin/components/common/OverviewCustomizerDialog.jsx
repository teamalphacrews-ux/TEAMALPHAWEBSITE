import { lazy, Suspense } from 'react';
import { OperationsModal } from '../operations/OperationsUI';

const OverviewCustomizer = lazy(() => import('./OverviewCustomizer'));

export default function OverviewCustomizerDialog({ onClose }) {
  return <Suspense fallback={<OperationsModal title="Customize overview" onClose={onClose}>
    <p role="status">Loading cards…</p>
  </OperationsModal>}>
    <OverviewCustomizer onClose={onClose} />
  </Suspense>;
}
