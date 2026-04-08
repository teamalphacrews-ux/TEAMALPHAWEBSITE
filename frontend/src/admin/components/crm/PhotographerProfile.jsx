import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, MapPin, MessageCircle, Clock, CheckCircle, Edit2, Save, User, Mail, Phone, Camera, Trash2, Loader2 } from "lucide-react";
import { format, isPast } from "date-fns";
import axios from "axios";
import toast from "react-hot-toast";

export default function PhotographerProfile({ photographer, onClose, onUpdate }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || '';
    const [activeTab, setActiveTab] = useState("schedule"); // 'profile' or 'schedule'
    const [works, setWorks] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ ...photographer });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchWorks();
    }, [photographer.name]);

    const fetchWorks = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/photographers/${encodeURIComponent(photographer.name)}/works`, authHeader);
            setWorks(response.data);
        } catch (err) {
            console.error("Failed to fetch works", err);
        }
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/photographers/${photographer._id}`, formData, authHeader);
            if (onUpdate) onUpdate(response.data);
            setIsEditing(false);
            toast.success("Profile updated successfully!");
        } catch (err) {
            console.error("Failed to update profile", err);
            toast.error("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    const sendWhatsApp = (work) => {
        const text = `Hello ${photographer.name}, reminder for ${work.eventType} (${work.name}) on ${safeFormat(work.eventDate)} at ${work.eventTime || 'TBD'} in ${work.eventLocation || 'Location TBD'}.`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // Derived state for works
    const sortedWorks = [...works].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    // Filter out removed assignments locally if needed, but fetchWorks handles it.
    const upcomingWorks = sortedWorks.filter(w => !isPast(new Date(w.eventDate)));
    const pastWorks = sortedWorks.filter(w => isPast(new Date(w.eventDate))).reverse();

    const handleRemoveAssignment = async (workId, workPeople) => {
        if (!window.confirm(`Remove ${photographer.name} from this event?`)) return;
        try {
            const newPeople = workPeople ? workPeople.filter(p => p !== photographer.name) : [];
            await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${workId}`, { people: newPeople }, authHeader);
            fetchWorks();
            toast.success("Assignment removed");
        } catch (e) { toast.error("Failed to remove assignment"); }
    };

    const safeFormat = (dateStr) => {
        if (!dateStr) return "Date TBD";
        const d = new Date(dateStr);
        return isNaN(d) ? "Date TBD" : format(d, 'PPP');
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[6px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white/70 backdrop-blur-[24px] w-full max-w-3xl h-[85vh] flex flex-col rounded-[40px] shadow-[0_25px_70px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-400 relative">
                {/* Premium Pastel Header */}
                <div className="relative bg-gradient-to-br from-[#F0F4FF] via-[#F8F4FF] to-[#FFF9F0] p-8 md:p-10 border-b border-white/40 shrink-0">
                    <div className="relative z-10 flex justify-between items-start">
                        <div className="flex gap-8 items-center">
                            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-[32px] flex items-center justify-center border border-white shadow-sm text-4xl font-luxury text-[#2d2d2d] uppercase">
                                {photographer.name[0]}
                            </div>
                            <div>
                                <h2 className="font-luxury text-3xl md:text-4xl text-[#2d2d2d] tracking-tight">{formData.name}</h2>
                                <p className="text-[10px] md:text-[11px] text-[#8a8a8a] mt-2 font-black uppercase tracking-[0.25em] bg-white/60 px-4 py-1.5 rounded-full border border-white/40 inline-block">
                                    {(formData.specialty || '').toUpperCase().includes('PHOTOGRAPHER') ? formData.specialty : `${formData.specialty || 'Master'} Artist`}
                                </p>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setActiveTab('schedule')}
                                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${activeTab === 'schedule' ? 'bg-[#2d2d2d] text-white border-[#2d2d2d] shadow-lg' : 'bg-white/60 text-[#8a8a8a] border-white/80 hover:bg-white'}`}
                                    >
                                        Itinerary
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('profile')}
                                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${activeTab === 'profile' ? 'bg-[#2d2d2d] text-white border-[#2d2d2d] shadow-lg' : 'bg-white/60 text-[#8a8a8a] border-white/80 hover:bg-white'}`}
                                    >
                                        Portfolio
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 bg-white/60 hover:bg-white text-[#8a8a8a] hover:text-[#2d2d2d] rounded-full transition-all border border-white/80 hover:rotate-90 hover:shadow-sm">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-10">


                        {activeTab === 'schedule' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Upcoming */}
                                <div className="space-y-4">
                                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-mutedbrown">
                                        <Clock size={16} /> Upcoming Shoots
                                    </h3>
                                    {upcomingWorks.length > 0 ? (
                                        upcomingWorks.map(work => (
                                            <div key={work._id} className="bg-white/40 backdrop-blur-sm p-6 rounded-[28px] border border-white/80 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
                                                        <h4 className="font-black text-xl text-[#2d2d2d] tracking-tight">{work.name}</h4>
                                                        <span className="text-[9px] uppercase tracking-[0.2em] text-[#8a8a8a] font-black bg-white/60 px-2.5 py-1 rounded-lg border border-white/40 mt-2 inline-block shadow-sm">{work.eventType}</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <button onClick={() => sendWhatsApp(work)} className="bg-[#25D366]/10 text-[#25D366] p-3 rounded-2xl hover:bg-[#25D366]/20 transition-all border border-[#25D366]/20 shadow-sm" title="WhatsApp Deployment">
                                                            <MessageCircle size={20} />
                                                        </button>
                                                        <button
                                                            onClick={async () => handleRemoveAssignment(work._id, work.people)}
                                                            className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-100 transition-all border border-red-100 shadow-sm"
                                                            title="Sever Assignment"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-[#5a5a5a]">
                                                    <div className="flex items-center gap-3 bg-white/60 p-3.5 rounded-xl border border-white/80 shadow-inner">
                                                        <Calendar size={16} className="text-[#D9CDEB]" />
                                                        <span>{safeFormat(work.eventDate)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-white/60 p-3.5 rounded-xl border border-white/80 shadow-inner">
                                                        <Clock size={16} className="text-[#D9CDEB]" />
                                                        <span>{work.eventTime || "Time Phase TBD"}</span>
                                                    </div>
                                                    <div className="col-span-full flex items-center gap-3 bg-white/60 p-3.5 rounded-xl border border-white/80 shadow-inner">
                                                        <MapPin size={16} className="text-[#D9CDEB]" />
                                                        <span className="truncate">{work.eventLocation || "Venue Not Designated"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))

                                    ) : (
                                        <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
                                            <p className="text-gray-400 text-sm">No upcoming shoots scheduled.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Past */}
                                {pastWorks.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-gray-200">
                                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                                            <CheckCircle size={16} /> Past Works
                                        </h3>
                                        {pastWorks.map(work => (
                                            <div key={work._id} className="bg-white/60 p-4 rounded-xl border border-gray-100 flex justify-between items-center opacity-70 hover:opacity-100 transition-all">
                                                <div>
                                                    <h4 className="font-semibold text-charcoal">{work.name}</h4>
                                                    <p className="text-xs text-gray-500">{safeFormat(work.eventDate)}</p>
                                                </div>
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-bold uppercase">{work.eventType}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-luxury text-[#2d2d2d] tracking-tight">Artistic Profile</h3>
                                    {!isEditing ? (
                                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#5a5a5a] bg-white/60 px-5 py-2.5 rounded-full border border-white/80 shadow-sm hover:bg-white transition-all">
                                            <Edit2 size={14} /> Refine Portfolio
                                        </button>
                                    ) : (
                                        <button onClick={handleSaveProfile} disabled={loading} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#2d2d2d] bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] px-6 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all border border-white/60 active:scale-[0.98]">
                                            {loading ? <Loader2 size={14} className="animate-spin text-[#4a4a4a]" /> : <Save size={14} className="text-[#4a4a4a]" />} 
                                            {loading ? 'Archiving...' : 'Commit Changes'}
                                        </button>
                                    )}
                                </div>

                                <div className="bg-white/40 backdrop-blur-sm p-8 rounded-[32px] border border-white/80 space-y-8 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-[#8a8a8a] ml-1">Legal Identity</label>
                                            <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-white/80 focus-within:border-[#D9CDEB] focus-within:ring-4 focus-within:ring-[#D9CDEB]/10 transition-all shadow-inner">
                                                <User size={18} className="text-[#c0c0c0]" />
                                                <input
                                                    disabled={!isEditing}
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="bg-transparent w-full text-sm font-bold outline-none disabled:text-[#8a8a8a]"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-[#8a8a8a] ml-1">Technical Specialization</label>
                                            <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-white/80 focus-within:border-[#D9CDEB] focus-within:ring-4 focus-within:ring-[#D9CDEB]/10 transition-all shadow-inner relative">
                                                <Camera size={18} className="text-[#c0c0c0]" />
                                                <select
                                                    disabled={!isEditing}
                                                    value={formData.specialty}
                                                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                                    className="bg-transparent w-full text-sm font-bold outline-none disabled:text-[#8a8a8a] appearance-none cursor-pointer"
                                                >
                                                    <option>Lead</option>
                                                    <option>Second</option>
                                                    <option>Video</option>
                                                    <option>Drone</option>
                                                    <option>Editor</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-[#8a8a8a] ml-1">Digital Correspondence</label>
                                            <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-white/80 focus-within:border-[#D9CDEB] focus-within:ring-4 focus-within:ring-[#D9CDEB]/10 transition-all shadow-inner">
                                                <Mail size={18} className="text-[#c0c0c0]" />
                                                <input
                                                    disabled={!isEditing}
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    className="bg-transparent w-full text-sm font-bold outline-none disabled:text-[#8a8a8a]"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-[#8a8a8a] ml-1">Communication Axis</label>
                                            <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-white/80 focus-within:border-[#D9CDEB] focus-within:ring-4 focus-within:ring-[#D9CDEB]/10 transition-all shadow-inner">
                                                <Phone size={18} className="text-[#c0c0c0]" />
                                                <input
                                                    disabled={!isEditing}
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    className="bg-transparent w-full text-sm font-bold outline-none disabled:text-[#8a8a8a]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
