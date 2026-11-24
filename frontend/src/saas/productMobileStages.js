import { CreditCard, FileText, FolderPlus, Wallet } from 'lucide-react';

export const mobileStages = [
  {
    id: 'create', label: 'Create a project', icon: FolderPlus,
    title: 'A new enquiry. A clear next step.',
    copy: 'Capture the client, date and venue while the details are fresh. Your next follow-up stays with the project, even when you are between shoots.',
    moment: 'After a client call', detail: 'Client details → one project',
  },
  {
    id: 'quote', label: 'Build a quote', icon: FileText,
    title: 'Send a considered proposal, wherever you are.',
    copy: 'Start with your saved collection, adjust the scope and share a quote link. Your client can review and accept it from their own phone.',
    moment: 'Between locations', detail: 'Saved collection → shareable quote',
  },
  {
    id: 'invoice', label: 'Issue an invoice', icon: CreditCard,
    title: 'Keep the booking moving after the yes.',
    copy: 'An accepted quote can create a draft invoice. Review the amount and payment schedule, then issue it to the same client smart link.',
    moment: 'After the quote is accepted', detail: 'Studio review → issued invoice',
  },
  {
    id: 'collect', label: 'Collect payments', icon: Wallet,
    title: 'Make it easy to take the next payment.',
    copy: 'Share your configured bank or UPI details through the client link. Check the transfer and record the receipt to keep the balance up to date.',
    moment: 'Before the next event', detail: 'Payment instructions → confirmed receipt',
  },
];
