import { RotateCcw } from 'lucide-react';
import { OperationsModal } from '../operations/OperationsUI';
import { OVERVIEW_CARDS, useStudioPreferences } from './StudioPreferences';
export default function OverviewCustomizer({ onClose }) {
  const { preferences, toggleCard, resetCards, syncState, retrySave } = useStudioPreferences();
  return <OperationsModal title="Make it your overview" onClose={onClose} footer={<><button type="button" className="studio-button" onClick={resetCards}><RotateCcw size={15} />Reset to default</button><button type="button" className="studio-button primary" onClick={onClose}>Done</button></>}>
    <p className="studio-muted">Choose the cards you want to see. Hidden cards can be added back here at any time.</p>
    <div className="overview-customizer-options">
      {['At a glance', 'Featured cards', 'Workspace cards'].map(group => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {OVERVIEW_CARDS.filter(card => card.group === group).map(card => {
            const visible = preferences.visibleCards.includes(card.id);
            return (
              <label className="overview-card-toggle studio-switch-control" key={card.id}>
                <span className="overview-card-toggle-label">{card.label}</span>
                <span className="studio-switch-state" aria-hidden="true">{visible ? 'On' : 'Off'}</span>
                <input type="checkbox" role="switch" checked={visible} onChange={() => toggleCard(card.id)} />
                <span className="studio-switch-track" aria-hidden="true" />
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
    <p className="overview-preference-status" role="status">{syncState === 'loading' ? 'Loading your account preferences…' : syncState === 'saving' ? 'Saving your preferences…' : syncState === 'local' ? 'Saved on this device. Account sync is unavailable.' : syncState === 'preview' ? 'Saved on this device for this sample preview.' : 'Saved to your Studio OS account.'}{syncState === 'local' && <button type="button" onClick={retrySave}>Retry sync</button>}</p>
  </OperationsModal>;
}
