import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import StudioButton from '../common/StudioButton';
import { OperationsError, OperationsModal } from '../operations/OperationsUI';
import { recordError, workspaceRequest } from '../operations/workspaceData';

const contactName = contact => [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed contact';

export function ContactDeleteButton({ contact, onDelete, detail = false }) {
  return <StudioButton
    type="button"
    variant="destructive"
    icon={Trash2}
    className="contact-delete-shortcut"
    aria-haspopup="dialog"
    aria-label={detail ? undefined : 'Delete contact ' + contactName(contact)}
    onClick={event => {
      event.currentTarget.focus({ preventScroll: true });
      onDelete(contact);
    }}
  >
    {detail ? 'Delete contact' : 'Delete'}
  </StudioButton>;
}

export function ContactDeleteDialog({ contact, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      await workspaceRequest('delete', '/api/contacts/' + encodeURIComponent(contact._id));
    } catch (err) {
      setError(recordError(err));
      setBusy(false);
      return;
    }
    toast.success('Contact moved to the Recovery bin.');
    onDeleted();
  };

  return (
    <OperationsModal
      title="Delete contact?"
      description="This removes the contact from the directory. The studio owner can restore it from Settings → Data → Recovery bin."
      busy={busy}
      onClose={onClose}
      footer={<>
        <StudioButton type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</StudioButton>
        <StudioButton type="button" variant="destructive" loading={busy} loadingLabel="Deleting contact" onClick={remove}>Delete contact</StudioButton>
      </>}
    >
      <p className="ops-delete-title contact-delete-name">{contactName(contact)}</p>
      {error && <OperationsError>{error}</OperationsError>}
    </OperationsModal>
  );
}
