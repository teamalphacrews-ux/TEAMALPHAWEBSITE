import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Link as LinkIcon, Info, Loader2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function CreateGalleryModal({ isOpen, onClose, onGalleryCreated }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [availableClients, setAvailableClients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/drive-gallery/users/clients`, {
        headers: { 'x-auth-token': token }
      });
      setAvailableClients(res.data);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return toast.error("Please provide a client name.");

    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('name', name);
    if (password) formData.append('password', password);
    if (selectedClientId) formData.append('clientId', selectedClientId);

    if (thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/drive-gallery`, formData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success("New Client Collection created!");
      onGalleryCreated(res.data);
      onClose();
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setPassword("");
    setSelectedClientId("");
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-white/40 backdrop-blur-md"
        />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="relative w-full max-w-xl bg-white/80 backdrop-blur-[32px] border border-white/60 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-8 border-b border-black/5 bg-linear-to-br from-white/50 to-transparent shrink-0">
            <h2 className="page-title text-3xl">Add New Client</h2>
            <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#8a8a8a] mt-2">Initialize Collection</p>
            <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-black/5 rounded-full transition-all">
              <X size={20} className="text-[#8a8a8a]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] ml-1">Client Name</label>
              <input
                type="text" placeholder="e.g. Sachitha & Yogesh"
                value={name} onChange={(e) => setName(e.target.value)}
                className="search-bar w-full py-4 px-6 focus:ring-4 focus:ring-[#cfe8d5]/40 outline-none transition-all placeholder:text-[#8a8a8a] text-sm"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] ml-1">Link Client Account</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="search-bar w-full py-4 px-6 focus:ring-4 focus:ring-[#cfe8d5]/40 outline-none transition-all text-sm appearance-none bg-white/50"
              >
                <option value="">Select a registered client (Optional)</option>
                {availableClients.map(client => (
                  <option key={client._id} value={client._id}>
                    {client.firstName} {client.lastName} ({client.email})
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-[#8a8a8a] italic ml-1">Linking an account ensures the client sees this gallery immediately upon login.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] ml-1">Set Access Password</label>
              <input
                type="text" placeholder="Secure code for client access"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="search-bar w-full py-4 px-6 focus:ring-4 focus:ring-[#cfe8d5]/40 outline-none transition-all placeholder:text-[#8a8a8a] text-sm"
              />
              <p className="text-[9px] text-[#8a8a8a] italic ml-1">This password will be required for the client to view their gallery.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] ml-1">Cover Thumbnail</label>

              <div className="relative group">
                {thumbnailPreview ? (
                  <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-[#cfe8d5] group-hover:border-[#cfe8d5]/80 transition-all">
                    <img src={thumbnailPreview} className="w-full h-full object-cover" alt="Preview" />
                    <button
                      type="button" onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-all backdrop-blur-md"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-video rounded-3xl border-2 border-dashed border-black/5 hover:border-[#cfe8d5] hover:bg-[#cfe8d5]/5 transition-all cursor-pointer group">
                    <div className="p-4 bg-[#cfe8d5]/20 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                      <Upload size={24} className="text-[#3c9b7a]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8a8a8a]">Upload Client Cover</span>
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4 p-5 bg-[#cfe8d5]/20 rounded-3xl border border-[#cfe8d5]/40">
              <Info size={18} className="text-[#3c9b7a] mt-0.5 shrink-0" />
              <p className="text-[10px] text-[#3c9b7a] font-bold uppercase tracking-wider leading-relaxed">
                This will create a top-level folder for the client. You can add specificEvents (Wedding, Reception) inside it later.
              </p>
            </div>

            <button
              type="submit" disabled={isSubmitting}
              className="add-btn w-full py-5 text-sm tracking-[0.4em] shadow-xl shadow-[#cfe8d5]/30 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : "Create Client Collection"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
