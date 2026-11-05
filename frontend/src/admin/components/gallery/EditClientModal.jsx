import ClientCollectionForm from "./ClientCollectionForm";

export default function EditClientModal({ isOpen, onClose, client, onSuccess }) {
  if (!isOpen || !client) return null;
  return <ClientCollectionForm key={client._id} client={client} onClose={onClose} onSaved={onSuccess} />;
}
