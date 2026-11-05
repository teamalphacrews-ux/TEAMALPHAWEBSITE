import ClientCollectionForm from "./ClientCollectionForm";

export default function CreateGalleryModal({ isOpen, onClose, onGalleryCreated }) {
  if (!isOpen) return null;
  return <ClientCollectionForm onClose={onClose} onSaved={onGalleryCreated} />;
}
