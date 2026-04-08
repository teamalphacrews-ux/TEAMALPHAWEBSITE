import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Link as LinkIcon, CheckCircle2, Loader2, Info } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function UploadModal({ isOpen, onClose, onUploadSuccess, clientFolders = [] }) {
  const [tab, setTab] = useState("file"); // "file" or "link"
  const [file, setFile] = useState(null);
  const [driveLink, setDriveLink] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [collectionName, setCollectionName] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();
    const finalClientId = newClient.trim() || clientId;
    if (!finalClientId) return toast.error("Please specify a client.");

    const token = localStorage.getItem('token');
    setIsUploading(true);

    try {
      if (tab === "file") {
        if (!file) throw new Error("Select a file first.");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", finalClientId);
        
        const res = await axios.post(`${API_BASE_URL}/api/media/upload`, formData, {
          headers: { 'x-auth-token': token }
        });
        onUploadSuccess(res.data);
      } else {
        if (!driveLink) throw new Error("Paste a Drive link first.");
        const res = await axios.post(`${API_BASE_URL}/api/media/drive-collection`, {
          driveLink,
          clientId: finalClientId,
          name: collectionName || "New Drive Collection"
        }, {
          headers: { 'x-auth-token': token }
        });
        onUploadSuccess(res.data);
      }

      toast.success("Added to gallery!");
      onClose();
      reset();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setDriveLink("");
    setClientId("");
    setNewClient("");
    setCollectionName("");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-white/40 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-xl bg-white/80 backdrop-blur-[24px] border border-white/60 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-8 border-b border-black/5 flex justify-between items-center bg-linear-to-br from-white/50 to-transparent">
            <div>
              <h2 className="text-2xl font-serif text-[#2d2d2d]">Add Media</h2>
              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a] mt-1 font-bold">New Gallery Entry</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-all">
              <X size={20} className="text-[#8a8a8a]" />
            </button>
          </div>

          <div className="p-8 space-y-8">
            {/* Tab Selector */}
            <div className="flex p-1.5 bg-black/[0.03] rounded-2xl border border-black/5">
              <button 
                onClick={() => setTab("file")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${tab === "file" ? 'bg-white shadow-sm text-black' : 'text-[#8a8a8a] hover:text-[#2d2d2d]'}`}
              >
                <Upload size={14} /> File Upload
              </button>
              <button 
                onClick={() => setTab("link")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${tab === "link" ? 'bg-white shadow-sm text-black' : 'text-[#8a8a8a] hover:text-[#2d2d2d]'}`}
              >
                <LinkIcon size={14} /> Drive Link
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
              {/* Client Section */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] block ml-1">Client Collection</label>
                <div className="grid grid-cols-1 gap-3">
                  <select 
                    value={clientId} 
                    onChange={(e) => { setClientId(e.target.value); if(e.target.value) setNewClient(""); }}
                    className="w-full bg-white/60 border border-white/80 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-[#cfe8d5]/40 transition-all outline-none appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="">Existing Clients...</option>
                    {clientFolders.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input 
                    type="text" placeholder="Or create new collection..."
                    value={newClient} onChange={(e) => { setNewClient(e.target.value); if(e.target.value) setClientId(""); }}
                    className="w-full bg-white/60 border border-white/80 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-[#d9cdeb]/40 transition-all outline-none shadow-sm"
                  />
                </div>
              </div>

              {tab === "file" ? (
                <label className="block group">
                  <div className="w-full border-2 border-dashed border-black/10 rounded-[28px] p-10 text-center transition-all group-hover:border-black/20 group-hover:bg-black/[0.02] cursor-pointer">
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                    <div className="w-16 h-16 bg-linear-to-br from-[#cfe8d5] to-[#d9cdeb] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/5">
                      {file ? <CheckCircle2 size={24} className="text-white" /> : <Upload size={24} className="text-white" />}
                    </div>
                    <p className="text-sm font-medium text-[#2d2d2d]">{file ? file.name : "Select Image or Video"}</p>
                    <p className="text-[10px] text-[#8a8a8a] uppercase tracking-widest mt-1">Ready to curate</p>
                  </div>
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] block ml-1">Drive Folder Link</label>
                    <input 
                      type="url" placeholder="https://drive.google.com/..."
                      value={driveLink} onChange={(e) => setDriveLink(e.target.value)}
                      className="w-full bg-white/60 border border-white/80 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-[#cfe8d5]/40 transition-all outline-none shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8a] block ml-1">Internal Title (e.g. Wedding Raw)</label>
                    <input 
                      type="text" placeholder="Collection Name"
                      value={collectionName} onChange={(e) => setCollectionName(e.target.value)}
                      className="w-full bg-white/60 border border-white/80 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-[#d9cdeb]/40 transition-all outline-none shadow-sm"
                    />
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <Info size={16} className="text-blue-500 mt-0.5" />
                    <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                      Make sure the folder is shared with **anyone with the link** or your system email for listing permissions.
                    </p>
                  </div>
                </div>
              )}

              <button 
                type="submit" disabled={isUploading}
                className="w-full py-5 rounded-2xl bg-linear-to-br from-[#cfe8d5] to-[#d9cdeb] text-[#2d2d2d] text-xs font-bold uppercase tracking-[0.3em] shadow-xl shadow-black/5 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin mx-auto" /> : "Finalize & Save"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
