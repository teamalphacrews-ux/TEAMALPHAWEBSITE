import { Mail, Pencil, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { recordDate } from '../components/operations/workspaceData';

export default function ContactDirectory({ contacts, onEdit }) {
  return <div className="record-people" aria-label="Contact cards">{contacts.map((contact, index) => {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed contact';
    const initials = (name.match(/[\p{L}\p{N}]+/gu) || []).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const type = contact.contactType || 'Other';
    return <article className="record-person" key={contact._id} style={{ '--record-order': Math.min(index, 10) }}>
      <header><span className="record-avatar" data-type={type} aria-hidden="true">{initials}</span><span className={'reference-status ' + type.toLowerCase()}>{type}</span></header>
      <div className="record-person-identity">
        <h2><Link to={'/admin/contacts/' + contact._id}>{name}</Link></h2>
        {contact.company && <p>{contact.company}</p>}
      </div>
      <div className="record-person-methods">
        {contact.email && <a href={'mailto:' + contact.email}><Mail size={14} />{contact.email}</a>}
        {contact.phone && <a href={'tel:' + contact.phone}><Phone size={14} />{contact.phone}</a>}
      </div>
      <footer><small>{contact.createdAt && 'Added ' + recordDate(contact.createdAt)}</small>
        {onEdit && <button type="button" className="record-open" aria-label={'Edit ' + name} onClick={() => onEdit(contact)}><Pencil size={15} /></button>}
      </footer></article>;
  })}</div>;
}
