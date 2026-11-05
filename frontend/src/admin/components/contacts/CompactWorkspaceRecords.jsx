import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Pencil } from "lucide-react";
import { recordDate } from "../operations/workspaceData";

export function CompactContacts({ contacts, onEdit }) {
  return <ul className="reference-mobile-records" aria-label="Contacts">
    {contacts.map(contact => {
      const name = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unnamed contact";
      const type = contact.contactType || "Other";
      return <li className="reference-mobile-record" key={contact._id}>
        <div className="reference-mobile-record-heading">
          <span className="reference-avatar small" aria-hidden="true">{`${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase() || "?"}</span>
          <h2><Link to={`/admin/contacts/${contact._id}`}>{name}</Link></h2>
          <button type="button" className="reference-icon-button" aria-label={`Edit ${name}`} onClick={() => onEdit(contact)}><Pencil size={16} aria-hidden="true" /></button>
        </div>
        <div className="reference-mobile-contact-info">
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
          {contact.company && <span>{contact.company}</span>}
        </div>
        <dl className="reference-mobile-record-meta">
          <div><dt>Added</dt><dd><CalendarDays size={13} aria-hidden="true" />{recordDate(contact.createdAt)}</dd></div>
          <div><dt>Type</dt><dd><span className={`reference-status ${type.toLowerCase()}`}>{type}</span></dd></div>
        </dl>
        <Link className="reference-mobile-record-action" to={`/admin/contacts/${contact._id}`} aria-label={`Open contact ${name}`}>Open contact<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </li>;
    })}
  </ul>;
}

export function CompactProjects({ projects }) {
  return <ul className="reference-mobile-records" aria-label="Projects">
    {projects.map(project => {
      const contact = project.contactId;
      const clientName = contact && `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
      const status = project.status || "Inquiry";
      return <li className="reference-mobile-record" key={project._id}>
        <div className="reference-mobile-record-heading"><h2><Link to={`/admin/studio-projects/${project._id}`}>{project.name || "Untitled project"}</Link></h2></div>
        <div className="reference-mobile-contact-info">
          {clientName && <Link to={`/admin/contacts/${contact._id}`}>{clientName}</Link>}
          {project.type && <span>{project.type}</span>}
        </div>
        <dl className="reference-mobile-record-meta">
          <div><dt>Project date</dt><dd><CalendarDays size={13} aria-hidden="true" />{project.startDate ? recordDate(project.startDate) : "To be confirmed"}</dd></div>
          <div><dt>Status</dt><dd><span className={`reference-status ${status.toLowerCase()}`}>{status}</span></dd></div>
        </dl>
        <Link className="reference-mobile-record-action" to={`/admin/studio-projects/${project._id}`} aria-label={`Open project ${project.name}`}>Open project<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </li>;
    })}
  </ul>;
}
