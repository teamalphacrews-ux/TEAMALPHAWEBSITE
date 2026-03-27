import { useState } from "react";
import { X, User, Save, Shield } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminProfileModal({ profile, onClose, onSave }) {
    const [formData, setFormData] = useState({ ...profile });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        toast.success("Profile updated successfully!");
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="bg-charcoal text-white p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20 mb-3 text-3xl">
                            <User size={32} />
                        </div>
                        <h2 className="font-serif text-xl">Admin Settings</h2>
                        <p className="text-white/60 text-xs uppercase tracking-widest mt-1">Update your registry profile</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Display Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors font-medium text-charcoal"
                            placeholder="e.g. Vijaya Lakshmi S"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Role / Title</label>
                        <div className="flex items-center gap-2 bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 focus-within:border-mutedbrown transition-colors">
                            <Shield size={16} className="text-mutedbrown" />
                            <input
                                type="text"
                                required
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full bg-transparent text-sm focus:outline-none font-medium text-charcoal"
                                placeholder="e.g. Admin Registry"
                            />
                        </div>
                    </div>



                    <button
                        type="submit"
                        className="w-full bg-charcoal text-white py-4 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-mutedbrown transition-all shadow-lg active:scale-[0.98] mt-4"
                    >
                        <Save size={16} /> Save Changes
                    </button>

                    <div className="pt-4 border-t border-[#f0f0f0] mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to log out?")) {
                                    localStorage.removeItem("token");
                                    localStorage.removeItem("user");
                                    window.location.href = "/";
                                }
                            }}
                            className="w-full bg-white border border-[#e6e3df] text-red-500 py-3.5 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-red-50 transition-all active:scale-[0.98]"
                        >
                            Log Out
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
