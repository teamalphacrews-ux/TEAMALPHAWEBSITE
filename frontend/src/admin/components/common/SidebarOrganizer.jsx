import { useState } from 'react';
import { ArrowDown, ArrowUp, ListOrdered } from 'lucide-react';
import { moveSidebarItem, sortSidebarItems } from '../../../utils/sidebarOrder';
import { studioText } from '../../../utils/studioTranslations';
import { OperationsModal } from '../operations/OperationsUI';
import StudioButton from './StudioButton';
import { useStudioPreferences } from './StudioPreferences';
import './sidebarOrganizer.css';

function SidebarOrderDialog({ sections, onClose }) {
  const { preferences, update } = useStudioPreferences();
  const [mode, setMode] = useState(preferences.sidebarSort);
  const [order, setOrder] = useState(preferences.sidebarOrder);
  const [sectionId, setSectionId] = useState(sections[0]?.id);
  const [announcement, announce] = useState('');
  const section = sections.find(group => group.id === sectionId) || sections[0];
  const items = sortSidebarItems(section?.items || [], mode, order, preferences.language);
  const itemName = item => studioText(preferences.language, item.name);

  function move(item, index, direction) {
    const position = index + direction;
    if (position < 0 || position >= items.length) return;
    setOrder(moveSidebarItem(order, items, item.path, direction));
    announce(`${itemName(item)}, position ${position + 1} of ${items.length}.`);
  }

  function save() {
    update({ sidebarSort: mode, sidebarOrder: order });
    onClose();
  }

  return <OperationsModal title="Organize sidebar" description="Choose how pages are ordered within each section." onClose={onClose}
    footer={<><StudioButton onClick={onClose}>Cancel</StudioButton><StudioButton variant="primary" onClick={save}>Save order</StudioButton></>}>
    <div className="sx-sidebar-order-editor">
      <label className="studio-field"><span>Sort pages</span>
        <select className="studio-input" value={mode} onChange={event => { setMode(event.target.value); announce(''); }}>
          <option value="default">Studio default</option>
          <option value="alphabetical">Alphabetical (A–Z)</option>
          <option value="custom">Custom order</option>
        </select>
      </label>
      {mode === 'custom' && section && <>
        <label className="studio-field"><span>Section</span>
          <select className="studio-input" value={section.id} onChange={event => { setSectionId(event.target.value); announce(''); }}>
            {sections.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        <ol className="sx-sidebar-order-list" aria-label={section.label}>
          {items.map((item, index) => <li key={item.path}>
            <span className="sx-sidebar-order-position" aria-hidden="true">{index + 1}</span><span>{itemName(item)}</span>
            <StudioButton variant="icon" icon={ArrowUp} label={`Move ${itemName(item)} up`} aria-disabled={index === 0} onClick={() => move(item, index, -1)} />
            <StudioButton variant="icon" icon={ArrowDown} label={`Move ${itemName(item)} down`} aria-disabled={index === items.length - 1} onClick={() => move(item, index, 1)} />
          </li>)}
        </ol>
        <span className="sx-order-announcement" role="status">{announcement}</span>
      </>}
    </div>
  </OperationsModal>;
}

export default function SidebarOrganizer({ sections, compact = false, mobile = false }) {
  const [open, setOpen] = useState(false);
  if (!sections.length) return null;
  return <>
    <button type="button" className={mobile ? 'studio-more-settings sx-more-organize' : 'studio-nav-item sx-desk-organize'} aria-label="Organize sidebar"
      aria-haspopup="dialog" title={compact ? 'Organize sidebar' : undefined} onClick={() => setOpen(true)}>
      <ListOrdered size={18} aria-hidden="true" /><span className={mobile ? undefined : 'studio-nav-text'}>Organize sidebar</span>
    </button>
    {open && <SidebarOrderDialog sections={sections} onClose={() => setOpen(false)} />}
  </>;
}
