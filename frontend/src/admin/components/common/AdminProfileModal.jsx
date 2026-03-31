import { useState, useEffect, useRef } from "react";
import { X, User, Save, Shield, LogOut } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminProfileModal({ profile, onClose, onSave }) {
    const [formData, setFormData] = useState({ ...profile });
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

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div 
                ref={modalRef}
                className="bg-white/70 backdrop-blur-2xl rounded-[32px] w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/50 animate-in zoom-in-95 duration-500 overflow-hidden"
            >
                {/* Premium Gradient Header */}
                <div className="relative p-10 flex flex-col items-center bg-gradient-to-br from-[#F0F4FF] via-[#F8F4FF] to-[#FFF9F0]">
                    {/* Decorative Background Element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#D9CDEB]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2.5 bg-white/40 hover:bg-white text-[#5f5f5f] hover:text-[#2d2d2d] rounded-full transition-all hover:rotate-90 hover:shadow-md z-10"
                    >
                        <X size={18} />
                    </button>

                    <div className="relative group">
                        <div className="w-24 h-24 bg-white/80 rounded-[28px] flex items-center justify-center border border-white shadow-sm mb-4 transition-all group-hover:scale-105 group-hover:shadow-lg">
                            <User size={40} className="text-[#CFE8D5] translate-y-1" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full border border-white shadow-sm flex items-center justify-center text-[#9c7a2a]">
                            <Shield size={14} />
                        </div>
                    </div>
                    
                    <h2 className="font-luxury text-3xl text-[#2d2d2d] tracking-tight translate-y-1">Profile Suite</h2>
                    <p className="text-[10px] text-[#7a7a7a] font-bold uppercase tracking-[0.25em] mt-3 bg-white/40 px-3 py-1 rounded-full border border-white/50">Registry Settings</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">
                    <div className="space-y-3">
                        <label className="text-[11px] uppercase font-bold tracking-[0.15em] text-[#8a8a8a] ml-1">Display Name</label>
                        <div className="relative group">
                            <input
                                type="text"
                                required
                                value={formData.name || ""}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-white/50 border border-white/80 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm placeholder:text-[#b0b0b0]"
                                placeholder="Your full name"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] uppercase font-bold tracking-[0.15em] text-[#8a8a8a] ml-1">Studio Role</label>
                        <div className="flex items-center gap-2 group">
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    required
                                    value={formData.role || ""}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full bg-white/50 border border-white/80 rounded-2xl px-5 py-4 text-[13px] font-medium text-[#2d2d2d] focus:outline-none focus:border-[#D9CDEB] focus:bg-white transition-all shadow-sm"
                                    placeholder="e.g. Creative Admin"
                                />
                                <Shield size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#b0b0b0] group-hover:text-[#2d2d2d] transition-colors" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-4">
                        <button
                            type="submit"
                            className="w-full bg-gradient-to-br from-[#CFE8D5] via-[#E8D8FF] to-[#D9CDEB] text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-3 text-[12px] font-bold uppercase tracking-widest hover:-translate-y-1 hover:shadow-xl transition-all active:scale-[0.98] shadow-md border border-white/40"
                        >
                            <Save size={18} /> Update Palette
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
        </div>
    );
}
