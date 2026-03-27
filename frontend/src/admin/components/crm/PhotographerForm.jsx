import { useState } from "react";
import axios from "axios";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function PhotographerForm({ onClose, onAdded }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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

    return (
        <div className="bg-ivory w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-[#e6e3df] flex justify-between items-center bg-white">
                <h2 className="font-serif text-2xl text-charcoal">New Photographer</h2>
                <button onClick={onClose} className="p-2 hover:bg-ivory rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Full Name</label>
                    <input
                        required
                        type="text"
                        className="w-full bg-white border border-[#e6e3df] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown"
                        placeholder="e.g. Amit Kumar"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Email Address</label>
                        <input
                            required
                            type="email"
                            className="w-full bg-white border border-[#e6e3df] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown"
                            placeholder="amit@teamalpha.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Phone Number</label>
                        <input
                            type="tel"
                            className="w-full bg-white border border-[#e6e3df] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown"
                            placeholder="+91 ..."
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Specialty</label>
                        <select
                            className="w-full bg-white border border-[#e6e3df] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown appearance-none"
                            value={formData.specialty}
                            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        >
                            <option>Lead</option>
                            <option>Second</option>
                            <option>Video</option>
                            <option>Drone</option>
                            <option>Editor</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Status</label>
                        <select
                            className="w-full bg-white border border-[#e6e3df] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown appearance-none"
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
                    className="w-full bg-charcoal text-white py-5 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-mutedbrown transition-all shadow-xl disabled:opacity-50"
                >
                    {loading ? "Adding..." : "Add to Team"}
                </button>
            </form>
        </div>
    );
}
