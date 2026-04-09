import { useState, useEffect } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import axios from "axios";
import { Plus, Search, Filter, MoreHorizontal, FileText, CheckSquare, Users } from "lucide-react";
import LeadDetails from "../components/crm/LeadDetails";
import LeadForm from "../components/crm/LeadForm";
import InvoiceForm from "../components/crm/InvoiceForm";
import TaskPlanning from "../components/crm/task-planning/TaskPlanning";
import PhotographerList from "../components/crm/PhotographerList";
import { Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import API_BASE_URL from '../../utils/apiConfig';

export default function CRM() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("leads");
  const [leads, setLeads] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState("All");
  const { setIsFocusMode } = useOutletContext();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
  }, []);

  // Focus mode toggle to hide topbar when modals/panels are active
  useEffect(() => {
    const isAnyModalOpen = showLeadForm || showInvoiceForm || !!selectedLead;
    if (setIsFocusMode) {
      setIsFocusMode(isAnyModalOpen);
    }
    
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      if (setIsFocusMode) setIsFocusMode(false);
      document.body.style.overflow = 'auto';
    };
  }, [showLeadForm, showInvoiceForm, selectedLead, setIsFocusMode]);

  /* State for pre-filling invoice */
  const [invoiceDefaults, setInvoiceDefaults] = useState({ clientName: "" });


  const handleGenerateInvoice = (lead) => {
    setInvoiceDefaults({ clientName: lead.name });
    setShowInvoiceForm(true);
  };

  useEffect(() => {
    fetchLeads();
    fetchInvoices();
  }, []);


  useEffect(() => {
    const query = searchParams.get("search");
    if (query) setSearchQuery(query);
  }, [searchParams]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/leads`, {
        headers: { "x-auth-token": token }
      });
      setLeads(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch leads", err);
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/invoices`, {
        headers: { "x-auth-token": token }
      });
      setInvoices(response.data);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    }
  };

  const deleteInvoice = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      try {
        const token = localStorage.getItem("token");
        await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/invoices/${id}`, {
          headers: { "x-auth-token": token }
        });
        setInvoices(invoices.filter(inv => inv._id !== id));
        toast.success("Invoice deleted successfully");
      } catch (err) {
        console.error("Failed to delete invoice", err);
        toast.error("Failed to delete invoice");
      }
    }
  };


  const deleteLead = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this lead?")) {
      try {
        const token = localStorage.getItem("token");
        await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/leads/${id}`, {
          headers: { "x-auth-token": token }
        });
        setLeads(leads.filter(lead => lead._id !== id));
        toast.success("Lead archived/deleted successfully");
      } catch (err) {
        console.error("Failed to delete lead", err);
        toast.error("Failed to delete lead");
      }
    }
  };

  const handleLeadAdded = (newLead) => {
    setLeads([newLead, ...leads]);
    setShowLeadForm(false);
  };

  const filteredLeads = leads.filter(lead => {
    const nameMatch = (lead.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = (lead.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "All" || lead.status === filterStatus;
    return (nameMatch || emailMatch) && matchesFilter;
  });

  return (
    <div className="space-y-6 md:space-y-10 w-full animate-in fade-in duration-1500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-in slide-in-from-top-8 duration-1000 fill-mode-forwards">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-charcoal animate-gentle-fade">Team Alpha Photography</h1>
          <p className="text-sm text-warmgray mt-1 uppercase tracking-widest font-bold text-[10px]">The Wedding Artist</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'invoices') {
                setEditingInvoice(null);
                setInvoiceDefaults({ clientName: "" });
                setShowInvoiceForm(true);
            }
            else if (activeTab === 'team' || activeTab === 'tasks') setShowLeadForm(false);
            else setShowLeadForm(true);
          }}
          className={`w-full md:w-auto flex items-center justify-center gap-2 bg-charcoal text-white px-8 py-4 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-mutedbrown hover:-translate-y-1 transition-all duration-500 shadow-xl hover:shadow-2xl active:scale-95 ${activeTab === 'team' || activeTab === 'tasks' ? 'hidden' : ''}`}
        >
          <Plus size={16} />
          {activeTab === 'invoices' ? 'New Invoice' : 'Add New Lead'}
        </button>

      </div>

      {/* Tabs */}
      <div className="flex gap-4 md:gap-10 border-b border-[#e6e3df] overflow-x-auto no-scrollbar">
        {[
          { id: 'leads', name: 'Leads', icon: Users },
          { id: 'invoices', name: 'Invoices', icon: FileText },
          { id: 'tasks', name: 'Tasks & Planning', icon: CheckSquare },
          { id: 'team', name: 'Photographers', icon: UserPlus },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-4 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-charcoal' : 'text-warmgray hover:text-charcoal'
              }`}
          >
            <tab.icon size={14} />
            {tab.name}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-charcoal"></div>
            )}
          </button>
        ))}
      </div>

      {/* Content based on Tab */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {activeTab === 'leads' && (
          <div className="bg-white rounded-3xl border border-[#e6e3df]/40 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-[#f0f0f0] flex flex-col md:flex-row items-center justify-between gap-4 bg-ivory/10">
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-warmgray" size={16} />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#e6e3df] rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <select
                    className="appearance-none flex items-center justify-center gap-2 px-8 py-3 bg-white border border-[#e6e3df] rounded-2xl text-[10px] font-bold uppercase tracking-widest text-warmgray hover:text-charcoal transition-all shadow-sm focus:outline-none"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="All">All Status</option>
                    <option value="New">New</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Converted">Converted</option>
                  </select>
                  <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-warmgray" />
                </div>
              </div>
              <div className="hidden md:block text-[10px] uppercase tracking-widest font-bold text-warmgray bg-ivory/50 px-4 py-2 rounded-full">
                {leads.length} Active Leads
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ivory text-[10px] uppercase tracking-widest text-warmgray">
                    <th className="px-8 py-6 font-bold">Client Profile</th>
                    <th className="px-8 py-6 font-bold hidden md:table-cell">Status</th>
                    <th className="px-8 py-6 font-bold hidden lg:table-cell">Inquiry Date</th>
                    <th className="px-8 py-6 font-bold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory text-sm">
                  {filteredLeads.length > 0 ? filteredLeads.map((lead, idx) => (
                    <tr
                      key={lead._id}
                      className="hover:bg-white hover:shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-all duration-500 cursor-pointer group bg-transparent border-transparent animate-in fade-in slide-in-from-bottom-4"
                      style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-ivory text-mutedbrown rounded-2xl flex items-center justify-center font-serif text-xl border border-transparent group-hover:bg-charcoal group-hover:text-white transition-all shadow-sm">
                            {(lead.name || "?")[0]}
                          </div>
                          <div>
                            <div className="font-bold text-charcoal text-base">{lead.name}</div>
                            <div className="text-[11px] text-warmgray mt-0.5">{lead.email}</div>
                            <div className="md:hidden mt-2">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${lead.status === 'New' ? 'bg-blue-50 text-blue-600' :
                                lead.status === 'Follow-up' ? 'bg-amber-50 text-amber-600' :
                                  lead.status === 'Meeting' ? 'bg-purple-50 text-purple-600' :
                                    lead.status === 'Negotiation' ? 'bg-orange-50 text-orange-600' :
                                      lead.status === 'Converted' ? 'bg-green-50 text-green-600' :
                                        'bg-gray-100 text-gray-600'
                                }`}>
                                {lead.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 hidden md:table-cell">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${lead.status === 'New' ? 'bg-blue-50 text-blue-600' :
                          lead.status === 'Follow-up' ? 'bg-amber-50 text-amber-600' :
                            lead.status === 'Meeting' ? 'bg-purple-50 text-purple-600' :
                              lead.status === 'Negotiation' ? 'bg-orange-50 text-orange-600' :
                                lead.status === 'Converted' ? 'bg-green-50 text-green-600' :
                                  'bg-gray-100 text-gray-600'
                          }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 hidden lg:table-cell text-xs text-warmgray font-medium italic">
                        {new Date(lead.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <div className="mt-1">
                          <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${lead.paymentStatus === 'Paid' ? 'border-green-200 text-green-700 bg-green-50' :
                            lead.paymentStatus === 'Deposit Paid' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                              'border-red-200 text-red-600 bg-red-50'
                            }`}>
                            {lead.paymentStatus || 'Unpaid'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => deleteLead(lead._id, e)}
                            className="text-warmgray hover:text-red-500 p-3 rounded-full hover:bg-red-50 transition-all shadow-sm hover:shadow-md"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                            className="text-warmgray hover:text-charcoal p-3 rounded-full hover:bg-white transition-all shadow-sm hover:shadow-md"
                          >
                            <MoreHorizontal size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="px-8 py-32 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-70 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                          <Users size={56} strokeWidth={1} className="text-warmgray animate-float" />
                          <p className="font-serif italic text-xl text-warmgray mb-2 animate-gentle-fade">Searching for the next premium inquiry...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
        }

        {
          activeTab === 'invoices' && (
            <div className="bg-white rounded-3xl border border-[#e6e3df]/40 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 border-b border-ivory/50 flex justify-between items-center bg-ivory/10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal">Registry of Generated Invoices</h3>
                    <div className="text-[10px] font-bold text-warmgray uppercase tracking-widest">{invoices.length} Invoices Found</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-ivory text-[10px] uppercase tracking-widest text-warmgray">
                                <th className="px-8 py-6 font-bold">Client / Date</th>
                                <th className="px-8 py-6 font-bold">Status</th>
                                <th className="px-8 py-6 font-bold">Total Amount</th>
                                <th className="px-8 py-6 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ivory text-sm">
                            {invoices.length > 0 ? invoices.map((inv, idx) => (
                                <tr key={inv._id} className="hover:bg-ivory/5 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-charcoal">{inv.clientName}</div>
                                        <div className="text-[10px] text-warmgray mt-1">{new Date(inv.invoiceDate).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${
                                            inv.status === 'Paid' ? 'bg-green-50 text-green-600' :
                                            inv.status === 'Cancelled' ? 'bg-red-50 text-red-600' :
                                            'bg-amber-50 text-amber-600'
                                        }`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 font-serif text-charcoal">
                                        ₹{inv.total?.toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => { setEditingInvoice(inv); setShowInvoiceForm(true); }}
                                                className="p-2 hover:bg-ivory rounded-lg text-warmgray hover:text-charcoal transition-colors"
                                            >
                                                <FileText size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => deleteInvoice(inv._id, e)}
                                                className="p-2 hover:bg-red-50 rounded-lg text-warmgray hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center text-warmgray italic">No invoices found. Generate one from a lead!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          )
        }


        {
          activeTab === 'tasks' && (
            <TaskPlanning user={user} />
          )
        }

        {
          activeTab === 'team' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <PhotographerList />
            </div>
          )
        }
      </div >

      {/* Forms & Modals */}
      {
        showLeadForm && (
          <LeadForm
            onClose={() => setShowLeadForm(false)}
            onLeadAdded={handleLeadAdded}
          />
        )
      }

      {
        showInvoiceForm && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 w-screen h-screen"
            style={{ 
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <InvoiceForm
              onClose={() => {
                setShowInvoiceForm(false);
                setInvoiceDefaults({ clientName: "" });
                setEditingInvoice(null);
                fetchInvoices();
              }}
              initialData={editingInvoice}
              initialClientName={invoiceDefaults.clientName}
            />
          </div>
        )

      }

      {/* Side Panel for Lead Details */}
      {
        selectedLead && (
          <LeadDetails
            user={user}
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onGenerateInvoice={() => handleGenerateInvoice(selectedLead)}
          />
        )
      }
    </div >
  );
}
