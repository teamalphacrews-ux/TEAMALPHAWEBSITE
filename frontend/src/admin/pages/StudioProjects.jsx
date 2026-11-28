import WorkspaceMotionTitle from '../components/common/WorkspaceMotionTitle';
import { useWorkspaceModuleSearch } from '../components/common/WorkspaceModuleSearch';
import { useAuth } from '../../context/AuthContext';
import { canWriteWorkspaceModule } from '../../utils/workspaceActions';
import { canAccessStudioPath, hasModuleAccess } from '../../utils/moduleAccess';
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CalendarDays, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { IS_COMMERCIAL_DEPLOYMENT } from '../../saas/release';
import { ContactForm, ProjectForm } from "../components/contacts/ContactWorkflowUI";
import { CompactProjects } from "../components/contacts/CompactWorkspaceRecords";
import {
  useWorkspaceData,
  recordDate,
} from "../components/operations/workspaceData";
import {
  WorkspaceError,
  WorkspaceEmpty,
} from "../components/operations/WorkspaceUI";
import "./referenceContacts.css";
import "./projectContactRefinement.css";
import "./studioCommercialProjects.css";
import { ProjectSlate, ProjectTimeline } from './ProjectSlate';
import './studioRecordDesk.css';
import RecordViewSwitch from './RecordViewSwitch';

