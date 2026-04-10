import { useState } from "react";
import { createPortal } from "react-dom";
import { X, User, Mail, Phone, Calendar, Tag, Save, MapPin, Clock, Loader2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function LeadForm({ onClose, onLeadAdded, initialData = null }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const [formData, setFormData] = useState(initialData || {
        name: "",
        email: "",
        phone: "",
        eventType: "Wedding",
        eventDate: "",
        eventTime: "",
        eventLocation: "",
        status: "New",
        remarks: "",
        totalAmount: "",
        depositAmount: ""
    });

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // FIX: UPDATE LOG INSTEAD OF CREATE IF ID EXISTS
            if (initialData && initialData._id) {
                const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${initialData._id}`, formData, authHeader);
                onLeadAdded(response.data);
                toast.success("Lead updated successfully!");
            } else {
                const response = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/leads`, formData, authHeader);
                onLeadAdded(response.data);
                toast.success("New luxury inquiry added successfully!");
            }
            onClose();
        } catch (err) {
            console.error("Failed to save lead", err);
            toast.error("Failed to save inquiry. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[6px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div 
                className="bg-white/70 backdrop-blur-[24px] w-full max-w-lg rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-400 relative flex flex-col max-h-[90vh]"
            >
                {/* Premium Gradient Header */}
                <div className="p-6 md:p-8 border-b border-white/40 flex justify-between items-center bg-gradient-to-br from-[#F0F4FF] via-[#F8F4FF] to-[#FFF9F0]">
                    <div>
                        <h2 className="font-luxury text-2xl text-[#2d2d2d] tracking-tight">New Inquiry Palette</h2>
                        <p className="text-[9px] text-[#8a8a8a] mt-2 font-bold uppercase tracking-[0.2em] bg-white/50 px-3 py-1 rounded-full border border-white/40 inline-block">Client Registry Registry</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-white/60 hover:bg-white text-[#8a8a8a] hover:text-[#2d2d2d] rounded-full transition-all hover:rotate-90 hover:shadow-md"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <User size={12} className="opacity-60" /> Full Name
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. Stanly Alpha"
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white focus:ring-4 focus:ring-[#D9CDEB]/10 transition-all shadow-sm"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Mail size={12} className="opacity-60" /> Email
                            </label>
                            <input
                                required
                                type="email"
                                placeholder="client@alpha.com"
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white focus:ring-4 focus:ring-[#D9CDEB]/10 transition-all shadow-sm"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Phone size={12} className="opacity-60" /> Contact
                            </label>
                            <input
                                type="tel"
                                placeholder="+91 ..."
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white focus:ring-4 focus:ring-[#D9CDEB]/10 transition-all shadow-sm"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Tag size={12} className="opacity-60" /> Event Type
                            </label>
                            <select
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm appearance-none"
                                value={formData.eventType}
                                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                            >
                                <option>Wedding</option>
                                <option>Pre-Wedding</option>
                                <option>Engagement</option>
                                <option>Reception</option>
                                <option>Fashion Shoot</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Calendar size={12} className="opacity-60" /> Date
                            </label>
                            <input
                                type="date"
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm"
                                value={formData.eventDate}
                                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Clock size={12} className="opacity-60" /> Time
                            </label>
                            <input
                                type="time"
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm"
                                value={formData.eventTime}
                                onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                            />
                        </div>
                        <div className="col-span-full space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <MapPin size={12} className="opacity-60" /> Location
                            </label>
                            <input
                                type="text"
                                placeholder="Preferred Destination"
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-3.5 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm"
                                value={formData.eventLocation}
                                onChange={(e) => setFormData({ ...formData, eventLocation: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/40 space-y-5">
                        <div className="bg-white/30 rounded-[20px] p-5 border border-white/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="col-span-full text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a8a8a] mb-1">Financial Structure</div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] uppercase font-bold tracking-widest text-[#9a9a9a] ml-1">Budget (₹)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#D9CDEB] font-bold"
                                    value={formData.totalAmount || ''}
                                    onChange={e => setFormData({ ...formData, totalAmount: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] uppercase font-bold tracking-widest text-[#9a9a9a] ml-1">Deposit (₹)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#D9CDEB] font-bold"
                                    value={formData.depositAmount || ''}
                                    onChange={e => setFormData({ ...formData, depositAmount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-white/70 backdrop-blur-md border-t border-white/40 py-8 px-1 mt-auto z-50 rounded-b-[40px]">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-lg transition-all border border-white/60 active:scale-[0.98] disabled:opacity-70 shadow-md"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin text-[#4a4a4a]" /> : <Save size={18} className="text-[#4a4a4a]" />}
                                {loading ? 'Archiving...' : 'Commit to Database'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
