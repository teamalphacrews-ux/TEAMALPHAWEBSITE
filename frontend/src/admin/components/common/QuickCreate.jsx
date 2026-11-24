import { useMatch, useNavigate } from 'react-router-dom';
import { CalendarDays, Camera, FileText, FolderPlus, ListTodo, MessageSquare, Plus, ReceiptText, UserRoundPlus, Wallet } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import { quickCreateActions } from '../../../utils/quickCreateActions';
import { WorkspaceActionMenu } from '../operations/WorkspaceActionMenu';
import StudioIcon from './StudioIcon';

const icons = { enquiry: MessageSquare, client: UserRoundPlus, project: FolderPlus, quote: FileText, invoice: ReceiptText, task: ListTodo, event: IS_COMMERCIAL_DEPLOYMENT ? CalendarDays : Camera, expense: Wallet };

export default function QuickCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const contact = useMatch('/admin/contacts/:id');
  const project = useMatch('/admin/studio-projects/:id');
  const items = quickCreateActions(user, {
    commercial: IS_COMMERCIAL_DEPLOYMENT,
    contactId: contact?.params.id,
    projectId: project?.params.id,
  });
  if (!items.length) return null;
  return (
    <WorkspaceActionMenu
      primary
      hideChevron
      ariaLabel={IS_COMMERCIAL_DEPLOYMENT ? 'Create a record' : undefined}
      label={<><StudioIcon icon={Plus} size={18} /><span className="studio-quick-create-label">{IS_COMMERCIAL_DEPLOYMENT ? 'New' : 'Add'}</span></>}
      className="studio-quick-create"
      menuClassName="studio-quick-create-menu"
    >
      {items.map(([key, label, path]) => (
        <button type="button" key={key} onClick={() => navigate(path)}>
          <StudioIcon icon={icons[key]} size={18} />{label}
        </button>
      ))}
    </WorkspaceActionMenu>
  );
}