export default function StudioProjects() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useWorkspaceData([
      "/api/studio-projects",
      hasModuleAccess(user, 'contacts') ? '/api/contacts' : null,
    ]),
    [projects = [], contacts = []] = data;
  const canReadProduction = IS_COMMERCIAL_DEPLOYMENT && hasModuleAccess(user, 'production');
  const { data: taskData } = useWorkspaceData([canReadProduction ? '/api/tasks' : null]);
  const projectProgress = useMemo(() => {
    const totals = new Map();
    if (!canReadProduction || !Array.isArray(taskData[0])) return totals;
    const byLead = new Map(projects.filter(project => project.leadId).map(project => [project.leadId._id || project.leadId, project._id]));
    taskData[0].forEach(task => {
      const lead = task.lead;
      const projectId = lead?.studioProjectId?._id || lead?.studioProjectId || byLead.get(lead?._id || lead);
      if (!projectId) return;
      const count = totals.get(projectId) || { done: 0, total: 0 };
      count.total += 1;
      if (task.status === 'completed') count.done += 1;
      totals.set(projectId, count);
    });
    return totals;
  }, [projects, taskData, canReadProduction]);
  const preferenceKey = 'studioxos-project-view:' + (user?._id || user?.id || 'current');
  const pinKey = 'studioxos-pinned-projects:' + (user?.workspace?._id || user?.workspaceId || '') + ':' + (user?._id || user?.id || 'current');
  const [pinned, setPinned] = useState(() => {
    try {
      const values = JSON.parse(localStorage.getItem(pinKey) || '[]');
      return Array.isArray(values) ? values.filter(value => typeof value === 'string') : [];
    } catch { return []; }
  });
  const togglePin = id => {
    const next = pinned.includes(id) ? pinned.filter(value => value !== id) : [...pinned, id];
    setPinned(next);
    try { localStorage.setItem(pinKey, JSON.stringify(next)); } catch { /* Pins are available until this view closes. */ }
  };
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All Projects"),
    [creating, setCreating] = useState(false),
    [view, setView] = useState(() => {
      if (!IS_COMMERCIAL_DEPLOYMENT) return 'list';
      try { const saved = localStorage.getItem(preferenceKey); return ['list', 'timeline'].includes(saved) ? saved : 'grid'; }
      catch { return 'grid'; }
    }),
    navigate = useNavigate();
  const useTopbarSearch = useWorkspaceModuleSearch({ label: 'Search projects', query, onChange: setQuery });
  const [params, setParams] = useSearchParams();
  const createRequested = IS_COMMERCIAL_DEPLOYMENT && params.get('new') === '1';
  const canCreate = hasModuleAccess(user, 'contacts') && (!IS_COMMERCIAL_DEPLOYMENT || canWriteWorkspaceModule(user, 'projects'));
  const showCreate = (creating || createRequested) && canCreate;
  const requestedClient = createRequested ? params.get('contact') : null;
  const closeCreate = () => {
    setCreating(false);
    if (createRequested) {
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('contact');
      setParams(next, { replace: true });
    }
  };
  const changeView = next => {
    setView(next);
    try { localStorage.setItem(preferenceKey, next); }
    catch { /* The selected view still works when browser storage is unavailable. */ }
  };
  const visible = projects.filter(
    (project) =>
      (filter === "All Projects" || project.status === filter) &&
      [
        project.name,
        project.type,
        project.location,
        project.contactId?.firstName,
        project.contactId?.lastName,
        project.contactId?.email,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const resultCount = <p className="project-contact-result-count" data-filtered={Boolean(loading || query || filter !== "All Projects")} role="status">{loading ? "Loading projects…" : `${visible.length} of ${projects.length} projects`}</p>;
  return (
    <div data-topbar-search={useTopbarSearch || undefined} className={'reference-workspace project-contact-workspace project-contact-register' + (IS_COMMERCIAL_DEPLOYMENT ? ' sx-project-register record-desk' : '')}>
      <div className="reference-heading project-contact-heading">
        <div className="project-contact-heading-copy"><WorkspaceMotionTitle>Projects</WorkspaceMotionTitle><p>{IS_COMMERCIAL_DEPLOYMENT && !loading && !error ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} on the slate · ${projects.filter(project => project.status === 'Booked').length} booked` : 'Quotes, invoices, schedules and delivery, connected to each client.'}</p></div>
        <div className="project-contact-heading-actions">
          {canAccessStudioPath(user, '/admin/projects') && <Link className="studio-button" to="/admin/projects">Earlier bookings<ArrowUpRight size={16} aria-hidden="true" /></Link>}
          {canCreate && <button className="reference-button" onClick={() => setCreating(true)}><Plus size={17} aria-hidden="true" />New project</button>}
        </div>
      </div>
      {IS_COMMERCIAL_DEPLOYMENT && <RecordViewSwitch value={view} onChange={changeView} label="Project view"
        views={[{ id: 'grid', label: 'Slate', icon: LayoutGrid }, { id: 'timeline', label: 'Timeline', icon: CalendarDays }, { id: 'list', label: 'List', icon: List }]}
        surfaceSelector=".record-slate,.record-project-timeline,.reference-mobile-records,.reference-desktop-records" />}
      {!useTopbarSearch && <div className="project-contact-register-tools">
        <label className="reference-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search projects"
            placeholder="Search project or client name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {query && <button type="button" className="reference-icon-button" aria-label="Clear project search" onClick={() => setQuery("")}><X size={17} aria-hidden="true" /></button>}
        {resultCount}
      </div>}
      <div className={IS_COMMERCIAL_DEPLOYMENT ? 'sx-project-register-toolbar record-register-summary' : undefined}>
        <div className="reference-tabs project-contact-filters" role="group" aria-label="Filter projects by status">
          {["All Projects", "Inquiry", "Booked", "Completed"].map((label) => (
            <button
              key={label}
              className={label === filter ? "active" : ""}
              aria-pressed={label === filter}
              onClick={() => setFilter(label)}
            >
              <span>{label === "All Projects" ? "All projects" : label}</span><span className="project-contact-filter-count">{label === "All Projects" ? projects.length : projects.filter(project => project.status === label).length}</span>
            </button>
          ))}
        </div>
        {useTopbarSearch && resultCount}
      </div>
      <WorkspaceError error={error} retry={reload} />
      {visible.length ? (
        <>
        {(!IS_COMMERCIAL_DEPLOYMENT || view === 'list') && <CompactProjects projects={visible} />}
        {IS_COMMERCIAL_DEPLOYMENT && view === 'grid' && <ProjectSlate projects={visible} progress={projectProgress} pinned={pinned} togglePin={togglePin} canReadClients={hasModuleAccess(user, 'contacts')} />}
        {IS_COMMERCIAL_DEPLOYMENT && view === 'timeline' && <ProjectTimeline projects={visible} progress={projectProgress} />}
        {(!IS_COMMERCIAL_DEPLOYMENT || view === 'list') &&
        <div className="reference-table-scroll reference-desktop-records">
          <table className="reference-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Type</th>
                <th>Project date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((project) => (
                <tr key={project._id}>
                  <td>
                    <Link
                      className="reference-name-link"
                      to={`/admin/studio-projects/${project._id}`}
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td>
                    {project.contactId ? (
                      <Link to={`/admin/contacts/${project.contactId._id}`}>
                        {project.contactId.firstName}{" "}
                        {project.contactId.lastName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{project.type}</td>
                  <td>
                    {project.startDate ? recordDate(project.startDate) : "To be confirmed"}
                  </td>
                  <td>
                    <span
                      className={`reference-status ${project.status.toLowerCase()}`}
                    >
                      {project.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
        </>
      ) : (
        <WorkspaceEmpty
          loading={loading}
          title={query ? "No matching projects" : filter !== "All Projects" ? `No ${filter.toLowerCase()} projects` : "No projects here yet"}
          description={query ? "Try another project, client or location, or clear your search." : filter !== "All Projects" ? `Projects marked as ${filter.toLowerCase()} will appear here.` : canCreate ? "Create a project and keep its quotes, invoices, sessions, and notes together." : "Projects available to you will appear here."}
        >
          {(query || filter !== "All Projects") && <button type="button" className="studio-button" onClick={() => { setQuery(""); setFilter("All Projects"); }}>View all projects</button>}
        </WorkspaceEmpty>
      )}
      {showCreate && (!IS_COMMERCIAL_DEPLOYMENT || data.length > 0) && (
        <CreateProjectDraft
          key={requestedClient || 'no-client'}
          requestedClient={requestedClient}
          contacts={contacts}
          onClientCreated={reload}
          onClose={closeCreate}
          onSaved={project => navigate(`/admin/studio-projects/${project._id}`, { replace: createRequested })}
        />
      )}
    </div>
  );
}

function CreateProjectDraft({ requestedClient, contacts, onClientCreated, onClose, onSaved }) {
  const [firstClient, setFirstClient] = useState(null);
  if (IS_COMMERCIAL_DEPLOYMENT && !contacts.length && !firstClient) return (
    <ContactForm
      title="Add a client for this project"
      submitLabel="Save client and continue"
      onSaved={client => { setFirstClient(client); onClientCreated(); }}
      onClose={onClose}
    />
  );
  const selectedClient = firstClient || contacts.find(client => client._id === requestedClient);
  return (
    <ProjectForm
      key={selectedClient?._id || 'unassigned'}
      contact={selectedClient}
      contacts={contacts}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
