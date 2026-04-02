import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, Mail, Phone, Calendar, Tag, User, Users, Plus, CheckCircle2, MoreVertical, Trash2, Edit2, MapPin, Clock, Save, Loader2 } from "lucide-react";
import FollowUpList from "./FollowUpList";
import TaskPlanning from "./task-planning/TaskPlanning";
import toast from "react-hot-toast";
import PhotographerProfile from "./PhotographerProfile";

export default function LeadDetails({ user, lead: initialLead, onClose, onGenerateInvoice }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
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

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/10 backdrop-blur-[6px] z-[9999] flex justify-end animate-in fade-in duration-300">
                <div className="w-full max-w-xl bg-white/80 backdrop-blur-[32px] h-screen overflow-hidden shadow-[-20px_0_50px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-500 flex flex-col relative border-l border-white/40">
                    {/* Premium Gradient Header */}
                    <div className="sticky top-0 z-40 bg-gradient-to-br from-[#F0F4FF] via-[#F8F4FF] to-[#FFF9F0] border-b border-white/40 px-6 py-8 md:px-10 flex justify-between items-center w-full">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-white/80 rounded-2xl flex items-center justify-center border border-white shadow-sm font-luxury text-3xl text-[#2d2d2d] uppercase">
                                {(lead.name || "?")[0]}
                            </div>
                            <div>
                                <h2 className="font-luxury text-2xl md:text-3xl text-[#2d2d2d] tracking-tight leading-none">{lead.name}</h2>
                                <div className="flex items-center gap-3 mt-3">
                                    {isEditing ? (
                                        <div className="relative group">
                                            <select
                                                value={editData.status}
                                                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                className="text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full font-black bg-white/60 border border-white/80 text-[#2d2d2d] focus:outline-none focus:ring-4 focus:ring-[#D9CDEB]/20 appearance-none transition-all cursor-pointer hover:bg-white"
                                            >
                                                <option>New</option>
                                                <option>Follow-up</option>
                                                <option>Meeting</option>
                                                <option>Negotiation</option>
                                                <option>Converted</option>
                                                <option>Archived</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <span className={`text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full font-black shadow-sm border border-white/60 ${lead.status === 'New' ? 'bg-blue-100/50 text-blue-600' :
                                            lead.status === 'Follow-up' ? 'bg-amber-100/50 text-amber-600' :
                                                lead.status === 'Meeting' ? 'bg-purple-100/50 text-purple-600' :
                                                    lead.status === 'Negotiation' ? 'bg-orange-100/50 text-orange-600' :
                                                        lead.status === 'Converted' ? 'bg-green-100/50 text-green-600' :
                                                            'bg-gray-100/50 text-gray-500'
                                        }`}>
                                            {lead.status}
                                        </span>
                                    )}
                                    <span className="text-[9px] text-[#8a8a8a] uppercase tracking-widest font-black opacity-60 bg-white/40 px-2.5 py-1 rounded-lg border border-white/40">
                                        LID-{lead._id ? lead._id.slice(-6).toUpperCase() : 'NEW'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {!isEditing ? (
                                <button
                                    onClick={() => {
                                        setEditData(lead);
                                        setIsEditing(true);
                                    }}
                                    className="p-3 bg-white/60 hover:bg-white rounded-full transition-all text-[#8a8a8a] hover:text-[#2d2d2d] border border-white/60 hover:shadow-sm"
                                    title="Edit Inquiry Details"
                                >
                                    <Edit2 size={18} />
                                </button>
                            ) : (
                                <button
                                    disabled={saving}
                                    onClick={handleSaveLead}
                                    className="px-5 py-2.5 bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all border border-white/60 shadow-sm active:scale-[0.98]"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin text-[#4a4a4a]" /> : <Save size={14} className="text-[#4a4a4a]" />}
                                    {saving ? "Archiving..." : "Commit"}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-3 bg-white/60 hover:bg-white rounded-full transition-all text-[#8a8a8a] hover:text-[#2d2d2d] border border-white/60 hover:rotate-90 hover:shadow-sm"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm bg-white/40 p-6 rounded-[28px] border border-white/60 shadow-sm">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 text-[#8a8a8a]">
                                    <Mail size={16} className="opacity-60" />
                                    {isEditing ? (
                                        <input
                                            value={editData.email}
                                            onChange={e => setEditData({ ...editData, email: e.target.value })}
                                            className="bg-white/60 border border-white/80 rounded-xl px-3 py-2 w-full text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] shadow-inner"
                                        />
                                    ) : (
                                        <span className="text-[#2d2d2d] font-bold truncate">{lead.email}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-[#8a8a8a]">
                                    <Phone size={16} className="opacity-60" />
                                    {isEditing ? (
                                        <input
                                            value={editData.phone}
                                            onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                            className="bg-white/60 border border-white/80 rounded-xl px-3 py-2 w-full text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] shadow-inner"
                                        />
                                    ) : (
                                        <span className="text-[#2d2d2d] font-bold">{lead.phone || "Private Axis"}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-[#8a8a8a]">
                                    <MapPin size={16} className="opacity-60" />
                                    {isEditing ? (
                                        <input
                                            placeholder="Destination"
                                            value={editData.eventLocation || ""}
                                            onChange={e => setEditData({ ...editData, eventLocation: e.target.value })}
                                            className="bg-white/60 border border-white/80 rounded-xl px-3 py-2 w-full text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] shadow-inner"
                                        />
                                    ) : (
                                        <span className="text-[#2d2d2d] font-bold">{lead.eventLocation || "Location TBD"}</span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 text-[#8a8a8a]">
                                    <Tag size={16} className="opacity-60" />
                                    {isEditing ? (
                                        <select
                                            value={editData.eventType}
                                            onChange={e => setEditData({ ...editData, eventType: e.target.value })}
                                            className="bg-white/60 border border-white/80 rounded-xl px-3 py-2 w-full text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] appearance-none shadow-inner"
                                        >
                                            <option>Wedding</option>
                                            <option>Pre-Wedding</option>
                                            <option>Engagement</option>
                                            <option>Reception</option>
                                            <option>Fashion Shoot</option>
                                        </select>
                                    ) : (
                                        <span className="text-[#2d2d2d] font-bold uppercase tracking-widest text-[10px] bg-[#F0F4FF] px-2.5 py-1 rounded-lg border border-[#D9CDEB]">{lead.eventType || "Bespoke"}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-[#8a8a8a]">
                                    <Calendar size={16} className="opacity-60" />
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editData.eventDate ? new Date(editData.eventDate).toISOString().split('T')[0] : ""}
                                            onChange={e => setEditData({ ...editData, eventDate: e.target.value })}
                                            className="bg-white/60 border border-white/80 rounded-xl px-3 py-2 w-full text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] shadow-inner"
                                        />
                                    ) : (
                                        <span className="text-[#2d2d2d] font-bold">
                                            {lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-[#8a8a8a]">
                                    <Clock size={16} className="opacity-60" />
                                    {isEditing ? (
                                        <input
                                            type="time"
                                            value={editData.eventTime || ""}
                                            onChange={e => setEditData({ ...editData, eventTime: e.target.value })}
                                            className="bg-white/60 border border-white/80 rounded-xl px-3 py-2 w-full text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] shadow-inner"
                                        />
                                    ) : (
                                        <span className="text-[#2d2d2d] font-bold">{lead.eventTime || "Time TBD"}</span>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-2 bg-white/60 p-6 rounded-[24px] border border-white/80 mt-2">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a8a] mb-4">
                                    <Tag size={12} /> Inquiry Brief
                                </h4>
                                {isEditing ? (
                                    <textarea
                                        className="w-full bg-white/80 border border-white/80 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-[#D9CDEB] resize-none min-h-[100px] shadow-inner"
                                        value={editData.remarks || ""}
                                        onChange={e => setEditData({ ...editData, remarks: e.target.value })}
                                    />
                                ) : (
                                    <p className="text-[#4a4a4a] text-sm leading-relaxed whitespace-pre-wrap font-medium">{lead.remarks || "No additional provisions added yet."}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-luxury text-xl flex items-center gap-3 text-[#2d2d2d]">
                                    <Users size={20} className="text-[#D9CDEB]" /> Artistic Sync
                                </h3>
                                <button
                                    onClick={() => setShowAddMember(true)}
                                    className="text-[10px] uppercase font-black tracking-[0.2em] text-[#5a5a5a] bg-white/60 px-5 py-2.5 rounded-full border border-white/80 shadow-sm hover:shadow-md hover:bg-white transition-all"
                                >
                                    Deploy Talent
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {teamMembers.map((member, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handlePhotographerClick(member)}
                                        className="flex items-center gap-4 bg-white/60 backdrop-blur-sm border border-white/80 px-5 py-2.5 rounded-2xl shadow-sm group cursor-pointer hover:border-[#D9CDEB] hover:shadow-md transition-all"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-[#CFE8D5] shadow-[0_0_8px_#CFE8D5]"></div>
                                        <span className="text-xs font-black text-[#2d2d2d] tracking-wide">{member}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeMember(member); }}
                                            className="text-[#8a8a8a] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-1"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-12">
                            <TaskPlanning user={user} leadId={lead._id} isCompact={true} />
                            <FollowUpList lead={lead} onUpdate={(updatedLead) => setLead(updatedLead)} />
                        </div>
                    </div>

                    <div className="p-6 md:p-8 border-t border-white/40 bg-white/60 backdrop-blur-3xl sticky bottom-0 z-20">
                        <div className="flex gap-4">
                            <button
                                onClick={onGenerateInvoice}
                                className="flex-1 bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] text-[10px] uppercase tracking-[0.25em] font-black py-5 rounded-[24px] hover:shadow-lg transition-all border border-white/60 shadow-md active:scale-[0.98]"
                            >
                                Generate Invoice
                            </button>
                            <button
                                onClick={() => setShowFullLog(true)}
                                className="flex-1 bg-white/80 border border-white/80 text-[#2d2d2d] text-[10px] uppercase tracking-[0.25em] font-black py-5 rounded-[24px] hover:bg-white transition-all shadow-sm active:scale-[0.98]"
                            >
                                Archivist Log
                            </button>
                        </div>
                    </div>
                </div>

                {selectedPhotographerProfile && (
                    <PhotographerProfile
                        photographer={selectedPhotographerProfile}
                        onClose={() => setSelectedPhotographerProfile(null)}
                        onUpdate={(updated) => {
                            setSelectedPhotographerProfile(updated);
                            setAllPhotographers(prev => prev.map(p => p._id === updated._id ? updated : p));
                        }}
                    />
                )}

                {showFullLog && (
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 w-screen h-screen"
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)'
                        }}
                    >
                        <div className="bg-white/90 backdrop-blur-xl w-full max-w-lg rounded-3xl p-8 shadow-2xl relative border border-white/40">
                            <div className="flex justify-between items-center mb-6 border-b border-white/20 pb-4">
                                <h3 className="font-luxury text-2xl text-[#2d2d2d]">Activity Log & Notes</h3>
                                <button onClick={() => setShowFullLog(false)}><X size={20} className="text-[#8a8a8a] hover:text-[#2d2d2d] transition-colors" /></button>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-white/40 p-4 rounded-2xl border border-white/60">
                                    <p className="text-[10px] text-[#8a8a8a] font-black uppercase tracking-widest"><span className="opacity-60">Identity Axis:</span> LID-{lead._id ? lead._id.slice(-6).toUpperCase() : 'NEW'}</p>
                                </div>
                                <textarea
                                    className="w-full h-48 bg-white/60 border border-white/80 rounded-2xl p-5 text-sm focus:outline-none focus:border-[#D9CDEB] shadow-inner resize-none font-medium text-[#4a4a4a]"
                                    placeholder="Add important notes..."
                                    value={lead.notes || ""}
                                    onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                                    onBlur={(e) => handleUpdateNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
}
