import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, Mail, Phone, Tag, MoreVertical } from "lucide-react";
import PhotographerForm from "./PhotographerForm";
import toast from "react-hot-toast";
import PhotographerProfile from "./PhotographerProfile";

export default function PhotographerList() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || '';
    const [photographers, setPhotographers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPhotographer, setSelectedPhotographer] = useState(null);

    useEffect(() => {
        fetchPhotographers();
    }, []);

    const fetchPhotographers = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/photographers`, authHeader);
            setPhotographers(response.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch photographers", err);
            setLoading(false);
        }
    };

    const deletePhotographer = async (id, e) => {
        if (e) e.stopPropagation();
        if (window.confirm("Delete this photographer?")) {
            try {
                await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/photographers/${id}`, authHeader);
                setPhotographers(photographers.filter(p => p._id !== id));
                toast.success("Photographer removed from studio team.");
            } catch (err) {
                console.error("Failed to delete photographer", err);
                toast.error("Failed to delete photographer.");
            }
        }
    };

    const handleAdded = (newPhotographer) => {
        setPhotographers([newPhotographer, ...photographers]);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="font-serif text-2xl text-charcoal">Studio Photographers</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-charcoal text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all shadow-lg"
                >
                    <Plus size={16} />
                    Add Photographer
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {photographers.length > 0 ? (
                    photographers.map((p) => (
                        <div
                            key={p._id}
                            onClick={() => setSelectedPhotographer(p)}
                            className="bg-white rounded-3xl p-6 border border-[#e6e3df]/40 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer hover:border-mutedbrown"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-ivory text-mutedbrown rounded-2xl flex items-center justify-center font-serif text-2xl border border-transparent group-hover:bg-charcoal group-hover:text-white transition-all">
                                        {(p.name || "?")[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-charcoal">{p.name}</h3>
                                        <p className="text-[10px] uppercase tracking-widest text-mutedbrown font-bold mt-0.5">{p.specialty || "Unassigned"}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => deletePhotographer(p._id, e)}
                                    className="text-warmgray hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="mt-6 space-y-3">
                                <div className="flex items-center gap-3 text-xs text-warmgray">
                                    <Mail size={14} />
                                    <span className="truncate">{p.email}</span>
                                </div>
                                {p.phone && (
                                    <div className="flex items-center gap-3 text-xs text-warmgray">
                                        <Phone size={14} />
                                        <span>{p.phone}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-ivory flex justify-between items-center">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${p.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    {p.status}
                                </span>
                                <button className="text-warmgray hover:text-charcoal transition-colors">
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-[#e6e3df]">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                            <Plus size={48} strokeWidth={1} />
                            <p className="font-serif italic text-lg">No photographers added yet.</p>
                        </div>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <PhotographerForm
                        onClose={() => setShowForm(false)}
                        onAdded={handleAdded}
                    />
                </div>
            )}

            {selectedPhotographer && (
                <PhotographerProfile
                    photographer={selectedPhotographer}
                    onClose={() => setSelectedPhotographer(null)}
                    onUpdate={(updated) => {
                        setPhotographers(photographers.map(p => p._id === updated._id ? updated : p));
                        setSelectedPhotographer(updated);
                    }}
                />
            )}
        </div>
    );
}
