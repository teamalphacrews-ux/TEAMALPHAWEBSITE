import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
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
export default function StudioProjects() {
  const { data, loading, error, reload } = useWorkspaceData([
      "/api/studio-projects",
      "/api/contacts",
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
    <div className="reference-workspace">
      <div className="reference-heading">
        <h1>Projects</h1>
        <label className="reference-search">
          <Search size={16} />
          <input
            aria-label="Search projects"
            placeholder="Search project or client name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className="reference-button" onClick={() => setCreating(true)}>
          New Project
        </button>
      </div>
      <div className="reference-tabs">
        {["All Projects", "Inquiry", "Booked", "Completed"].map((label) => (
          <button
            key={label}
            className={label === filter ? "active" : ""}
            aria-pressed={label === filter}
            onClick={() => setFilter(label)}
          >
            {label}
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
                    {project.startDate ? recordDate(project.startDate) : "TBD"}
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
          description={filter !== "All Projects" ? `Projects marked as ${filter.toLowerCase()} will appear here.` : "Create a project and keep its quotes, invoices, sessions, and notes together."}
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
