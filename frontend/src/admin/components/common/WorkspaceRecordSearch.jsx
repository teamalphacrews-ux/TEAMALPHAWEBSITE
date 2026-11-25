import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { OperationsModal } from '../operations/OperationsUI';
import { useAuth } from '../../../context/AuthContext';
import { canAccessStudioPath, hasFullModuleAccess } from '../../../utils/moduleAccess';
import { studioText } from '../../../utils/studioTranslations';
import API from '../../../utils/apiConfig';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import { commercialNavSections } from './workspaceNavigation';
import { useStudioPreferences } from './StudioPreferences';
import './workspaceRecordSearch.css';

const labels = { contacts: 'Contacts', projects: 'Projects', enquiries: 'Enquiries', quotations: 'Quotations', invoices: 'Invoices' };

export default function WorkspaceRecordSearch() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user || (!IS_COMMERCIAL_DEPLOYMENT && !hasFullModuleAccess(user))) return null;
  const sessionKey = [user._id || user.id, user.workspace?.id || user.workspace?._id, location.pathname, location.search].join(':');
  return <RecordSearch key={sessionKey} />;
}

function RecordSearch() {
  const [open, setOpen] = useState(false);
  const shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  useEffect(() => {
    const shortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[aria-modal=true]')) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <>
    <button className="studio-icon-button studio-record-search-trigger" type="button" aria-label="Search your studio" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Search size={18} />
      {IS_COMMERCIAL_DEPLOYMENT && <><span className="sx-record-search-label">Search your studio</span><span className="sx-record-search-short">Search</span><kbd className="sx-record-search-key" aria-hidden="true">{shortcutLabel}</kbd></>}
    </button>
    {open && <SearchDialog onClose={() => setOpen(false)} />}
  </>;
}

function SearchDialog({ onClose }) {
  const { token, user } = useAuth();
  const { preferences } = useStudioPreferences();
  const translate = name => studioText(preferences.language, name);
  const canSearchRecords = hasFullModuleAccess(user);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const term = query.trim();
  const pages = IS_COMMERCIAL_DEPLOYMENT ? commercialNavSections(user, translate).flatMap(section => section.items) : [];
  if (IS_COMMERCIAL_DEPLOYMENT && canAccessStudioPath(user, '/admin/settings')) pages.push({ path: '/admin/settings', name: 'Settings' });
  if (IS_COMMERCIAL_DEPLOYMENT) pages.push({ path: '/studio-os/docs', name: 'Help' });
  const matches = term.length >= 2 ? pages.filter(page =>
    [page.name, translate(page.name)].some(name => name.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
  ) : [];

  useEffect(() => {
    if (term.length < 2 || !canSearchRecords) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(API + '/api/studio/search?q=' + encodeURIComponent(term), {
          headers: { Authorization: 'Bearer ' + token }, signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Record search is unavailable.');
        if (!controller.signal.aborted) setResult({ term, groups: (Array.isArray(data.groups) ? data.groups : []).filter(group => group.results?.length) });
      } catch (failure) {
        if (!controller.signal.aborted) setResult({ term, error: failure.message });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, token, canSearchRecords]);

  const ready = result?.term === term;
  const busy = canSearchRecords && !ready;
  const groups = ready ? result.groups || [] : [];
  const error = ready && result.error;
  return <OperationsModal title="Search your studio" onClose={onClose}>
    <div className="studio-page-search">
      <div className="studio-search"><Search size={18} aria-hidden="true" />
        <input ref={inputRef} type="search" data-autofocus aria-label="Search your studio" placeholder={canSearchRecords ? IS_COMMERCIAL_DEPLOYMENT ? 'Page, client, project or document…' : 'Client, project or document…' : 'Find a workspace page…'} value={query} maxLength={80} onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" className="studio-icon-button" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus(); }}><X size={16} /></button>}
      </div>
      <div className="studio-record-results">
        {matches.length > 0 && <section><h3>Pages</h3>{matches.map(page =>
          <Link key={page.path} to={page.path} onClick={onClose}><strong>{translate(page.name)}</strong></Link>
        )}</section>}
        <div role="status">
          {term.length < 2 ? <p>Enter at least two characters.</p> : busy ? <p><Loader2 size={16} /> Searching records…</p> : error ? <p className="studio-error">{error}</p> : !matches.length && !groups.length ? <p>No matches. Try another search.</p> : null}
        </div>
        {groups.map(group => <section key={group.kind}><h3>{labels[group.kind] || 'Records'}</h3>{group.results.map(row =>
          <Link key={row.id} to={row.path} onClick={onClose}><strong>{row.label}</strong><small>{row.subtitle}</small></Link>
        )}</section>)}
      </div>
    </div>
  </OperationsModal>;
}
