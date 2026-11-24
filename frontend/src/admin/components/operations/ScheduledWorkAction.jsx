import { ChevronRight } from 'lucide-react';
import './scheduledWorkAction.css';

export default function ScheduledWorkAction({ title, detail, action, onOpen, disabled }) {
  return (
    <section className="sx-scheduled-next" aria-label="Up next">
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <button type="button" className="studio-button" disabled={disabled} onClick={onOpen}>
        {action}<ChevronRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
