import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Maximize2, Trash2, Heart } from "lucide-react";
import toast from "react-hot-toast";

export default function PreviewModal({ item, onClose, onDelete }) {
  if (!item) return null;

  const isVideo = item.mimeType?.includes("video/");
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';
  const token = localStorage.getItem('token');

  const proxyUrl = `${API_BASE_URL}/api/drive-gallery/proxy/${item.fileId}`;
  // Fast Optimized Preview (High Res but not the massive original)
  const previewUrl = isVideo ? proxyUrl : `${proxyUrl}?thumbnail=true`;
  // Low-res placeholder for immediate display
  const placeholderUrl = item.thumbnailLink || proxyUrl;
  const downloadUrl = item.webContentLink || item.webViewLink || previewUrl;

  const [isLoaded, setIsLoaded] = useState(false);

  const handleDownload = () => {
    window.open(downloadUrl, "_blank");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/95 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 text-white/50 hover:text-white transition-all transform hover:rotate-90 pointer-events-auto z-50"
          >
            <X size={32} strokeWidth={1.5} />
          </button>

          {/* Media Content */}
          <div className="w-full flex-1 flex items-center justify-center p-4 pointer-events-auto relative">
            {isVideo ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl bg-black"
                onError={(e) => {
                  toast.error("Video preview failed. Try downloading.");
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="relative flex items-center justify-center max-w-full max-h-[80vh]">
                {/* Low-res blurred placeholder */}
                {!isLoaded && (
                  <img
                    src={placeholderUrl}
                    className="max-w-full max-h-[80vh] rounded-2xl blur-xl opacity-50 scale-105"
                    alt=""
                  />
                )}
                {/* High-res image */}
                <img
                  src={previewUrl}
                  alt={item.name}
                  onLoad={() => setIsLoaded(true)}
                  className={`max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain bg-white/5 transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                  onError={(e) => {
                    if (e.target.src !== proxyUrl) {
                      e.target.src = proxyUrl;
                    } else {
                      toast.error("Image preview failed. Try downloading.");
                      e.target.style.display = 'none';
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="w-full max-w-4xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6 pointer-events-auto">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-medium text-white tracking-tight">{item.name}</h3>
              <p className="text-xs text-white/40 uppercase tracking-[0.2em] mt-1 font-bold">
                {isVideo ? "High Quality Sequence" : "Original Composition"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleDownload}
                className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-all shadow-xl active:scale-95"
              >
                <Download size={18} />
                Download Original
              </button>

              <button
                onClick={() => {
                  if (window.confirm("Permanently delete this asset?")) {
                    onDelete(item._id);
                    onClose();
                  }
                }}
                className="p-4 bg-white/5 border border-white/10 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
