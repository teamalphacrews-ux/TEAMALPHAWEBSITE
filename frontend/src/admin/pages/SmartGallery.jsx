import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Image as ImageIcon, FolderOpen, Calendar, ChevronRight, Pencil, Loader2, Trash2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Components
import CreateGalleryModal from "../components/gallery/CreateGalleryModal";
import EditClientModal from "../components/gallery/EditClientModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function SmartGallery() {
  const navigate = useNavigate();
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/drive-gallery`, {
        headers: { 'x-auth-token': token }
      });
      setGalleries(res.data);
    } catch (err) {
      toast.error("Failed to load clients.");
    } finally {
      setLoading(false);
    }
  };

  const deleteGallery = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Permanently remove this client and all associated events?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/drive-gallery/${id}`, {
        headers: { 'x-auth-token': token }
      });
      setGalleries(prev => prev.filter(g => g._id !== id));
      toast.success("Client removed.");
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

  const handleEdit = (e, client) => {
    e.stopPropagation();
    setEditingClient(client);
  };

  return (
    <div className="min-h-screen pb-20 animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="page-title text-4xl text-[#2d2d2d]">Client Collections</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#cfe8d5] ml-1">Parent Repositories</p>
        </div>

        <button 
          onClick={() => setIsCreateOpen(true)}
          className="add-btn flex items-center gap-3 px-8 py-4 shadow-xl shadow-[#cfe8d5]/40"
        >
          <Plus size={18} />
          <span className="text-xs font-bold uppercase tracking-widest text-[#2d2d2d]">Add New Client</span>
        </button>
      </div>

      {/* Collections Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {[1,2,3,4].map(n => <div key={n} className="h-96 bg-white/40 animate-pulse rounded-[40px] border border-white/60" />)}
        </div>
      ) : galleries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {galleries.map((gallery, idx) => (
            <motion.div
              layout
              key={gallery._id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.8,
                delay: idx * 0.1,
                ease: [0.22, 1, 0.36, 1]
              }}
              whileHover={{ y: -12 }}
              className="group relative aspect-[3.5/4.5] rounded-[32px] overflow-hidden bg-black shadow-2xl transition-all duration-500"
            >
              {/* Clickable Area for Navigation */}
              <div 
                className="absolute inset-0 z-10" 
                onClick={() => navigate(`/admin/gallery/${gallery._id}`)}
              />

              {/* Full Image Background */}
              <motion.img 
                src={gallery.thumbnail} 
                alt={gallery.name}
                whileHover={{ scale: 1.15 }}
                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
              />

              {/* Sophisticated Gradient Overlays */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-20" />
              <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-20" />

              {/* Glassmorphic Management Controls - High Z-Index to stay above clickable area */}
              <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 delay-100 z-50">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleEdit(e, gallery);
                  }}
                  className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-[#cfe8d5]/40 text-white hover:text-white rounded-2xl transition-all shadow-lg group/edit"
                  title="Edit Collection"
                >
                  <Pencil size={16} className="group-hover/edit:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    deleteGallery(e, gallery._id);
                  }}
                  className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-red-500/40 text-white hover:text-red-200 rounded-2xl transition-all shadow-lg group/del"
                  title="Delete Collection"
                >
                  <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                </button>
              </div>

              {/* Dynamic Text Content Overlay */}
              <div className="absolute inset-0 p-8 flex flex-col justify-end z-30 pointer-events-none">
                <motion.div 
                  initial={false}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 w-fit mb-4 group-hover:bg-[#cfe8d5]/20 group-hover:border-[#cfe8d5]/40 transition-all duration-500"
                >
                  <span className="text-[10px] text-white/90 group-hover:text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <ImageIcon size={10} className="mb-0.5" />
                    Client Collection
                  </span>
                </motion.div>

                <h3 className="text-3xl font-bold text-white tracking-tight mb-2 group-hover:text-[#cfe8d5] transition-colors duration-500">
                  {gallery.name}
                </h3>

                <div className="flex items-center gap-3 text-white/50 group-hover:text-white/80 transition-colors duration-500">
                  <Calendar size={12} className="shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest pt-0.5">
                    Updated {new Date(gallery.createdAt).toLocaleDateString()}
                  </span>
                  <div className="h-px flex-1 bg-white/10 group-hover:bg-white/20 transition-all" />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-500" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 animate-in fade-in zoom-in duration-1000">
           <div className="avatar !w-24 !h-24 !rounded-[40px] mb-8 bg-linear-to-br from-[#f6e6b4] to-[#cfe8d5]/30 flex items-center justify-center">
              <FolderOpen size={40} className="text-[#8a8a8a]" strokeWidth={1} />
           </div>
           <h3 className="page-title !text-2xl text-[#8a8a8a]">No client collections yet.</h3>
           <p className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a8a] mt-2">Start by creating your first client portal</p>
        </div>
      )}

      {/* Gallery Form Modal */}
      <CreateGalleryModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)}
        onGalleryCreated={(newGal) => {
          setGalleries(prev => [newGal, ...prev]);
        }}
      />

      <EditClientModal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        client={editingClient}
        onSuccess={fetchGalleries}
      />

    </div>
  );
}
