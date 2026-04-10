import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, Mail, Phone, Calendar, Tag, User, Users, Plus, CheckCircle2, MoreVertical, Trash2, Edit2, MapPin, Clock, Save, Loader2 } from "lucide-react";
import FollowUpList from "./FollowUpList";
import TaskPlanning from "./task-planning/TaskPlanning";
import toast from "react-hot-toast";
import PhotographerProfile from "./PhotographerProfile";

export default function LeadDetails({ user, lead: initialLead, existingInvoice, onClose, onUpdate, onGenerateInvoice }) {
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
    
    // STATE MANAGEMENT: Persistent Photographer Selection
    const [deployDropdownOpen, setDeployDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

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
            if (onUpdate) onUpdate(response.data); // FIX: STATE SYNC ISSUE
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
        
        // PERSISTENCE: Restore last selected photographer profile on mount
        const lastSelected = localStorage.getItem('lastDeployedPhotographer');
        if (lastSelected) {
            try {
                const parsed = JSON.parse(lastSelected);
                // We'll set it only if it's not already set by clicking a team member
                if (!selectedPhotographerProfile) {
                    setSelectedPhotographerProfile(parsed);
                }
            } catch (e) {
                console.error("Failed to restore photographer selection", e);
            }
        }
    }, []);

    const fetchPhotographers = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/photographers`, authHeader);
            setAllPhotographers(response.data);
        } catch (err) {
            console.error("Failed to fetch photographers", err);
        }
    };

    const addMember = async (photographerObj) => {
        const targetPhotographer = photographerObj || allPhotographers.find(p => p.name === selectedPhotographer);
        if (!targetPhotographer) return;

        const photographerName = targetPhotographer.name;
        
        if (!teamMembers.includes(photographerName)) {
            const newTeam = [...teamMembers, photographerName];
            setSaving(true);
            try {
                const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, {
                    people: newTeam
                }, authHeader);
                setTeamMembers(response.data.people);
                setLead(response.data);
                if (onUpdate) onUpdate(response.data);
                
                // PROFILE SYNC FIX: Instantly reflect selection in profile section
                setSelectedPhotographerProfile(targetPhotographer);
                localStorage.setItem('lastDeployedPhotographer', JSON.stringify(targetPhotographer));
                
                setSelectedPhotographer("");
                setDeployDropdownOpen(false);
                toast.success(`${photographerName} deployed to this project!`);
            } catch (err) {
                console.error("Failed to update team", err);
                toast.error("Failed to assign team member.");
            } finally {
                setSaving(false);
            }
        } else {
            // Even if already in team, sync the profile view if selected in dropdown
            setSelectedPhotographerProfile(targetPhotographer);
            localStorage.setItem('lastDeployedPhotographer', JSON.stringify(targetPhotographer));
            setDeployDropdownOpen(false);
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
            if (onUpdate) onUpdate(response.data); // FIX: STATE SYNC ISSUE
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
            <div className="fixed inset-0 bg-white z-[9999] animate-in fade-in duration-300">
                <div className="w-full h-full bg-[#fafafa] flex flex-col relative overflow-hidden">
                    {/* Top Navigation Bar - Pro Responsive Header */}
                    <div className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 md:px-6 lg:px-10 py-3 md:py-4 flex justify-between items-center w-full">
                        <div className="flex items-center gap-3 md:gap-6">
                            <button 
                                onClick={onClose}
                                className="p-2 md:p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-200"
                            >
                                <X size={18} />
                            </button>
                            <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-9 h-9 md:w-11 md:h-11 bg-gradient-to-br from-[#F0F4FF] to-[#FFF9F0] rounded-xl flex items-center justify-center border border-white shadow-sm font-luxury text-lg md:text-xl text-[#2d2d2d] uppercase">
                                    {(lead.name || "?")[0]}
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="font-luxury text-lg md:text-xl lg:text-2xl text-[#2d2d2d] tracking-tight leading-tight">{lead.name}</h2>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-[#8a8a8a] uppercase tracking-widest font-black opacity-40">
                                            Registry Axis — LID-{lead._id ? lead._id.slice(-6).toUpperCase() : 'NEW'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 md:gap-4">
                            {!isEditing ? (
                                <button
                                    onClick={() => {
                                        setEditData(lead);
                                        setIsEditing(true);
                                    }}
                                    className="p-2 md:p-3 bg-white hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-[#2d2d2d] border border-gray-200"
                                    title="Edit Profile"
                                >
                                    <Edit2 size={16} />
                                </button>
                            ) : (
                                <button
                                    disabled={saving}
                                    onClick={handleSaveLead}
                                    className="px-4 py-2 md:px-5 md:py-2.5 bg-[#2d2d2d] text-white rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-[0.98]"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    <span className="hidden sm:inline">{saving ? "Commiting..." : "Save Registry"}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                        <div className="max-w-[1400px] mx-auto p-5 md:p-8 lg:p-10 xl:p-12">
                            {/* Main Workspace Grid - Balanced Adaptive Split */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16">
                                
                                {/* Left Column: Client Core & Creative Brief (Fluid Width) */}
                                <div className="lg:col-span-7 space-y-10 md:space-y-12">
                                    
                                    {/* Identity Dashboard - Responsive Registry */}
                                    <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                        <div className="flex flex-col xs:flex-row justify-between items-start xs:items-end gap-5 mb-8 md:mb-10">
                                            <div className="space-y-1">
                                                <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a8a8a] font-black opacity-50">Registry Phase</div>
                                                <h3 className="text-2xl md:text-3xl lg:text-4xl font-luxury text-[#2d2d2d] tracking-tight">Inquiry Profile</h3>
                                            </div>
                                            <div className="flex gap-2">
                                                {isEditing ? (
                                                    <div className="relative group">
                                                        <select
                                                            value={editData.status}
                                                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                            className="text-[10px] uppercase tracking-[0.2em] px-5 py-2.5 rounded-xl font-black bg-gray-50 border border-gray-100 text-[#2d2d2d] focus:outline-none appearance-none cursor-pointer hover:bg-white transition-all shadow-sm"
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
                                                    <div className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm ${
                                                        lead.status === 'New' ? 'bg-blue-50/50 text-blue-600 border-blue-100' :
                                                        lead.status === 'Follow-up' ? 'bg-amber-50/50 text-amber-600 border-amber-100' :
                                                        lead.status === 'Meeting' ? 'bg-purple-50/50 text-purple-600 border-purple-100' :
                                                        lead.status === 'Converted' ? 'bg-green-50/50 text-green-600 border-green-100' :
                                                        'bg-gray-50 text-gray-500 border-gray-100'
                                                    }`}>
                                                        {lead.status}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                                            <div className="bg-[#fafafa] p-6 md:p-7 rounded-[28px] border border-gray-100 space-y-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8a8a8a] opacity-50">
                                                    <Mail size={14} /> Correspondence
                                                </div>
                                                <div className="space-y-2 md:space-y-3">
                                                    <div className="text-xs md:text-sm font-bold text-gray-900 break-all leading-relaxed">
                                                        {isEditing ? <input value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="bg-transparent border-b border-gray-200 outline-none w-full pb-1" /> : <span>{lead.email}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-900 border-t border-gray-50 pt-3">
                                                        <Phone size={14} className="text-gray-300" />
                                                        {isEditing ? <input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="bg-transparent outline-none w-full" /> : <span>{lead.phone || "Private Axis"}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-[#fafafa] p-6 md:p-7 rounded-[28px] border border-gray-100 space-y-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8a8a8a] opacity-50">
                                                    <MapPin size={14} /> Logistics
                                                </div>
                                                <div className="space-y-2 md:space-y-3">
                                                    <div className="text-xs md:text-sm font-bold text-gray-900 leading-relaxed">
                                                        {isEditing ? <input value={editData.eventLocation} onChange={e => setEditData({...editData, eventLocation: e.target.value})} className="bg-transparent border-b border-gray-200 outline-none w-full pb-1" /> : <span>{lead.eventLocation || "Venue TBD"}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-900 border-t border-gray-50 pt-3">
                                                        <Tag size={14} className="text-gray-300" />
                                                        {isEditing ? (
                                                            <select value={editData.eventType} onChange={e => setEditData({...editData, eventType: e.target.value})} className="bg-transparent outline-none w-full appearance-none">
                                                                <option>Wedding</option><option>Engagement</option><option>Bespoke</option>
                                                            </select>
                                                        ) : <span className="uppercase tracking-wider text-[10px]">{lead.eventType || "Bespoke Collection"}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-[#fafafa] p-6 md:p-7 rounded-[28px] border border-gray-100 space-y-4 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8a8a8a] opacity-50">
                                                    <Calendar size={14} /> Timeline
                                                </div>
                                                <div className="space-y-2 md:space-y-3">
                                                    <div className="text-xs md:text-sm font-bold text-gray-900 leading-relaxed">
                                                        {isEditing ? <input type="date" value={editData.eventDate ? new Date(editData.eventDate).toISOString().split('T')[0] : ""} onChange={e => setEditData({...editData, eventDate: e.target.value})} className="bg-transparent border-b border-gray-200 outline-none w-full pb-1" /> : <span>{lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-900 border-t border-gray-50 pt-3">
                                                        <Clock size={14} className="text-gray-300" />
                                                        {isEditing ? <input type="time" value={editData.eventTime} onChange={e => setEditData({...editData, eventTime: e.target.value})} className="bg-transparent outline-none w-full" /> : <span>{lead.eventTime || "TBD"}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Brief Section - Editorial Layout */}
                                    <section className="bg-white p-6 md:p-8 rounded-[36px] md:rounded-[48px] border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-900">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#CFE8D5]"></div>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a8a]">Creative Provisioning</h4>
                                            </div>
                                        </div>
                                        {isEditing ? (
                                            <textarea
                                                className="w-full min-h-[160px] md:min-h-[220px] bg-[#fafafa] border border-gray-100 rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-gray-50 transition-all resize-none font-medium leading-relaxed"
                                                value={editData.remarks || ""}
                                                onChange={e => setEditData({ ...editData, remarks: e.target.value })}
                                                placeholder="Detail the artistic vision..."
                                            />
                                        ) : (
                                            <div className="space-y-6">
                                                <p className="text-[#2d2d2d] text-lg md:text-xl lg:text-2xl leading-[1.5] font-serif italic opacity-90">
                                                    {lead.remarks || "No additional artistic provisions have been entered into the registry axis at this stage of the workflow."}
                                                </p>
                                                <div className="w-16 md:w-20 h-px bg-gray-100"></div>
                                            </div>
                                        )}
                                    </section>
                                    
                                    {/* Task Planning - Expanded Visuals */}
                                    <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 pt-6 md:pt-8 border-t border-gray-100">
                                        <div className="mb-6 md:mb-8 text-[10px] uppercase font-black tracking-[0.3em] text-[#8a8a8a] opacity-50">Milestone Orchestration</div>
                                        <TaskPlanning user={user} leadId={lead._id} />
                                    </section>
                                </div>

                                {/* Right Column: Financials, Team & Logs (Col 5 / Stacked Mobile) */}
                                <div className="lg:col-span-5 space-y-10 md:space-y-12">
                                    <div className="lg:sticky lg:top-24 xl:top-28 space-y-10 md:space-y-12">
                                        
                                        {/* Financial Management Console */}
                                        <section className="bg-gradient-to-br from-[#2D2D2D] to-[#1A1A1A] p-7 md:p-10 rounded-[40px] shadow-[0_15px_45px_rgba(0,0,0,0.12)] text-white relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                                                <Tag size={120} />
                                            </div>
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-10">
                                                    <div className="text-[10px] uppercase font-black tracking-[0.3em] opacity-40">Financial Console</div>
                                                    {existingInvoice?.status && (
                                                        <span className="px-2.5 py-1 bg-white/10 rounded-md text-[8px] font-black uppercase tracking-[0.15em]">{existingInvoice.status}</span>
                                                    )}
                                                </div>
                                                <div className="space-y-8 md:space-y-10">
                                                    <div>
                                                        <div className="text-[8px] uppercase tracking-[0.4em] opacity-30 font-black mb-3">Valuation</div>
                                                        <div className="text-4xl md:text-5xl font-serif tracking-tighter italic">
                                                            ₹ {(existingInvoice?.total || 0).toLocaleString('en-IN')}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-4 pb-6 border-b border-white/5">
                                                        <div>
                                                            <div className="text-[7px] uppercase tracking-[0.3em] opacity-30 font-black mb-1.5 text-white/60">Sessions</div>
                                                            <div className="text-base md:text-lg font-serif italic">{existingInvoice?.events?.length || 0} Events</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[7px] uppercase tracking-[0.3em] opacity-30 font-black mb-1.5 text-white/60">Protocol</div>
                                                            <div className="text-base md:text-lg font-serif italic">{existingInvoice?.invoiceDate ? new Date(existingInvoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Pending'}</div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2">
                                                        <button 
                                                            onClick={onGenerateInvoice}
                                                            className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-gray-50 active:scale-[0.98] transition-all"
                                                        >
                                                            {existingInvoice ? "Update Registry" : "Initialize Invoice"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Artist Deployment Grid */}
                                        <section className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-6 md:mb-8">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-lg font-luxury text-[#2d2d2d]">Artistic Sync</h3>
                                                    <p className="text-[8px] uppercase font-black tracking-widest text-[#8a8a8a] opacity-50">Personnel</p>
                                                </div>
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setDeployDropdownOpen(!deployDropdownOpen)}
                                                        className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-[#2d2d2d] rounded-xl text-white shadow hover:bg-black transition-all"
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                    {deployDropdownOpen && (
                                                        <div className="absolute right-0 top-full mt-4 w-[280px] md:w-72 bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-gray-100 p-6 z-[100] animate-in slide-in-from-top-4 duration-400">
                                                            <div className="mb-4">
                                                                <label className="text-[8px] uppercase font-black tracking-widest text-gray-400 ml-1 mb-2 block">Search Artists</label>
                                                                <input autoFocus placeholder="..." className="w-full bg-gray-50 border-none rounded-xl px-5 py-3 text-xs focus:ring-2 focus:ring-gray-100" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                                            </div>
                                                            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                                                {allPhotographers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                                                                    <button key={p._id} onClick={() => addMember(p)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-all text-left">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-[9px]">{p.name[0]}</div>
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-gray-900">{p.name}</div>
                                                                                <div className="text-[7px] uppercase tracking-widest text-gray-400">{p.specialty}</div>
                                                                            </div>
                                                                        </div>
                                                                        {teamMembers.includes(p.name) && <CheckCircle2 size={14} className="text-[#CFE8D5]" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                {teamMembers.length > 0 ? teamMembers.map((member, idx) => (
                                                    <div key={idx} onClick={() => handlePhotographerClick(member)} className="flex items-center justify-between bg-gray-50/50 p-4 md:p-5 rounded-2xl border border-gray-100 hover:border-black/10 transition-all cursor-pointer group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center font-bold text-gray-400 text-[10px]">{member[0]}</div>
                                                            <div className="space-y-0.5">
                                                                <div className="text-[10px] font-black text-[#2d2d2d] uppercase tracking-wide">{member}</div>
                                                                <div className="text-[7px] uppercase tracking-widest text-[#8a8a8a]">Active</div>
                                                            </div>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); removeMember(member); }} className="p-2 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button>
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-10 opacity-30 italic text-[10px] tracking-widest text-gray-400">No personnel designated.</div>
                                                )}
                                            </div>
                                        </section>

                                        {/* Activity & Logs */}
                                        <div className="space-y-4">
                                            <button 
                                                onClick={() => setShowFullLog(true)}
                                                className="w-full bg-[#FAFAFA] h-16 md:h-20 rounded-[28px] md:rounded-[36px] border border-gray-100 flex items-center px-6 md:px-8 gap-4 hover:bg-white hover:shadow-md transition-all group"
                                            >
                                                <div className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm group-hover:rotate-12 transition-transform">
                                                    <Clock size={18} md:size={20} className="text-gray-400 group-hover:text-black" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8a8a8a]">Activity Registry</div>
                                                    <div className="text-[8px] uppercase tracking-widest text-gray-400 mt-1 hidden xs:block">Audit Logs & History</div>
                                                </div>
                                            </button>

                                            <section className="bg-white p-1 rounded-[28px] md:rounded-[36px]">
                                                <FollowUpList lead={lead} onUpdate={(updatedLead) => setLead(updatedLead)} />
                                            </section>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
