import React, { useState, useEffect, useMemo } from "react";
import { Download, X, Maximize2, Play, Image as ImageIcon, Sparkles, Filter, Camera, Lock, ArrowRight, Loader2, Calendar, ChevronRight, ArrowLeft, Search, Box } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Masonry from "react-masonry-css";
import LoadingScreen from "../../components/common/LoadingScreen";

export default function Gallery() {
  const [user, setUser] = useState(null);
  
  // Auth & State
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [galleryId, setGalleryId] = useState(null);

  // Views ('events' or 'masonry')
  const [view, setView] = useState("events");
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  
  // Masonry details
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  
  // Preview
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [imagesLoaded, setImagesLoaded] = useState(0);

  useEffect(() => {
    const fetchUserAndInit = async () => {
      setLoadingEvents(true);
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const userRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/me`, {
            headers: { 'x-auth-token': token }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
            
            // Check if this gallery is already unlocked for this session
            const storedId = localStorage.getItem(`gallery_id_${userData._id}`);
            const isUnlocked = localStorage.getItem(`gallery_unlocked_${userData._id}`);
            
            if (isUnlocked === 'true' && storedId) {
              setGalleryId(storedId);
              setIsLocked(false);
              await fetchEvents(storedId);
            }
          }
        }
        if (!localStorage.getItem('token')) setLoadingEvents(false);
      } catch (err) {
        console.error("Failed to initialize gallery:", err);
        setLoadingEvents(false);
      }
    };

    fetchUserAndInit();
  }, []);

  const fetchEvents = async (cid) => {
    setLoadingEvents(true);
    try {
      const token = localStorage.getItem('token');
      const eventsRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/${cid}/events`, {
        headers: { 'x-auth-token': token }
      });
      const eventsData = await eventsRes.json();
      setEvents(eventsData || []);
    } catch (err) {
      console.error("Failed to fetch gallery events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) return setError("Please enter your access code.");
    
    setVerifying(true);
    setError("");
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/verify/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          password,
          clientId: user?._id, // Direct ID-based lookup
          clientName: user?.firstName + " " + user?.lastName // Fallback match
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setIsLocked(false);
        setGalleryId(data.id);
        localStorage.setItem(`gallery_unlocked_${user?._id}`, 'true');
        localStorage.setItem(`gallery_id_${user?._id}`, data.id);
        await fetchEvents(data.id);
      } else {
        setError(data.error || "Incorrect access code.");
      }
    } catch (err) {
      setError("Authorization failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenEvent = async (event) => {
    setImagesLoaded(0); // Reset count immediately
    setSelectedEvent(event);
    setView("masonry");
    setLoadingFiles(true);
    setSearchQuery("");
    setFilterType("all");
    setFiles([]);
    try {
        const token = localStorage.getItem('token');
        const filesRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/files/${event._id}`, {
            headers: { 'x-auth-token': token }
        });
        const filesData = await filesRes.json();
        setFiles(filesData || []);
    } catch (err) {
        console.error("Failed to fetch files for event", err);
    } finally {
        setLoadingFiles(false);
    }
  };

  const imageFiles = useMemo(() => files.filter(f => f.mimeType.startsWith('image/')), [files]);
  const totalImages = imageFiles.length;

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

  useEffect(() => {
    if (selectedMedia) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [selectedMedia]);

  const downloadMedia = async (fileId, filename) => {
    try {
      // Create a direct export/download link
      const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'memory';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab
      window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, '_blank');
    }
  };

  return (
    <div className="animate-in fade-in duration-700">
      <LoadingScreen 
        isLoading={view === "masonry" && (loadingFiles || (totalImages > 0 && imagesLoaded < totalImages))} 
        total={totalImages} 
        current={imagesLoaded} 
      />
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        
        {isLocked ? (
          <>
            <header className="text-left mb-8 animate-fade-up">
                <h1 className="text-4xl md:text-5xl mb-4 uppercase tracking-[8px] font-light text-stone-800">The Gallery</h1>
                <div className="h-1 w-20 bg-gradient-to-r from-luxury-gold to-luxury-gold/20 rounded-full"></div>
                <p className="text-luxury-text-muted italic max-w-2xl text-sm mt-4">
                    Explore your curated collection of moments, captured with soul and preserved for eternity.
                </p>
            </header>
            <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
              <div className="w-full max-w-md glass-card !p-8 md:!p-12 text-center border-white/60 shadow-2xl relative overflow-hidden mx-auto">
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-luxury-gold/10 rounded-full blur-3xl"></div>
                  
                  <div className="icon-wrapper !w-20 !h-20 mx-auto mb-10 bg-gradient-to-b from-luxury-gold/20 to-transparent shadow-xl">
                      <Lock size={32} className="text-luxury-gold animate-pulse" strokeWidth={1} />
                  </div>
                  
                  <h2 className="text-3xl font-light mb-4 uppercase tracking-[4px] text-stone-800">Secure Vault</h2>
                  <p className="text-[10px] uppercase font-bold tracking-[3px] text-luxury-gold mb-10">Protected Gallery Access</p>
                  
                  <form onSubmit={handleUnlock} className="space-y-6 relative z-10">
                      <div className="relative group">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-luxury-gold transition-colors" size={16} />
                          <input 
                              type="password"
                              placeholder="Enter Access Code"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-white/50 border border-white/80 rounded-full py-4 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-luxury-gold/5 focus:border-luxury-gold/20 transition-all font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal text-stone-800"
                          />
                      </div>
                      
                      {error && (
                          <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest animate-shake">
                              {error}
                          </p>
                      )}
                      
                      <button 
                          type="submit"
                          disabled={verifying}
                          className="btn-luxury-primary w-full flex items-center justify-center gap-3 py-4 shadow-xl shadow-luxury-gold/20"
                      >
                          {verifying ? (
                              <Loader2 className="animate-spin" size={18} />
                          ) : (
                              <>
                                  <span>Authorize Access</span>
                                  <ArrowRight size={16} />
                              </>
                          )}
                      </button>
                      
                      <p className="text-[9px] text-stone-400 font-medium uppercase tracking-[2px] pt-4">
                          Provided by Studio Concierge
                      </p>
                  </form>
              </div>
            </div>
          </>
        ) : view === "events" ? (
          /* ========================================= */
          /* EVENT FOLDERS VIEW (Like Admin Dashboard) */
          /* ========================================= */
          <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-fade-up">
              <div className="space-y-1 text-left">
                <h1 className="text-4xl md:text-5xl uppercase tracking-[8px] font-light text-stone-800">Your Collections</h1>
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-luxury-gold ml-1">Event Repositories</p>
              </div>
            </header>

            {loadingEvents ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {[1,2,3,4].map(n => <div key={n} className="h-96 glass-card animate-pulse rounded-[32px] border border-white/60" />)}
              </div>
            ) : events.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {events.map((event, idx) => (
                  <motion.div
                    layout
                    key={event._id}
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
                      className="absolute inset-0 z-10 cursor-pointer" 
                      onClick={() => handleOpenEvent(event)}
                    />

                    {/* Full Image Background */}
                    <motion.img 
                      src={event.thumbnail || `https://source.unsplash.com/random/800x1200/?wedding,event`} 
                      alt={event.name}
                      whileHover={{ scale: 1.15 }}
                      transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                    />

                    {/* Gradient Overlays */}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-20" />

                    {/* Dynamic Text Content Overlay */}
                    <div className="absolute inset-0 p-8 flex flex-col justify-end z-30 pointer-events-none text-left">
                      <motion.div 
                        initial={false}
                        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 w-fit mb-4 group-hover:bg-luxury-gold/20 group-hover:border-luxury-gold/40 transition-all duration-500"
                      >
                        <span className="text-[10px] text-white/90 group-hover:text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                          <ImageIcon size={10} className="mb-0.5" />
                          Event Folder
                        </span>
                      </motion.div>

                      <h3 className="text-3xl font-bold text-white tracking-tight mb-2 group-hover:text-luxury-gold transition-colors duration-500">
                        {event.name}
                      </h3>

                      <div className="flex items-center gap-3 text-white/50 group-hover:text-white/80 transition-colors duration-500">
                        <Calendar size={12} className="shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest pt-0.5">
                          {new Date(event.eventDate).toLocaleDateString()}
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
                <div className="icon-wrapper mx-auto mb-8 animate-pulse shadow-luxury-gold/20">
                  <div className="relative">
                      <FolderOpen className="text-luxury-gold" size={24} />
                  </div>
                </div>
                <h3 className="text-2xl font-light mb-4 uppercase tracking-[4px] text-stone-800">Folders empty</h3>
                <p className="text-luxury-text-muted italic max-w-sm mx-auto text-sm leading-relaxed">
                  Your event collections will appear here once they are uploaded by our team.
                </p>
              </div>
            )}
            
            {/* Quick Links Footer */}
            <section className="mt-16 pt-16 border-t border-black/[0.03] grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-up">
                <Link to="/portal/cloud" className="glass-card hover-lift flex items-center gap-6 group">
                    <div className="icon-wrapper group-hover:scale-110 transition-transform">
                        <Lock size={20} className="text-luxury-gold" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-stone-800 mb-1">Access The Vault</h4>
                        <p className="text-[10px] text-luxury-text-muted italic">Download your high-resolution masters.</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                </Link>

                <Link to="/portal/chats" className="glass-card hover-lift flex items-center gap-6 group">
                    <div className="icon-wrapper group-hover:scale-110 transition-transform">
                        <Sparkles size={20} className="text-luxury-gold" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-stone-800 mb-1">Studio Concierge</h4>
                        <p className="text-[10px] text-luxury-text-muted italic">Discuss your collection with our team.</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                </Link>
            </section>
          </>
        ) : (
          /* ========================================= */
          /* MASONRY GALLERY VIEW (Like Admin details) */
          /* ========================================= */
          <div className="animate-in slide-in-from-right-8 duration-700 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
              <div className="space-y-4 text-left">
                <button 
                  onClick={() => setView("events")}
                  className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.3em] text-[#8a8a8a] hover:text-luxury-gold transition-all group"
                >
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  Back to Folders
                </button>
                <div className="space-y-1">
                  <h1 className="text-4xl md:text-5xl uppercase tracking-[8px] font-light text-stone-800">{selectedEvent?.name}</h1>
                  <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-luxury-gold ml-1">Event Collection</p>
                </div>
              </div>

              {/* Toolbar Integration */}
              <div className="flex flex-col lg:flex-row gap-4 items-center w-full lg:w-auto">
                <div className="flex bg-white/60 p-1.5 rounded-2xl border border-white/80 shadow-sm w-full lg:w-auto overflow-x-auto">
                  {["all", "images", "videos", "recent"].map(type => (
                    <button 
                      key={type} onClick={() => setFilterType(type)}
                      className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filterType === type ? 'bg-gradient-to-r from-luxury-gold/20 to-luxury-gold/40 text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="relative w-full lg:w-64 group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input 
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assets..."
                    className="w-full bg-white/50 border border-white/80 rounded-full py-3.5 pl-12 pr-4 text-xs focus:outline-none focus:ring-4 focus:ring-luxury-gold/5 focus:border-luxury-gold/20 transition-all placeholder:text-stone-400"
                  />
                </div>
              </div>
            </div>

            {loadingFiles ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {[1,2,3,4,5,6,7,8,9,10].map(n => <div key={n} className="aspect-square glass-card animate-pulse rounded-[32px] border border-white/60" />)}
              </div>
            ) : filteredFiles.length > 0 ? (
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
                    layoutId={file.id}
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.4, 
                      ease: [0.23, 1, 0.32, 1],
                      delay: idx * 0.03 
                    }}
                    whileHover={{ scale: 1.03, zIndex: 10 }}
                    onClick={() => setSelectedMedia(file)}
                    className="relative group cursor-pointer overflow-hidden transition-all duration-500 rounded-2xl glass-card !p-0 shadow-lg"
                  >
                    <div className="w-full h-full relative overflow-hidden rounded-2xl">
                        <motion.img 
                          src={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/proxy/${file.id}?thumbnail=true`} 
                          alt={file.name} 
                          loading="eager" 
                          onLoad={() => setImagesLoaded(prev => prev + 1)}
                          className="w-full h-auto block object-cover" 
                          onError={(e) => {
                            const currentSrc = e.target.src;
                            if (!currentSrc.includes('fallback=true')) {
                              e.target.src = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/proxy/${file.id}?thumbnail=false&fallback=true`;
                            } else {
                              setImagesLoaded(prev => prev + 1);
                            }
                          }}
                        />
                        
                        {/* Type Icon (Video/Image) */}
                        {file.mimeType?.startsWith('video/') && (
                           <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full z-10 text-white">
                                <Play size={16} fill="currentColor" />
                           </div>
                        )}

                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                             <Maximize2 size={24} strokeWidth={1.5} />
                          </div>
                        </div>
                    </div>
                  </motion.div>
                ))}
              </Masonry>
            ) : (
              <div className="glass-card !p-20 text-center animate-fade-up">
                <div className="icon-wrapper mx-auto mb-8 animate-pulse shadow-luxury-gold/20">
                  <div className="relative">
                      <Box className="text-luxury-gold" size={24} />
                  </div>
                </div>
                <h3 className="text-2xl font-light mb-4 uppercase tracking-[4px] text-stone-800">No media found</h3>
                <p className="text-luxury-text-muted italic max-w-sm mx-auto text-sm leading-relaxed">
                  Try adjusting your search or filter.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedMedia && (
        <div className="modal-backdrop" onClick={() => setSelectedMedia(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={() => setSelectedMedia(null)}
                    className="absolute -top-12 right-0 text-white hover:text-luxury-gold transition-colors p-2"
                >
                    <X size={32} />
                </button>
                
                {selectedMedia.mimeType?.startsWith('video/') ? (
                    <iframe 
                        src={`https://drive.google.com/file/d/${selectedMedia.id}/preview`}
                        className="modal-media shadow-2xl rounded-lg w-full max-w-4xl h-[70vh] border-0"
                        allow="autoplay"
                    />
                ) : (
                    <img 
                        src={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/proxy/${selectedMedia.id}?thumbnail=true`} 
                        className="modal-media shadow-2xl rounded-lg" 
                        alt="Memory preview"
                        onError={(e) => { 
                            if (!e.target.src.includes('thumbnail=false')) {
                                e.target.src = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/drive-gallery/proxy/${selectedMedia.id}?thumbnail=false`; 
                            }
                        }}
                    />
                )}

                <div className="mt-8 flex gap-6">
                    <button
                        className="btn-luxury-primary flex items-center gap-2 px-8 py-3"
                        onClick={() => downloadMedia(selectedMedia.id, selectedMedia.name)}
                    >
                        <Download size={20} /> Download Master
                    </button>
                    <button 
                        className="btn-glass-secondary !text-white !border-white/20 hover:!bg-white/10 px-8 py-3"
                        onClick={() => setSelectedMedia(null)}
                    >
                        Back to Gallery
                    </button>
                </div>
            </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
            .modal-backdrop {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                animation: fadeIn 0.4s ease;
            }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            .modal-content {
                position: relative;
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .modal-media {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 12px;
            }
        `}} />
    </div>
  );
}
