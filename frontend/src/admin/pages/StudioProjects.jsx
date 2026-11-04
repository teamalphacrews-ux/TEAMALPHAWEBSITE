import { useAuth } from '../../context/AuthContext';
import { canAccessStudioPath, hasModuleAccess } from '../../utils/moduleAccess';
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Plus, Search, X } from "lucide-react";
import { ProjectForm } from "../components/contacts/ContactWorkflowUI";
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
export default function StudioProjects() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useWorkspaceData([
      "/api/studio-projects",
      hasModuleAccess(user, 'contacts') ? '/api/contacts' : null,
    ]),
    [projects = [], contacts = []] = data;
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All Projects"),
    [creating, setCreating] = useState(false),
    navigate = useNavigate();
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
  return (
    <div className="reference-workspace project-contact-workspace project-contact-register">
      <div className="reference-heading project-contact-heading">
        <div className="project-contact-heading-copy"><h1>Projects</h1><p>Quotes, invoices, schedules and delivery, connected to each client.</p></div>
        <div className="project-contact-heading-actions">
          {canAccessStudioPath(user, '/admin/projects') && <Link className="studio-button" to="/admin/projects">Earlier bookings<ArrowUpRight size={16} aria-hidden="true" /></Link>}
          {hasModuleAccess(user, 'contacts') && <button className="reference-button" onClick={() => setCreating(true)}><Plus size={17} aria-hidden="true" />New project</button>}
        </div>
      </div>
      <div className="project-contact-register-tools">
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
        <p className="project-contact-result-count" role="status">{loading ? "Loading projects…" : `${visible.length} of ${projects.length} projects`}</p>
      </div>
      <div className="reference-tabs project-contact-filters" aria-label="Filter projects by status">
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
      <WorkspaceError error={error} retry={reload} />
      {visible.length ? (
        <>
        <CompactProjects projects={visible} />
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
        </div>
        </>
      ) : (
        <WorkspaceEmpty
          loading={loading}
          title={query ? "No matching projects" : filter !== "All Projects" ? `No ${filter.toLowerCase()} projects` : "No projects here yet"}
          description={query ? "Try another project, client or location, or clear your search." : filter !== "All Projects" ? `Projects marked as ${filter.toLowerCase()} will appear here.` : "Create a project and keep its quotes, invoices, sessions, and notes together."}
        >
          {(query || filter !== "All Projects") && <button type="button" className="studio-button" onClick={() => { setQuery(""); setFilter("All Projects"); }}>View all projects</button>}
        </WorkspaceEmpty>
      )}
      {creating && (
        <ProjectForm
          contacts={contacts}
          onClose={() => setCreating(false)}
          onSaved={(project) =>
            navigate(`/admin/studio-projects/${project._id}`)
          }
        />
      )}
    </div>
  );
}
