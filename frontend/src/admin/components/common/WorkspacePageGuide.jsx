import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { hasFullModuleAccess } from '../../../utils/moduleAccess';
import { OperationsModal } from '../operations/OperationsUI';
import './workspacePageGuide.css';

function GuideDialog({ target, onClose }) {
  const [slug, anchor] = target.split('#');
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [section, setSection] = useState(undefined);
  useEffect(() => {
    let active = true;
    import('../../../saas/productDocsContent').then(({ DOC_GUIDES }) => {
      const guide = DOC_GUIDES.find(entry => entry.slug === slug);
      if (active) setSection(guide?.sections.find(entry => entry.id === anchor) || null);
    }).catch(() => { if (active) setSection(null); });
    return () => { active = false; };
  }, [slug, anchor]);
  return <OperationsModal title={section?.title || 'Page guide'} onClose={onClose}
    footer={<>
      {pathname.replace(/\/$/, '') !== '/admin' && <a className="studio-button" href="/admin?view=today" target="_blank" rel="noopener noreferrer">
        {hasFullModuleAccess(user) ? 'Open Today' : 'Open my workspace'} <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> in a new tab</span>
      </a>}
      <a className="studio-button" href={'/studio-os/docs/' + target} target="_blank" rel="noopener noreferrer">
      Open full guide <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> in a new tab</span>
    </a></>}>
    {section ? <ol className="sx-guide-steps">{section.steps.map(step => <li key={step.title}>
      <strong>{step.title}</strong><p>{step.body}</p>
    </li>)}</ol> : <p role="status">{section === undefined ? 'Opening page guide…' : 'This guide could not load here. Open the full guide to continue.'}</p>}
  </OperationsModal>;
}

export default function WorkspacePageGuide({ target, pageName, children }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="sx-page-guide-trigger" type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-label={'Open page guide for ' + pageName} title={'Page guide for ' + pageName} onClick={() => setOpen(true)}>
      {children}<BookOpen size={16} aria-hidden="true" /><span className="sx-guide-label">Guide</span>
    </button>
    {open && <GuideDialog target={target} onClose={() => setOpen(false)} />}
  </>;
}
