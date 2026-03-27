import { useState, useEffect } from "react";
import { X, Calendar, MapPin, MessageCircle, Clock, CheckCircle, Edit2, Save, User, Mail, Phone, Camera, Trash2 } from "lucide-react";
import { format, isPast } from "date-fns";
import axios from "axios";
import toast from "react-hot-toast";

export default function PhotographerProfile({ photographer, onClose, onUpdate }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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

    return (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-4xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-ivory">
                {/* Header Profile Section */}
                <div className="relative bg-charcoal text-white p-8 pb-24 overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-mutedbrown/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div className="flex gap-6 items-center">
                            <div className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/20 text-3xl font-serif">
                                {photographer.name[0]}
                            </div>
                            <div>
                                <h2 className="font-serif text-3xl">{formData.name}</h2>
                                <p className="text-white/60 text-xs uppercase tracking-[0.2em] font-bold mt-1">
                                    {(formData.specialty || '').toUpperCase().includes('PHOTOGRAPHER') ? formData.specialty : `${formData.specialty || ''} Photographer`}
                                </p>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setActiveTab('schedule')}
                                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'schedule' ? 'bg-white text-charcoal' : 'bg-white/10 hover:bg-white/20'}`}
                                    >
                                        Schedule
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('profile')}
                                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-charcoal' : 'bg-white/10 hover:bg-white/20'}`}
                                    >
                                        Profile Details
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-gray-50 -mt-8 rounded-t-4xl relative z-20 overflow-hidden flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                        {activeTab === 'schedule' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Upcoming */}
                                <div className="space-y-4">
                                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-mutedbrown">
                                        <Clock size={16} /> Upcoming Shoots
                                    </h3>
                                    {upcomingWorks.length > 0 ? (
                                        upcomingWorks.map(work => (
                                            <div key={work._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h4 className="font-bold text-lg text-charcoal">{work.name}</h4>
                                                        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{work.eventType}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => sendWhatsApp(work)} className="bg-[#25D366] text-white p-2 rounded-xl hover:bg-[#128C7E] transition-colors shadow-sm" title="WhatsApp Reminder">
                                                            <MessageCircle size={18} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm(`Remove ${photographer.name} from this event?`)) return;
                                                                try {
                                                                    const newPeople = work.people ? work.people.filter(p => p !== photographer.name) : [];
                                                                    await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${work._id}`, { people: newPeople }, authHeader);
                                                                    fetchWorks(); // Refresh list
                                                                    toast.success("Assignment removed");
                                                                } catch (e) { toast.error("Failed to remove assignment"); }
                                                            }}
                                                            className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                                                            title="Remove Assignment"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                                                        <Calendar size={14} className="text-mutedbrown" />
                                                        <span>{safeFormat(work.eventDate)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                                                        <Clock size={14} className="text-mutedbrown" />
                                                        <span>{work.eventTime || "Time TBD"}</span>
                                                    </div>
                                                    <div className="col-span-2 flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                                                        <MapPin size={14} className="text-mutedbrown" />
                                                        <span>{work.eventLocation || "Location TBD"}</span>
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
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-serif">Personal Details</h3>
                                    {!isEditing ? (
                                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-mutedbrown hover:text-charcoal transition-colors">
                                            <Edit2 size={14} /> Edit Profile
                                        </button>
                                    ) : (
                                        <button onClick={handleSaveProfile} disabled={loading} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-600 hover:text-green-700 transition-colors">
                                            <Save size={14} /> {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    )}
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-6 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Full Name</label>
                                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-transparent focus-within:border-mutedbrown transition-all">
                                                <User size={16} className="text-gray-400" />
                                                <input
                                                    disabled={!isEditing}
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="bg-transparent w-full text-sm outline-none disabled:text-gray-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Specialty</label>
                                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-transparent focus-within:border-mutedbrown transition-all">
                                                <Camera size={16} className="text-gray-400" />
                                                <select
                                                    disabled={!isEditing}
                                                    value={formData.specialty}
                                                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                                    className="bg-transparent w-full text-sm outline-none disabled:text-gray-500 appearance-none"
                                                >
                                                    <option>Lead</option>
                                                    <option>Second</option>
                                                    <option>Video</option>
                                                    <option>Drone</option>
                                                    <option>Editor</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Email Address</label>
                                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-transparent focus-within:border-mutedbrown transition-all">
                                                <Mail size={16} className="text-gray-400" />
                                                <input
                                                    disabled={!isEditing}
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    className="bg-transparent w-full text-sm outline-none disabled:text-gray-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Phone</label>
                                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-transparent focus-within:border-mutedbrown transition-all">
                                                <Phone size={16} className="text-gray-400" />
                                                <input
                                                    disabled={!isEditing}
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    className="bg-transparent w-full text-sm outline-none disabled:text-gray-500"
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
        </div>
    );
}
