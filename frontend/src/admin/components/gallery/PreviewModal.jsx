import { useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { X, Download, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../../../utils/apiConfig";
import { fetchDriveBlob } from "./protectedDrive";
import useDriveMedia from "./useDriveMedia";

export default function PreviewModal({ item, onClose, onDelete }) {
  const [originalFileId, setOriginalFileId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [failedFileId, setFailedFileId] = useState(null);
  const isVideo = item?.mimeType?.includes("video/");
  const thumbnail = !isVideo && originalFileId !== item?.fileId;
  const { url: previewUrl, error } = useDriveMedia(item?.fileId, thumbnail);
  if (!item) return null;
  const isDownloading = downloadingId === item.fileId;

  const handleDownload = async () => {
    setDownloadingId(item.fileId);
    try {
      const blob = await fetchDriveBlob({ baseUrl: API_BASE_URL, fileId: item.fileId, token: localStorage.getItem("token"), download: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.name || "studio-media";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (downloadError) {
      toast.error(downloadError.message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/95 backdrop-blur-md"
        />

        <Motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close media preview"
            className="absolute top-0 right-0 p-2 text-white/50 hover:text-white transition-all transform hover:rotate-90 pointer-events-auto z-50"
          >
            <X size={32} strokeWidth={1.5} />
          </button>

          {/* Media Content */}
          <div className="w-full flex-1 flex items-center justify-center p-4 pointer-events-auto relative">
            {error || failedFileId === item.fileId ? (
              <div className="text-center text-white" role="status">
                <p>{error || "This media cannot be previewed in your browser."}</p>
                {thumbnail && <button className="mt-4 underline" onClick={() => setOriginalFileId(item.fileId)}>Try original image</button>}
              </div>
            ) : !previewUrl ? (
              <p className="text-white/80" role="status">Loading secure {isVideo ? "video" : "image"} preview…</p>
            ) : isVideo ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl bg-black"
                onError={() => setFailedFileId(item.fileId)}
              />
            ) : (
              <div className="relative flex items-center justify-center max-w-full max-h-[80vh]">
                <img
                  src={previewUrl}
                  alt={item.name}
                  className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain bg-white/5"
                  onError={() => thumbnail ? setOriginalFileId(item.fileId) : setFailedFileId(item.fileId)}
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
                disabled={isDownloading}
                className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-all shadow-xl active:scale-95"
              >
                <Download size={18} />
                {isDownloading ? "Preparing download…" : "Download Original"}
              </button>

              {onDelete && item._id && <button
                aria-label={`Delete ${item.name}`}
                onClick={() => {
                  if (window.confirm("Permanently delete this asset?")) {
                    onDelete(item._id);
                    onClose();
                  }
                }}
                className="p-4 bg-white/5 border border-white/10 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
              >
                <Trash2 size={20} />
              </button>}
            </div>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  );
}
