import { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, MapPin, Users, Clock, Save, Trash2 } from "lucide-react";
import axios from "axios";

export default function EventForm({ onClose, onSave, onDelete, initialData }) {
    const [formData, setFormData] = useState({
        title: "",
        start: "",
        end: "",
        type: "Wedding",
        location: "",
        description: "",
        ...initialData
    });

    const isEditing = !!initialData?._id;

    // Helper to format date for input type="datetime-local"
    // Valid for inputs: YYYY-MM-DDTHH:mm
    const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        // Adjust to local ISO string roughly or use a library. 
        // Simple hack for local time:
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
                end: formatDateForInput(initialData.end)
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
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-ivory flex flex-col max-h-[90vh]">
                <div className="bg-charcoal text-white p-6 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <h2 className="font-serif text-2xl">{isEditing ? "Edit Event" : "Schedule Event"}</h2>
                    <p className="text-white/60 text-xs uppercase tracking-widest mt-1">Manage studio itinerary</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Event Title</label>
                        <input
                            required
                            type="text"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors font-medium text-charcoal"
                            placeholder="e.g. Wedding: Sarah & Kevin"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Start Date</label>
                            <input
                                required
                                type="datetime-local"
                                value={formData.start}
                                onChange={e => setFormData({ ...formData, start: e.target.value })}
                                className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">End Date</label>
                            <input
                                required
                                type="datetime-local"
                                value={formData.end}
                                onChange={e => setFormData({ ...formData, end: e.target.value })}
                                className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Event Type</label>
                        <select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                            className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors appearance-none"
                        >
                            <option>Wedding</option>
                            <option>Pre-Wedding</option>
                            <option>Engagement</option>
                            <option>Meeting</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Location</label>
                        <div className="flex items-center gap-2 bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 focus-within:border-mutedbrown transition-colors">
                            <MapPin size={16} className="text-mutedbrown" />
                            <input
                                type="text"
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                className="w-full bg-transparent text-sm focus:outline-none font-medium text-charcoal"
                                placeholder="e.g. Taj Palace, Mumbai"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Team Members</label>
                        <div className="max-h-32 overflow-y-auto border border-[#e6e3df] rounded-xl p-2 space-y-1 bg-ivory/30">
                            {photographers.map(dg => (
                                <label key={dg._id} className="flex items-center gap-3 p-2 hover:bg-ivory/50 rounded-lg cursor-pointer transition-colors">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.teamMembers?.includes(dg.name) ? 'bg-charcoal border-charcoal' : 'border-gray-300'}`}>
                                        {formData.teamMembers?.includes(dg.name) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.teamMembers?.includes(dg.name) || false}
                                        onChange={() => handleTeamMemberToggle(dg.name)}
                                    />
                                    <span className="text-sm font-medium text-charcoal">{dg.name} <span className="text-[10px] text-warmgray uppercase tracking-wider ml-1">{dg.specialty}</span></span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2 shrink-0">
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => onDelete(initialData._id)}
                                className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                        <button
                            type="submit"
                            className="flex-1 bg-charcoal text-white py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all shadow-lg active:scale-[0.98]"
                        >
                            <Save size={16} /> {isEditing ? "Update Event" : "Save Event"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
