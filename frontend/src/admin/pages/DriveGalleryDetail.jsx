import { useState, useEffect, useMemo } from "react";
import Masonry from "react-masonry-css";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Search, 
  LayoutGrid, 
  Play, 
  Maximize2, 
  Download, 
  Clock, 
  Filter,
  Loader2,
  Box,
  Image as ImageIcon,
  Video as VideoIcon
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Components
import PreviewModal from "../components/gallery/PreviewModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DriveGalleryDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch Event Metadata
      const eventRes = await axios.get(`${API_BASE_URL}/api/drive-gallery/event/${eventId}`, {
        headers: { 'x-auth-token': token }
      });
      setEvent(eventRes.data);

      // Fetch Files for this event
      const filesRes = await axios.get(`${API_BASE_URL}/api/drive-gallery/files/${eventId}`, {
        headers: { 'x-auth-token': token }
      });
      setFiles(filesRes.data);
    } catch (err) {
      toast.error("Failed to fetch event media.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = 
        filterType === "all" || 
        (filterType === "images" && f.mimeType.startsWith('image/')) ||
        (filterType === "videos" && f.mimeType.startsWith('video/')) ||
        (filterType === "recent" && (new Date() - new Date(f.createdTime)) < (7 * 24 * 60 * 60 * 1000));
      return matchesSearch && matchesFilter;
    });
  }, [files, searchQuery, filterType]);

  if (loading && !event) return (
    <div className="flex flex-col h-[70vh] items-center justify-center animate-in fade-in duration-700">
      <Loader2 size={40} className="animate-spin text-[#cfe8d5] mb-4" />
      <p className="page-title !text-2xl text-[#8a8a8a]">Opening Event Bundle...</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 animate-in fade-in duration-1000">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-4">
          <button 
            onClick={() => navigate(`/admin/gallery/${event?.clientId}`)}
            className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.3em] text-[#8a8a8a] hover:text-[#2d2d2d] transition-all group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Client Events
          </button>
          <div className="space-y-1">
            <h1 className="page-title text-[#2d2d2d]">{event?.name}</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#cfe8d5] ml-1">Curated Smart Event Collection</p>
          </div>
        </div>

        {/* Toolbar Integration */}
        <div className="flex flex-col lg:flex-row gap-4 items-center w-full lg:w-auto">
          <div className="flex bg-white/60 p-1.5 rounded-2xl border border-white/80 shadow-sm w-full lg:w-auto overflow-x-auto">
            {["all", "images", "videos", "recent"].map(type => (
              <button 
                key={type} onClick={() => setFilterType(type)}
                className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filterType === type ? 'bg-linear-to-br from-[#cfe8d5] to-[#d9cdeb] text-[#2d2d2d] shadow-sm' : 'text-[#8a8a8a] hover:text-[#2d2d2d]'}`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-64 group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a8a]" />
            <input 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="search-bar w-full py-3.5 pl-12 pr-4 text-xs focus:ring-4 focus:ring-[#f6e6b4]/30 outline-none transition-all placeholder:text-[#8a8a8a]"
            />
          </div>
        </div>
      </div>

      {/* Masonry Display */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => (
            <div key={n} className="aspect-[3/4] bg-white/40 animate-pulse rounded-[24px] border border-white/60 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            </div>
          ))}
        </div>
      ) : filteredFiles.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <Masonry
            breakpointCols={{
              default: 4,
              1100: 3,
              700: 2,
              500: 1
            }}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {filteredFiles.map((file, idx) => (
              <motion.div
                layout
                key={file.id}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.21, 1, 0.36, 1],
                  delay: Math.min(idx * 0.02, 0.5) // Staggered but capped
                }}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
                onClick={() => setSelectedFile(file)}
                className="relative group cursor-pointer overflow-hidden transition-all duration-500 rounded-2xl mb-6 bg-white shadow-sm hover:shadow-xl hover:shadow-[#cfe8d5]/20"
              >
                <div className="w-full h-full relative overflow-hidden rounded-2xl">
                    <motion.img 
                      src={file.thumbnailLink ? file.thumbnailLink.replace('=s220', '=s400') : `${API_BASE_URL}/api/drive-gallery/proxy/${file.id}`} 
                      alt={file.name} 
                      loading="lazy"
                      className="w-full h-auto block object-cover scale-100 group-hover:scale-110 transition-transform duration-700" 
                      onError={(e) => {
                        if (!e.target.src.includes('/proxy/')) {
                          e.target.src = `${API_BASE_URL}/api/drive-gallery/proxy/${file.id}`;
                        }
                      }}
                    />
                    
                    {/* Minimal Subtle Overlay */}
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white scale-90 group-hover:scale-100 transition-transform duration-300 border border-white/30">
                         <Maximize2 size={24} strokeWidth={1.5} />
                      </div>
                    </div>
                </div>
              </motion.div>
            ))}
          </Masonry>
        </AnimatePresence>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 animate-in fade-in zoom-in duration-1000">
           <div className="avatar !w-24 !h-24 !rounded-[40px] mb-8 bg-linear-to-br from-[#f6e6b4] to-[#cfe8d5]/30 flex items-center justify-center">
              <Box size={40} className="text-[#8a8a8a]" strokeWidth={1} />
           </div>
           <h3 className="page-title !text-2xl text-[#8a8a8a]">No media found in the folder.</h3>
           <p className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a8a] mt-2">Upload some images/videos to your Google Drive folder</p>
        </div>
      )}

      {/* Internal Modals */}
      <PreviewModal 
        item={selectedFile ? { ...selectedFile, fileId: selectedFile.id } : null} 
        onClose={() => setSelectedFile(null)}
        onDelete={() => {}} // Dynamic fetch means no manual delete here (or can add Drive delete)
      />
    </div>
  );
}
