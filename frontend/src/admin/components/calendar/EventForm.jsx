import { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, MapPin, Users, Clock, Save, Trash2 } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_COLORS = {
    "Wedding": "#FDE68A",
    "Pre-Wedding": "#FCA5A5",
    "Engagement": "#7DD3FC",
    "Meeting": "#C4B5FD",
    "Other": "#E5E7EB"
};

const TEAM_INITIAL_COLORS = ["#FCA5A5", "#FDE68A", "#7DD3FC", "#C4B5FD", "#A9AC83", "#E8D0DC"];

export default function EventForm({ onClose, onSave, onDelete, initialData }) {
    const [formData, setFormData] = useState({
        title: "",
        start: "",
        end: "",
        type: "Wedding",
        location: "",
        description: "",
        teamMembers: [],
        ...initialData
    });

    const isEditing = !!initialData?._id;

    const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
        return localISOTime;
    };

    const [photographers, setPhotographers] = useState([]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                start: formatDateForInput(initialData.start),
                end: formatDateForInput(initialData.end),
                teamMembers: initialData.teamMembers || []
            });
        }
        fetchPhotographers();
    }, [initialData]);

    const fetchPhotographers = async () => {
        const token = localStorage.getItem('token');
        const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/photographers`, authHeader);
            setPhotographers(res.data);
        } catch (error) {
            console.error("Failed to fetch photographers");
        }
    };

    const handleTeamMemberToggle = (name) => {
        setFormData(prev => {
            const current = prev.teamMembers || [];
            if (current.includes(name)) {
                return { ...prev, teamMembers: current.filter(m => m !== name) };
            } else {
                return { ...prev, teamMembers: [...current, name] };
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-[#2d2d2d]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#f8f5f2] rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden border border-white/50 flex flex-col max-h-[90vh]"
            >
                {/* Scrapbook Solid Bold Border Overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl overflow-hidden z-20">
                    <rect width="100%" height="100%" fill="none" rx="24" ry="24" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
                </svg>

                {/* Adaptive Header */}
                <div 
                    style={{ backgroundColor: TYPE_COLORS[formData.type] || "#BB998B" }} 
                    className="p-10 relative shrink-0 transition-colors duration-500"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 p-3 bg-black/5 hover:bg-black/10 rounded-full transition-all text-[#2d2d2d]"
                    >
                        <X size={20} />
                    </button>
                    <h2 className="font-serif text-4xl text-[#2d2d2d] mb-1">{isEditing ? "Edit Event" : "New Event"}</h2>
                    <div className="flex items-center gap-3">
                        <p className="text-[#2d2d2d]/40 text-[10px] font-bold uppercase tracking-[0.4em]">Studio Itinerary Coordination</p>
                        {formData.isReadOnly && (
                            <div className="bg-black/10 px-3 py-1 rounded-full flex items-center gap-2 border border-black/5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-[#2d2d2d]">🔒 Google Protected Event</span>
                            </div>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto custom-scrollbar relative z-10">
                    {/* Event Title */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Event Reference</label>
                        <input
                            required
                            type="text"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-white border-2 border-black/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-black/10 transition-colors font-bold text-[#2d2d2d] shadow-sm"
                            placeholder="Enter Event Title..."
                        />
                    </div>

                    {/* Timeline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Commencement</label>
                            <input
                                required
                                type="datetime-local"
                                value={formData.start}
                                onChange={e => setFormData({ ...formData, start: e.target.value })}
                                className="w-full bg-white border-2 border-black/5 rounded-2xl px-6 py-4 text-xs font-bold focus:outline-none focus:border-black/10 transition-colors text-[#2d2d2d]/60 uppercase"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Conclusion</label>
                            <input
                                required
                                type="datetime-local"
                                value={formData.end}
                                onChange={e => setFormData({ ...formData, end: e.target.value })}
                                className="w-full bg-white border-2 border-black/5 rounded-2xl px-6 py-4 text-xs font-bold focus:outline-none focus:border-black/10 transition-colors text-[#2d2d2d]/60 uppercase"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Type Selector */}
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Category</label>
                            <div className="relative">
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-white border-2 border-black/5 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-black/10 transition-colors appearance-none text-[#2d2d2d]"
                                >
                                    <option>Wedding</option>
                                    <option>Pre-Wedding</option>
                                    <option>Engagement</option>
                                    <option>Meeting</option>
                                    <option>Other</option>
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Coordinates</label>
                            <div className="flex items-center gap-3 bg-white border-2 border-black/5 rounded-2xl px-6 py-4 focus-within:border-black/10 transition-colors shadow-sm">
                                <MapPin size={16} className="text-[#2d2d2d]/20" />
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full bg-transparent text-sm focus:outline-none font-bold text-[#2d2d2d] placeholder:text-[#2d2d2d]/20"
                                    placeholder="Location details..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Team Members Initials Badge Grid */}
                    <div className="space-y-4">
                        <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Operating Team</label>
                        <div className="flex flex-wrap gap-3">
                            {photographers.map((dg, idx) => {
                                const isSelected = formData.teamMembers?.includes(dg.name);
                                const initials = dg.name.split(' ').map(n => n[0]).join('').toUpperCase();
                                const badgeColor = TEAM_INITIAL_COLORS[idx % TEAM_INITIAL_COLORS.length];

                                return (
                                    <motion.button
                                        key={dg._id}
                                        type="button"
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleTeamMemberToggle(dg.name)}
                                        style={{ 
                                            backgroundColor: isSelected ? badgeColor : 'white',
                                            borderColor: isSelected ? 'transparent' : 'rgba(0,0,0,0.08)'
                                        }}
                                        className={`
                                            w-12 h-12 rounded-full border-2 flex items-center justify-center 
                                            transition-all duration-300 group relative
                                        `}
                                    >
                                        <span className={`text-xs font-bold ${isSelected ? 'text-[#2d2d2d]' : 'text-[#2d2d2d]/20'}`}>
                                            {initials}
                                        </span>
                                        {/* Tooltip on hover */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#2d2d2d] text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
                                            {dg.name}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Remarks/Description */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#2d2d2d]/40 ml-1">Operational Remarks</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-white border-2 border-black/5 rounded-2xl px-6 py-5 text-sm focus:outline-none focus:border-black/10 transition-colors font-medium text-[#2d2d2d] min-h-[120px] resize-none shadow-sm"
                            placeholder="Detailed requirements, specialized logistics..."
                        />
                    </div>

                    <div className="flex flex-col gap-4 pt-6 shrink-0 relative z-20">
                        {formData.isReadOnly && (
                            <div className="bg-red-50 border-2 border-red-100/50 p-4 rounded-2xl">
                                <p className="text-[9px] font-black uppercase tracking-widest text-red-400 text-center">
                                    Managed by Google: Modification restricted through API.
                                </p>
                            </div>
                        )}
                        <div className="flex gap-4">
                            {isEditing && (
                                <button
                                    type="button"
                                    disabled={formData.isReadOnly}
                                    onClick={() => onDelete(initialData._id)}
                                    className={`
                                        flex-1 py-5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] transition-all shadow-sm
                                        ${formData.isReadOnly 
                                            ? 'bg-black/5 text-black/10 cursor-not-allowed border-none' 
                                            : 'bg-[#F3F0E6] border-2 border-black/5 text-[#2d2d2d]/40 hover:bg-red-50 hover:text-red-500 hover:border-red-100'}
                                    `}
                                >
                                    <Trash2 size={16} /> Delete Event
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={formData.isReadOnly}
                                className={`
                                    flex-1 py-5 rounded-2xl flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] transition-all shadow-xl active:scale-[0.98]
                                    ${formData.isReadOnly 
                                        ? 'bg-black/10 text-black/20 cursor-not-allowed shadow-none' 
                                        : 'bg-[#2d2d2d] text-white hover:bg-[#444]'}
                                `}
                            >
                                <Save size={18} /> {isEditing ? "Update Event" : "Add Event"}
                            </button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function ChevronDown({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    );
}
