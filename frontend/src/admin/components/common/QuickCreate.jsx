import StudioIcon from './StudioIcon';
import {Plus,MessageSquare,FileText,ReceiptText,Camera,Wallet} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {WorkspaceActionMenu} from '../operations/WorkspaceActionMenu';
export default function QuickCreate(){
 const navigate=useNavigate();
 const items=[['Enquiry',MessageSquare,'/admin/crm?new=1'],['Quotation',FileText,'/admin/quotations?new=1'],['Invoice',ReceiptText,'/admin/invoices/new'],['Expense',Wallet,'/admin/finance?view=ledger&new=expense'],['Shoot',Camera,'/admin/calendar?new=1']];
 return <WorkspaceActionMenu primary hideChevron label={<><StudioIcon icon={Plus} size={18}/><span className="studio-quick-create-label">Add</span></>} className="studio-quick-create" menuClassName="studio-quick-create-menu">{items.map(([label,Icon,path])=><button type="button" key={path} onClick={()=>navigate(path)}><StudioIcon icon={Icon} size={18}/>{label}</button>)}</WorkspaceActionMenu>;
}
