import { useState, useEffect } from "react";
import axios from "axios";
import { X, Mail, Phone, Calendar, Tag, User, Users, Plus, CheckCircle2, MoreVertical, Trash2, Edit2, MapPin, Clock, Save } from "lucide-react";
import FollowUpList from "./FollowUpList";
import TaskList from "./TaskList";
import toast from "react-hot-toast";
import PhotographerProfile from "./PhotographerProfile";

export default function LeadDetails({ lead: initialLead, onClose, onGenerateInvoice }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  console.log("Rendering LeadDetails", { hasGenerateInvoice: !!onGenerateInvoice });
  const [lead, setLead] = useState(initialLead);
  const [teamMembers, setTeamMembers] = useState(initialLead.people || []);
  const [allPhotographers, setAllPhotographers] = useState([]);
  const [selectedPhotographer, setSelectedPhotographer] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedPhotographerProfile, setSelectedPhotographerProfile] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...initialLead });

  const [showFullLog, setShowFullLog] = useState(false);

  const handleUpdateNotes = async (notes) => {
    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, { notes }, authHeader);
      setLead(response.data);
      toast.success("Notes updated");
    } catch (e) { toast.error("Failed to save notes"); }
  };

  const handleSaveLead = async () => {
    setSaving(true);
    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, editData, authHeader);
      setLead(response.data);
      setIsEditing(false);
      toast.success("Lead details updated!");
    } catch (err) {
      console.error("Failed to update lead", err);
      toast.error("Failed to update lead details.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchPhotographers();
  }, []);

  const fetchPhotographers = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/photographers`, authHeader);
      setAllPhotographers(response.data);
    } catch (err) {
      console.error("Failed to fetch photographers", err);
    }
  };

  const addMember = async () => {
    if (selectedPhotographer && !teamMembers.includes(selectedPhotographer)) {
      const newTeam = [...teamMembers, selectedPhotographer];
      setSaving(true);
      try {
        const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, {
          people: newTeam
        }, authHeader);
        setTeamMembers(response.data.people);
        setLead(response.data);
        setSelectedPhotographer("");
        setShowAddMember(false);
        toast.success(`${selectedPhotographer} assigned to this project!`);
      } catch (err) {
        console.error("Failed to update team", err);
        toast.error("Failed to assign team member.");
      } finally {
        setSaving(false);
      }
    }
  };

  const removeMember = async (member) => {
    // e.stopPropagation() handled in onClick
    const newTeam = teamMembers.filter(m => m !== member);
    setSaving(true);
    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, {
        people: newTeam
      }, authHeader);
      setTeamMembers(response.data.people);
      setLead(response.data);
      toast.success(`${member} removed from project.`);
    } catch (err) {
      console.error("Failed to remove team member", err);
      toast.error("Failed to remove team member.");
    } finally {
      setSaving(false);
    }
  };

  const sendReminder = async (member) => {
    // e.stopPropagation() handled in onClick
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}/remind/${member}`, {}, authHeader);
      toast.success(`Reminder sent to ${member}!`);
    } catch (err) {
      console.error("Failed to send reminder", err);
      toast.error("Failed to send reminder.");
    }
  };

  const handlePhotographerClick = async (member) => {
    if (!member) return;
    const photographer = allPhotographers.find(p => p.name === member);
    if (photographer) {
      setSelectedPhotographerProfile(photographer);
    } else {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/photographers`, authHeader);
        const found = res.data.find(p => p.name === member);
        if (found) setSelectedPhotographerProfile(found);
      } catch (e) { console.error(e); }
    }
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-charcoal/20 backdrop-blur-md z-50 flex justify-end">
      <div className="w-full max-w-xl bg-ivory h-screen overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-ivory/90 backdrop-blur-xl px-4 sm:px-6 md:px-10 py-6 md:py-8 border-b border-[#e6e3df] flex justify-between items-center z-40 w-full">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-[#e6e3df] shadow-sm font-serif text-2xl text-mutedbrown uppercase">
              {(lead.name || "?")[0]}
            </div>
            <div>
              <h2 className="font-serif text-2xl md:text-3xl text-charcoal">{lead.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                {isEditing ? (
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold bg-white border border-[#e6e3df] text-charcoal focus:outline-mutedbrown appearance-none"
                  >
                    <option>New</option>
                    <option>Follow-up</option>
                    <option>Meeting</option>
                    <option>Negotiation</option>
                    <option>Converted</option>
                    <option>Archived</option>
                  </select>
                ) : (
                  <span className={`text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold ${lead.status === 'New' ? 'bg-blue-50 text-blue-600' :
                    lead.status === 'Follow-up' ? 'bg-amber-50 text-amber-600' :
                      lead.status === 'Meeting' ? 'bg-purple-50 text-purple-600' :
                        lead.status === 'Negotiation' ? 'bg-orange-50 text-orange-600' :
                          lead.status === 'Converted' ? 'bg-green-50 text-green-600' :
                            'bg-gray-100 text-gray-600'
                    }`}>
                    {lead.status}
                  </span>
                )}
                <span className="text-[9px] text-warmgray uppercase tracking-widest font-bold opacity-60">
                  ID: #{lead._id ? lead._id.slice(-6).toUpperCase() : 'NEW'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => {
                  setEditData(lead);
                  setIsEditing(true);
                }}
                className="p-2 hover:bg-white rounded-full transition-all text-warmgray hover:text-charcoal"
                title="Edit Lead Details"
              >
                <Edit2 size={20} />
              </button>
            ) : (
              <button
                onClick={handleSaveLead}
                disabled={saving}
                className="p-2 bg-charcoal text-white rounded-full transition-all hover:bg-mutedbrown"
                title="Save Changes"
              >
                <Save size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-3 hover:bg-white rounded-full transition-all text-warmgray hover:text-charcoal hover:rotate-90"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-10 space-y-8 md:space-y-12 flex-1">
          {/* Quick Info Grid */}
          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-sm bg-white/50 p-4 md:p-6 rounded-3xl border border-ivory">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-warmgray">
                <Mail size={16} strokeWidth={1.5} />
                {isEditing ? (
                  <input
                    value={editData.email}
                    onChange={e => setEditData({ ...editData, email: e.target.value })}
                    className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown"
                  />
                ) : (
                  <span className="text-charcoal font-medium truncate">{lead.email}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-warmgray">
                <Phone size={16} strokeWidth={1.5} />
                {isEditing ? (
                  <input
                    value={editData.phone}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown"
                  />
                ) : (
                  <span className="text-charcoal font-medium">{lead.phone || "Not provided"}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-warmgray">
                <MapPin size={16} strokeWidth={1.5} />
                {isEditing ? (
                  <input
                    placeholder="Event Location"
                    value={editData.eventLocation || ""}
                    onChange={e => setEditData({ ...editData, eventLocation: e.target.value })}
                    className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown"
                  />
                ) : (
                  <span className="text-charcoal font-medium">{lead.eventLocation || "Location TBD"}</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-warmgray">
                <Tag size={16} strokeWidth={1.5} />
                {isEditing ? (
                  <select
                    value={editData.eventType}
                    onChange={e => setEditData({ ...editData, eventType: e.target.value })}
                    className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown appearance-none"
                  >
                    <option>Wedding</option>
                    <option>Pre-Wedding</option>
                    <option>Engagement</option>
                    <option>Reception</option>
                    <option>Fashion Shoot</option>
                  </select>
                ) : (
                  <span className="text-charcoal font-medium">{lead.eventType || "General Session"}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-warmgray">
                <Calendar size={16} strokeWidth={1.5} />
                {isEditing ? (
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[9px] uppercase font-bold text-mutedbrown">Event Date</label>
                    <input
                      type="date"
                      value={editData.eventDate ? new Date(editData.eventDate).toISOString().split('T')[0] : ""}
                      onChange={e => setEditData({ ...editData, eventDate: e.target.value })}
                      className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown"
                    />
                    <label className="text-[9px] uppercase font-bold text-mutedbrown mt-1">Next Follow-up</label>
                    <input
                      type="date"
                      value={editData.followUpDate ? new Date(editData.followUpDate).toISOString().split('T')[0] : ""}
                      onChange={e => setEditData({ ...editData, followUpDate: e.target.value })}
                      className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown"
                    />
                  </div>
                ) : (
                  <span className="text-charcoal font-medium">
                    {lead.eventDate ? new Date(lead.eventDate).toLocaleDateString() : 'Date TBD'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-warmgray">
                <Clock size={16} strokeWidth={1.5} />
                {isEditing ? (
                  <input
                    type="time"
                    value={editData.eventTime || ""}
                    onChange={e => setEditData({ ...editData, eventTime: e.target.value })}
                    className="bg-white border border-ivory rounded px-2 py-1 w-full text-charcoal focus:outline-mutedbrown"
                  />
                ) : (
                  <span className="text-charcoal font-medium">{lead.eventTime || "Time TBD"}</span>
                )}
              </div>
            </div>

            {/* Remarks Section */}
            <div className="md:col-span-2 bg-ivory/30 p-5 rounded-2xl border border-ivory/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-mutedbrown">
                  <Tag size={12} /> Remarks / Inquiry Status
                </h4>
              </div>
              {isEditing ? (
                <textarea
                  className="w-full bg-white border border-ivory rounded px-3 py-3 text-sm focus:outline-mutedbrown resize-none min-h-[80px]"
                  value={editData.remarks || ""}
                  onChange={e => setEditData({ ...editData, remarks: e.target.value })}
                  placeholder="Details of inquiry, client responses, what is happening..."
                />
              ) : (
                <p className="text-charcoal text-sm leading-relaxed whitespace-pre-wrap">{lead.remarks || "No remarks added yet."}</p>
              )}
            </div>

            <div className="md:col-span-2 bg-ivory/30 p-5 rounded-2xl border border-ivory/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-mutedbrown">Payment Plan</h4>
                {!isEditing && (
                  <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 rounded-full ${lead.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' :
                    lead.paymentStatus === 'Deposit Paid' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                    {lead.paymentStatus || 'Unpaid'}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9px] text-warmgray uppercase tracking-wider font-bold">Total (₹)</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-ivory rounded px-2 py-1 text-sm mt-1 focus:outline-mutedbrown"
                      value={editData.totalAmount || 0}
                      onChange={e => setEditData({ ...editData, totalAmount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-warmgray uppercase tracking-wider font-bold">Received (₹)</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-ivory rounded px-2 py-1 text-sm mt-1 focus:outline-mutedbrown"
                      value={editData.depositAmount || 0}
                      onChange={e => setEditData({ ...editData, depositAmount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-warmgray uppercase tracking-wider font-bold">Status</label>
                    <select
                      className="w-full bg-white border border-ivory rounded px-2 py-1 text-sm mt-1 focus:outline-mutedbrown appearance-none"
                      value={editData.paymentStatus || 'Unpaid'}
                      onChange={e => setEditData({ ...editData, paymentStatus: e.target.value })}
                    >
                      <option>Unpaid</option>
                      <option>Deposit Paid</option>
                      <option>Paid</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div>
                    <p className="text-[10px] text-warmgray uppercase tracking-wider font-bold">Total Value</p>
                    <p className="font-serif text-xl text-charcoal">₹{(lead.totalAmount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-warmgray uppercase tracking-wider font-bold">Received</p>
                    <p className="font-serif text-xl text-emerald-700">₹{(lead.depositAmount || 0).toLocaleString()}</p>
                  </div>
                  <div className="flex-1 flex flex-col justify-end">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-warmgray mb-1">
                      <span>Progress</span>
                      <span>{Math.min(100, Math.round(((lead.depositAmount || 0) / (lead.totalAmount || 1)) * 100))}%</span>
                    </div>
                    <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-ivory">
                      <div
                        className={`h-full transition-all duration-500 ${lead.paymentStatus === 'Paid' ? 'bg-green-500' : 'bg-gold'}`}
                        style={{ width: `${Math.min(100, ((lead.depositAmount || 0) / (lead.totalAmount || 1)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Team Sync Section */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl flex items-center gap-2">
                <Users size={20} className="text-mutedbrown" />
                Studio Team Sync
              </h3>
              <button
                onClick={() => setShowAddMember(true)}
                className="text-[10px] uppercase font-bold tracking-widest text-mutedbrown hover:text-charcoal transition-colors bg-white px-4 py-2 rounded-full border border-ivory shadow-sm"
              >
                Assign Team
              </button>
            </div>

            {showAddMember && (
              <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                <select
                  className="flex-1 bg-white border border-[#e6e3df] rounded-xl px-4 py-2 text-xs focus:outline-none appearance-none"
                  value={selectedPhotographer}
                  onChange={(e) => setSelectedPhotographer(e.target.value)}
                >
                  <option value="">Select Photographer...</option>
                  {allPhotographers.map(p => (
                    <option key={p._id} value={p.name}>{p.name} ({p.specialty})</option>
                  ))}
                </select>
                <button
                  onClick={addMember}
                  disabled={!selectedPhotographer || saving}
                  className="bg-charcoal text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                >
                  {saving ? '...' : 'Add'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {teamMembers.length > 0 ? teamMembers.map((member, idx) => (
                <div
                  key={idx}
                  onClick={() => handlePhotographerClick(member)}
                  className="flex items-center gap-3 bg-white border border-ivory px-4 py-2 rounded-2xl shadow-sm group cursor-pointer hover:border-mutedbrown transition-all"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-bold text-charcoal">{member}</span>
                  {/* <button
                    onClick={(e) => { e.stopPropagation(); sendReminder(member); }}
                    className="text-warmgray hover:text-gold opacity-0 group-hover:opacity-100 transition-all mr-1"
                    title="Send Reminder Email"
                  >
                    <Bell size={12} />
                  </button> */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMember(member); }}
                    className="text-warmgray hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              )) : (
                <p className="text-xs text-warmgray italic">No team members assigned yet.</p>
              )}
            </div>
          </div>

          {/* Workflow Sections */}
          <div className="grid grid-cols-1 gap-10">
            <TaskList leadId={lead._id} tasks={lead.tasks || []} />
            <FollowUpList
              lead={lead}
              onUpdate={(updatedLead) => setLead(updatedLead)}
            />
          </div>
        </div>


        {/* Footer Actions */}
        <div className="p-4 sm:p-6 md:p-8 border-t border-[#e6e3df]/60 bg-white/80 backdrop-blur-xl sticky bottom-0 rounded-b-2xl z-20 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)]">
          <div className="flex gap-4">
            <button
              onClick={onGenerateInvoice}
              className="relative overflow-hidden group flex-1 bg-charcoal text-white text-[11px] uppercase tracking-[0.2em] font-bold py-5 rounded-2xl hover:bg-mutedbrown hover:-translate-y-0.5 transition-all shadow-lg hover:shadow-xl active:translate-y-0 active:scale-95">
              <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              Generate Invoice
            </button>
            <button
              onClick={() => setShowFullLog(true)}
              className="flex-1 bg-ivory border border-[#e6e3df] text-charcoal text-[11px] uppercase tracking-[0.2em] font-bold py-5 rounded-2xl hover:bg-white hover:border-charcoal hover:-translate-y-0.5 transition-all shadow-sm hover:shadow-md active:translate-y-0 active:scale-95"
            >
              Full Log
            </button>
          </div>
        </div>
      </div >

      {selectedPhotographerProfile && (
        <PhotographerProfile
          photographer={selectedPhotographerProfile}
          onClose={() => setSelectedPhotographerProfile(null)}
          onUpdate={(updated) => {
            setSelectedPhotographerProfile(updated);
            setAllPhotographers(prev => prev.map(p => p._id === updated._id ? updated : p));
          }}
        />
      )
      }

      {
        showFullLog && (
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-60 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6 border-b border-ivory pb-4">
                <h3 className="font-serif text-2xl text-charcoal">Activity Log & Notes</h3>
                <button onClick={() => setShowFullLog(false)}><X size={20} className="text-warmgray hover:text-charcoal" /></button>
              </div>

              <div className="space-y-6">
                <div className="bg-ivory/30 p-4 rounded-2xl">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-warmgray mb-2">Record Details</h4>
                  <div className="text-xs space-y-1 text-charcoal">
                    <p><span className="font-bold text-mutedbrown">Created:</span> {new Date(lead.createdAt || Date.now()).toLocaleString()}</p>
                    <p><span className="font-bold text-mutedbrown">Last Updated:</span> {new Date(lead.updatedAt || Date.now()).toLocaleString()}</p>
                    <p><span className="font-bold text-mutedbrown">Lead ID:</span> {lead._id}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-warmgray mb-3 flex items-center gap-2">
                    <Edit2 size={12} /> Key Notes
                  </h4>
                  <textarea
                    className="w-full h-32 bg-white border border-[#e6e3df] rounded-2xl p-4 text-sm focus:outline-mutedbrown resize-none"
                    placeholder="Add important notes about this client..."
                    value={lead.notes || ""}
                    onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                    onBlur={(e) => handleUpdateNotes(e.target.value)}
                  ></textarea>
                  <p className="text-[10px] text-warmgray mt-2 italic">* Notes are auto-saved when you click away.</p>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
