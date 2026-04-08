import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, User, Save, Shield, LogOut, Loader2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function AdminProfileModal({ profile, onClose, onSave }) {
    const [formData, setFormData] = useState({ 
        name: profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : (profile?.name || ""),
        role: profile?.role || ""
    });
    const [loading, setLoading] = useState(false);
    const modalRef = useRef(null);

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("Name cannot be empty");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const apiUrl = import.meta.env.VITE_API_URL || "";
            
            const res = await axios.put(`${apiUrl}/api/auth/profile`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data) {
                // Prepare combined name for frontend state consistency
                const updatedUser = {
                    ...res.data,
                    name: `${res.data.firstName} ${res.data.lastName || ""}`.trim()
                };
                onSave(updatedUser);
                onClose();
            }
        } catch (err) {
            console.error("Profile update error:", err);
            toast.error(err.response?.data?.msg || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[6px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div 
                ref={modalRef}
                className="bg-white/90 backdrop-blur-[24px] rounded-[24px] w-full max-w-md shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-white/60 animate-in zoom-in-95 duration-400 overflow-hidden flex flex-col"
            >
                {/* Premium Gradient Header */}
                <div className="relative p-6 md:p-8 flex flex-col items-center bg-gradient-to-br from-[#F0F4FF] via-[#F8F4FF] to-[#FFF9F0] border-b border-white/40">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 bg-white/60 hover:bg-white text-[#8a8a8a] hover:text-[#2d2d2d] rounded-full transition-all hover:rotate-90 hover:shadow-sm z-10"
                    >
                        <X size={18} />
                    </button>

                    <div className="relative mb-4">
                        <div className="w-20 h-20 bg-white/90 rounded-[22px] flex items-center justify-center border border-white shadow-sm transition-all group-hover:scale-105 group-hover:shadow-lg">
                            <User size={36} className="text-[#CFE8D5] translate-y-1" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full border border-white shadow-sm flex items-center justify-center text-[#D9CDEB]">
                            <Shield size={12} />
                        </div>
                    </div>
                    
                    <h2 className="font-luxury text-2xl text-[#2d2d2d] tracking-tight">Studio Profile</h2>
                    <p className="text-[9px] text-[#8a8a8a] font-bold uppercase tracking-[0.2em] mt-2 bg-white/50 px-3 py-1 rounded-full border border-white/40">Administrative Identity</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">Display Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white/80 focus:ring-4 focus:ring-[#D9CDEB]/10 transition-all shadow-sm placeholder:text-[#c0c0c0]"
                            placeholder="Your administrative name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">Studio Assignment</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full bg-white/40 border border-white/60 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white/80 focus:ring-4 focus:ring-[#D9CDEB]/10 transition-all shadow-sm"
                                placeholder="e.g. Lead Developer"
                            />
                            <Shield size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#c0c0c0]" />
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-lg transition-all border border-white/60 active:scale-[0.98] disabled:opacity-70 shadow-md"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin text-[#4a4a4a]" /> : <Save size={18} className="text-[#4a4a4a]" />}
                            {loading ? "Update Palette..." : "Commit Changes"}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to log out?")) {
                                    localStorage.removeItem("token");
                                    localStorage.removeItem("user");
                                    window.location.href = "/";
                                }
                            }}
                            className="w-full bg-red-50/30 text-red-500 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white border border-red-100 transition-all active:scale-[0.98] mt-2 group"
                        >
                            <LogOut size={14} className="opacity-60 group-hover:opacity-100" />
                            De-authenticate
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
