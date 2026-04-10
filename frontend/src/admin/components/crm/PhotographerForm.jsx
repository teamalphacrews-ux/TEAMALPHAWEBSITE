import { useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, User, Mail, Phone, Camera, Shield, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function PhotographerForm({ onClose, onAdded }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || '';
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        specialty: "Lead",
        status: "Active"
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/photographers`, formData, authHeader);
            onAdded(response.data);
            toast.success(`${formData.name} added to the studio team!`);
        } catch (err) {
            console.error("Failed to add photographer", err);
            toast.error("Failed to add photographer. Email might already exist.");
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[6px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="bg-white/70 backdrop-blur-[24px] w-full max-w-lg rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-400 relative flex flex-col"
            >
                {/* Premium Gradient Header */}
                <div className="p-6 md:p-8 border-b border-white/40 flex justify-between items-center bg-gradient-to-br from-[#F0F4FF] via-[#F8F4FF] to-[#FFF9F0]">
                    <div>
                        <h2 className="font-serif text-2xl text-[#2d2d2d] tracking-tight">Studio Artist Registry</h2>
                        <p className="text-[9px] text-[#8a8a8a] mt-2 font-bold uppercase tracking-[0.2em] bg-white/50 px-3 py-1 rounded-full border border-white/40 inline-block">Team Expansion Registry</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-white/60 hover:bg-white text-[#8a8a8a] hover:text-[#2d2d2d] rounded-full transition-all hover:rotate-90 hover:shadow-md"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                            <User size={12} className="opacity-60" /> Full Name
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="e.g. Amit Kumar"
                            className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white focus:ring-4 focus:ring-[#D9CDEB]/10 transition-all shadow-sm"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Mail size={12} className="opacity-60" /> Email
                            </label>
                            <input
                                required
                                type="email"
                                placeholder="amit@alpha.com"
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Phone size={12} className="opacity-60" /> contact
                            </label>
                            <input
                                type="tel"
                                placeholder="+91 ..."
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Camera size={12} className="opacity-60" /> Specialty
                            </label>
                            <select
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm appearance-none"
                                value={formData.specialty}
                                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                            >
                                <option>Lead Photographer</option>
                                <option>Second Photographer</option>
                                <option>Videographer</option>
                                <option>Drone Operator</option>
                                <option>Editor</option>
                                <option>Cinematographer</option>
                                <option>LED Wall Operator</option>
                                <option>Live Streamer</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">
                                <Shield size={12} className="opacity-60" /> Status
                            </label>
                            <select
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm appearance-none"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-lg transition-all border border-white/60 active:scale-[0.98] disabled:opacity-70 shadow-md mt-6"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin text-[#4a4a4a]" /> : <Camera size={18} className="text-[#4a4a4a]" />}
                        {loading ? 'Archiving...' : 'Add Artist to Team'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}
