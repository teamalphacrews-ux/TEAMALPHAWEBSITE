import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { Upload, Star, ChevronDown, Image as ImageIcon, Plus, CheckCircle2, SlidersHorizontal, Grid3X3, Maximize2, Download, X, Share2, Heart, Folder, ChevronRight, FolderPlus, Trash2, Edit3, Check } from "lucide-react";
import toast from "react-hot-toast";


const CATEGORIES = ["Wedding", "Engagement", "Pre-wedding", "Haldi", "Reception", "Sangeeth", "Other"];

export default function SmartGallery() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [galleryItems, setGalleryItems] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('masonry');
  const [lightboxItem, setLightboxItem] = useState(null);

  // Folder navigation state
  const [activeClientFolder, setActiveClientFolder] = useState(null);
  const [activeEventFolder, setActiveEventFolder] = useState(null);
  const [activeDrive, setActiveDrive] = useState(null);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const { setIsFocusMode } = useOutletContext();
  const [editingClient, setEditingClient] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [editingEvent, setEditingEvent] = useState(null);
  const [newEventName, setNewEventName] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [newItemTitle, setNewItemTitle] = useState("");

  // Focus mode toggle to hide topbar when modal is active
  useEffect(() => {
    if (setIsFocusMode) {
        setIsFocusMode(showUploadForm);
    }
    
    if (showUploadForm) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
    
    return () => {
        if (setIsFocusMode) setIsFocusMode(false);
        document.body.style.overflow = 'auto';
    };
  }, [showUploadForm, setIsFocusMode]);

  // Upload Form State
  const [selectedType, setSelectedType] = useState("Image"); // "Image", "Video", "Drive Link", "Image Link"
  const [uploadFiles, setUploadFiles] = useState([]);
  const [driveUrl, setDriveUrl] = useState("");
  const [imageUrl, setImageUrl] = useState(""); // Support direct URL upload
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/gallery`, authHeader);
      
      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        setGalleryItems(response.data);
        const favs = new Set(response.data.filter(item => item.isFavorite).map(item => item._id));
        setFavorites(favs);
      } else {
        setGalleryItems([]);
      }
    } catch (err) {
      // API error or Network Error, gracefully show empty gallery instead of breaking React render
      setGalleryItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (id, e) => {
    e?.stopPropagation();
    const newFavs = new Set(favorites);
    if (newFavs.has(id)) newFavs.delete(id);
    else newFavs.add(id);
    setFavorites(newFavs);
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/gallery/${id}/favorite`, {}, authHeader);
    } catch (err) { /* ignore */ }
  };

  const downloadItem = (url, e) => {
    e?.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Alpha_Gallery_Asset';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteItem = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this asset?")) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/gallery/${id}`, authHeader);
      setGalleryItems(prev => prev.filter(item => item._id !== id));
      if (lightboxItem?._id === id) setLightboxItem(null);
      toast.success("Asset deleted successfully!");
    } catch (err) {
      
      toast.error("Failed to delete asset.");
    }
  };

  const submitUpload = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setUploadProgress("Preparing upload...");
    const formData = new FormData(e.target);
    const newClientFolder = formData.get('newClientFolder');
    const clientFolderSelect = formData.get('clientFolderSelect');
    const clientFolder = newClientFolder ? newClientFolder.trim() : (clientFolderSelect && clientFolderSelect !== "Select a client..." ? clientFolderSelect : 'Uncategorized');
    const category = formData.get('category') || 'Wedding';
    const generatedTitle = `${clientFolder} - ${category} Moment`;

    const typeMapping = { 'Image': 'image', 'Video': 'video', 'Drive Link': 'drive', 'Image Link': 'image' };
    const type = typeMapping[selectedType];

    try {
      if (selectedType === 'Image' || selectedType === 'Video') {
        if (!uploadFiles || uploadFiles.length === 0) {
          setSubmitting(false);
          setUploadProgress("");
          return toast.error(`Please select at least one ${selectedType}.`);
        }

        const filesArray = Array.from(uploadFiles);
        const total = filesArray.length;
        let uploadedCount = 0;
        const newItems = [];

        // Parallel upload for maximum speed
        setUploadProgress(`Uploading 0 of ${total} files...`);

        await Promise.all(filesArray.map(async (file, i) => {
          const fileData = new FormData();
          fileData.append("file", file);

          try {
            const res = await axios.post(`${API}/api/gallery/upload`, fileData, authHeader);
            const payload = {
              title: total > 1 ? `${generatedTitle} ${i + 1}` : generatedTitle,
              albumName: generatedTitle,
              clientFolder,
              url: res.data.url,
              category,
              type,
              driveName: formData.get('driveName') || null
            };
            const itemRes = await axios.post(`${API}/api/gallery`, payload, authHeader);
            newItems.push(itemRes.data);
            uploadedCount++;
            setUploadProgress(`Uploaded ${uploadedCount} of ${total} files...`);
          } catch (err) {
            const backendError = err.response?.data?.error || err.message;
            
            toast.error(`File ${i + 1} Error: ${backendError}`);
          }
        }));

        if (newItems.length > 0) {
          setGalleryItems(prev => [...newItems, ...prev]);
          toast.success(`Successfully added ${newItems.length} items to the gallery!`);
        } else {
          toast.error("Failed to upload the items.");
        }
      } else if (selectedType === 'Drive Link') {
        if (!uploadFiles || uploadFiles.length === 0 || !driveUrl) {
          setSubmitting(false);
          setUploadProgress("");
          return toast.error("Please provide a Drive link and a cover photo.");
        }
        setUploadProgress("Uploading Drive Cover...");
        const fileData = new FormData();
        fileData.append("file", uploadFiles[0]);
        // Handle potential rejection softly via a robust try block to not freeze UI
        let finalUrl = "";
        try {
          const res = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/gallery/upload`, fileData, authHeader);
          finalUrl = res.data.url;
        } catch (err) {
          const backendError = err.response?.data?.error || err.message;
          
          setSubmitting(false);
          setUploadProgress("");
          return toast.error(`Upload Error: ${backendError}`);
        }

        const payload = {
          title: generatedTitle,
          albumName: generatedTitle,
          clientFolder,
          url: finalUrl,
          category,
          type,
          link: driveUrl
        };
        const itemRes = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/gallery`, payload, authHeader);
        setGalleryItems(prev => [itemRes.data, ...prev]);
        toast.success("Successfully added Drive folder!");

      } else if (selectedType === 'Image Link') {
        if (!imageUrl) {
          setSubmitting(false);
          setUploadProgress("");
          return toast.error("Please provide a valid Cloudinary/Image URL.");
        }
        setUploadProgress("Saving image link...");
        const payload = {
          title: generatedTitle,
          albumName: generatedTitle,
          clientFolder,
          url: imageUrl,
          category,
          type
        };
        const itemRes = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/gallery`, payload, authHeader);
        setGalleryItems(prev => [itemRes.data, ...prev]);
        toast.success("Successfully added Image Link to gallery!");
      }

      setShowUploadForm(false);
      setUploadFiles([]);
      setDriveUrl("");
      setImageUrl("");
    } catch (err) {
      
      toast.error("An error occurred during submission.");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  };

  const handleSetCover = async (id, e) => {
    e?.stopPropagation();
    try {
      const res = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/gallery/${id}/cover`, {}, authHeader);
      setGalleryItems(prev => prev.map(item => {
        if (item._id === id) return { ...item, isCover: true };
        if (item.clientFolder === res.data.item.clientFolder && item.category === res.data.item.category) return { ...item, isCover: false };
        return item;
      }));
      toast.success("Set as Folder Cover Successfully!");
    } catch (err) {
      
      toast.error("Failed to set cover");
    }
  };

  const handleRenameClient = async (oldName) => {
    if (!newClientName.trim() || newClientName === oldName) return setEditingClient(null);
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/gallery/rename-folder`, { oldName, newName: newClientName }, authHeader);
      setGalleryItems(prev => prev.map(item => (item.clientFolder || 'Default Client') === oldName ? { ...item, clientFolder: newClientName } : item));
      setEditingClient(null);
      setNewClientName("");
      toast.success("Folder renamed successfully!");
    } catch (err) {
      
      toast.error("Failed to rename folder.");
    }
  };

  const handleRenameEvent = async (oldCategory) => {
    if (!newEventName.trim() || newEventName === oldCategory) return setEditingEvent(null);
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/gallery/rename-category`, {
        clientFolder: activeClientFolder,
        oldCategory,
        newCategory: newEventName
      }, authHeader);
      setGalleryItems(prev => prev.map(item =>
        (item.clientFolder || 'Default Client') === activeClientFolder && item.category === oldCategory
          ? { ...item, category: newEventName }
          : item
      ));
      setEditingEvent(null);
      setNewEventName("");
      toast.success("Event folder renamed!");
    } catch (err) {
      
      toast.error("Failed to rename event category.");
    }
  };

  const handleUpdateTitle = async (id, oldTitle) => {
    if (!newItemTitle.trim() || newItemTitle === oldTitle) return setEditingItemId(null);
    try {
      const res = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/gallery/${id}`, { title: newItemTitle }, authHeader);
      setGalleryItems(prev => prev.map(item => item._id === id ? res.data : item));
      setEditingItemId(null);
      setNewItemTitle("");
      toast.success("Title updated!");
    } catch (err) {
      
      toast.error("Failed to update title.");
    }
  };

  const handleDeleteClient = async (clientName) => {
    if (!window.confirm(`Are you sure you want to delete the folder "${clientName}" and ALL its media?`)) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/gallery/folder/${encodeURIComponent(clientName)}`, authHeader);
      setGalleryItems(prev => prev.filter(i => (i.clientFolder || 'Default Client') !== clientName));
      toast.success("Folder deleted successfully!");
      setEditingClient(null);
    } catch (err) {
      
      toast.error("Failed to delete folder.");
    }
  };

  const handleDeleteEvent = async (eventName) => {
    if (!window.confirm(`Are you sure you want to delete the event "${eventName}" and ALL its media?`)) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/gallery/folder/${encodeURIComponent(activeClientFolder)}/category/${encodeURIComponent(eventName)}`, authHeader);
      setGalleryItems(prev => prev.filter(i => !((i.clientFolder || 'Default Client') === activeClientFolder && i.category === eventName)));
      toast.success("Event folder deleted!");
      setEditingEvent(null);
    } catch (err) {
      
      toast.error("Failed to delete event folder.");
    }
  };

  // Derive Client Folders
  const clientFolders = [...new Set(galleryItems.map(item => item.clientFolder || 'Default Client'))];

  // Derive Event Folders for Active Client
  const itemsForActiveClient = galleryItems.filter(item => (item.clientFolder || 'Default Client') === activeClientFolder);
  const eventFolders = [...new Set(itemsForActiveClient.map(item => item.category || 'Other'))];

  // Final Media to show
  const filteredItems = itemsForActiveClient.filter(item => item.category === activeEventFolder);

  // Grouping Logic for "Drives" and "Photos" at SAME LEVEL
  const driveNames = [...new Set(filteredItems.filter(item => item.driveName).map(item => item.driveName))];
  const directDrives = filteredItems.filter(item => item.type === 'drive');
  const driveFolders = driveNames.map(name => ({
    name,
    type: 'folder',
    items: filteredItems.filter(item => item.driveName === name)
  }));

  const displayPhotos = activeDrive 
    ? filteredItems.filter(item => item.driveName === activeDrive)
    : filteredItems.filter(item => !item.driveName && item.type !== 'drive');

  const displayDrives = [...driveFolders, ...directDrives];
  const allMediaItems = [...displayDrives, ...displayPhotos];

  return (
    <div className="space-y-8 md:space-y-12 text-charcoal px-4 md:px-0 pb-20 mt-4 animate-in fade-in duration-1500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in slide-in-from-top-8 fade-in duration-1000 fill-mode-forwards">
        <div>
          <h1 className="font-serif text-3xl md:text-5xl animate-gentle-fade">Smart Gallery</h1>
          <p className="text-[10px] md:text-xs text-warmgray mt-3 font-bold uppercase tracking-[0.4em]">Organized Client Folders</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button onClick={() => setShowUploadForm(true)} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-charcoal text-white px-6 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95">
            <Upload size={18} />
            Upload Media
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-3 text-sm text-warmgray font-medium animate-in fade-in slide-in-from-left-4 duration-700 delay-200" style={{ animationFillMode: 'backwards' }}>
        <span className="cursor-pointer hover:text-charcoal transition-colors" onClick={() => { setActiveClientFolder(null); setActiveEventFolder(null); setActiveDrive(null); }}>Gallery</span>
        {activeClientFolder && (
          <>
            <ChevronRight size={16} />
            <span className="cursor-pointer hover:text-charcoal transition-colors" onClick={() => { setActiveEventFolder(null); setActiveDrive(null); }}>{activeClientFolder}</span>
          </>
        )}
        {activeEventFolder && (
          <>
            <ChevronRight size={16} />
            <span className="cursor-pointer hover:text-charcoal transition-colors" onClick={() => setActiveDrive(null)}>{activeEventFolder}</span>
          </>
        )}
        {activeDrive && (
          <>
            <ChevronRight size={16} />
            <span className="text-charcoal">{activeDrive}</span>
          </>
        )}
      </div>

      {showUploadForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-[100] flex items-start md:items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-500">
          <div className="bg-[#1a1c1e]/95 backdrop-blur-lg w-full max-w-xl rounded-[28px] border border-white/10 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500 relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Glow */}
            <div className="absolute top-0 inset-x-0 h-40 bg-linear-to-b from-white/5 to-transparent pointer-events-none z-0" />

            <div className="sticky top-0 sticky-header flex justify-between items-center px-8 md:px-10 py-8 relative z-20 bg-inherit backdrop-blur-md border-b border-white/5">
              <h3 className="font-serif text-3xl text-white tracking-tight">Upload Media</h3>
              <button type="button" onClick={() => setShowUploadForm(false)} className="p-2.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all transform hover:rotate-90">
                <X size={26} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 md:px-10 pb-10 scrollbar-hide pt-6">
              <form onSubmit={submitUpload} className="space-y-8 relative z-10">

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Client Folder</label>
                  <select name="clientFolderSelect" defaultValue={activeClientFolder || ""} className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white focus:bg-white/10 transition-all appearance-none cursor-pointer">
                    <option value="" disabled className="bg-charcoal text-white">Select a client...</option>
                    {clientFolders.filter(c => c !== 'Default Client').map(c => <option key={c} value={c} className="bg-charcoal text-white">{c}</option>)}
                  </select>
                  <input type="text" name="newClientFolder" placeholder="Or type new client name..." className="w-full mt-3 bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white focus:bg-white/10 transition-all" />
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Event Category</label>
                  <select name="category" defaultValue={activeEventFolder || CATEGORIES[0]} className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white focus:bg-white/10 transition-all appearance-none cursor-pointer">
                    {CATEGORIES.map(c => <option key={c} className="bg-charcoal text-white">{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Asset Type</label>
                <div className="flex gap-2 p-1.5 bg-white/5 rounded-full border border-white/10 overflow-x-auto scrollbar-hide">
                  {['Image', 'Video', 'Drive Link', 'Image Link'].map((assetType) => (
                    <label key={assetType} className={`flex-1 min-w-[100px] flex gap-2 items-center justify-center py-3 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all duration-300 ${selectedType === assetType ? 'bg-white text-charcoal shadow-xl scale-[1.03]' : 'text-white/40 hover:text-white hover:bg-white/10 hover:scale-[1.02]'}`}>
                      <input type="radio" name="mediaType" value={assetType} className="hidden" checked={selectedType === assetType} onChange={() => setSelectedType(assetType)} />
                      {assetType}
                    </label>
                  ))}
                </div>
              </div>

              {(selectedType === 'Image' || selectedType === 'Video') && (
                <div className="space-y-2.5">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Assign to Drive (Optional)</label>
                  <input type="text" name="driveName" placeholder="e.g. Ceremony, Reception..." className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white transition-all" />
                </div>
              )}

              {selectedType === 'Drive Link' ? (
                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Google Drive Folder/Shared Link</label>
                    <input type="url" required value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white transition-all" />
                    <p className="text-[10px] text-white/40 italic ml-1">Paste a shareable Google Drive link for this collection.</p>
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Upload Cover Photo</label>
                    <input type="file" accept="image/*" onChange={(e) => setUploadFiles(e.target.files)} required className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none file:mr-6 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-white file:text-charcoal file:cursor-pointer hover:file:bg-white/90" />
                  </div>
                </div>
              ) : selectedType === 'Image Link' ? (
                <div className="space-y-2.5">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Direct Cloudinary / Web URL</label>
                  <input type="url" required value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://res.cloudinary.com/..." className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white transition-all" />
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in duration-500">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 ml-1">Select {selectedType}s (Multiple Allowed)</label>
                  <label className="block w-full border-2 border-dashed border-white/20 rounded-[28px] p-12 hover:bg-white/5 hover:border-white transition-all text-center group">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-white/10 group-hover:scale-110 group-hover:bg-white/10 group-hover:border-white/30 transition-all duration-500">
                      <Upload size={28} className="text-white opacity-40 group-hover:opacity-100" />
                    </div>
                    <span className="text-white font-medium text-lg block mb-1.5">{uploadFiles && uploadFiles.length > 0 ? `${uploadFiles.length} file(s) selected` : 'Click to Browse Files'}</span>
                    <span className="text-[10px] text-white/40 tracking-[0.2em] uppercase block">Upload high-res moments instantly</span>
                    <input type="file" accept={selectedType === 'Video' ? "video/*" : "image/*"} multiple onChange={(e) => setUploadFiles(e.target.files)} required className="hidden" />
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="relative w-full bg-white text-charcoal py-5 rounded-2xl text-[12px] font-bold uppercase tracking-[0.4em] hover:bg-white hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden mt-6"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-4">
                    <span className="w-5 h-5 rounded-full border-3 border-charcoal/20 border-t-charcoal animate-spin"></span>
                    <span className="animate-pulse">{uploadProgress || "Curating Assets..."}</span>
                  </span>
                ) : (
                  "Finalize & Upload"
                )}
              </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar Removed as requested */}

      {/* LEVEL 1: Client Folders */}
      {!activeClientFolder && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {clientFolders.map((client, idx) => {
            const itemsForClient = galleryItems.filter(i => (i.clientFolder || 'Default Client') === client);
            const itemsCount = itemsForClient.length;
            const coverItem = itemsForClient.find(i => i.isCover) || itemsForClient.find(i => i.type !== 'video' && i.url) || itemsForClient[0];
            const coverUrl = coverItem && coverItem.type !== 'video' ? coverItem.url : null;
            const isEditing = editingClient === client;

            return (
              <div
                key={client}
                onClick={() => !isEditing && setActiveClientFolder(client)}
                className="group bg-white p-3 pb-6 rounded-sm border border-gray-200 shadow-md hover:shadow-2xl transition-all duration-700 cursor-pointer hover:-translate-y-2 flex flex-col relative animate-in fade-in slide-in-from-bottom-8"
                style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="w-full aspect-4/5 bg-gray-50 rounded-sm mb-4 relative overflow-hidden flex items-center justify-center">
                  {coverUrl ? (
                    <img src={coverUrl} alt={`${client} Cover`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                  ) : (
                    <Folder size={40} className="text-gray-300" strokeWidth={1} />
                  )}

                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur-sm rounded-full shadow-sm p-1">
                    {isEditing ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRenameClient(client); }}
                        className="p-1.5 bg-charcoal text-white rounded-full hover:bg-mutedbrown transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingClient(client); setNewClientName(client); }}
                        className="p-1.5 text-warmgray hover:text-charcoal hover:bg-gray-100 rounded-full transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClient(client); }}
                      className="p-1.5 text-warmgray hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="text-center px-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm font-serif mb-1 outline-none text-center"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameClient(client)}
                    />
                  ) : (
                    <h3 className="font-serif xl:text-xl text-lg mb-1 truncate text-charcoal">{client}</h3>
                  )}
                  <p className="text-[10px] text-warmgray font-medium uppercase tracking-[0.2em]">{itemsCount} Moments</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEVEL 2: Event Folders */}
      {activeClientFolder && !activeEventFolder && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {eventFolders.map((event, idx) => {
            const eventItems = itemsForActiveClient.filter(i => i.category === event);
            const itemsCount = eventItems.length;
            const coverItem = eventItems.find(i => i.isCover) || eventItems.find(i => i.type !== 'video' && i.url) || eventItems[0];
            const coverUrl = coverItem && coverItem.type !== 'video' ? coverItem.url : null;
            const isEditing = editingEvent === event;

            return (
              <div
                key={event}
                onClick={() => !isEditing && setActiveEventFolder(event)}
                className="group bg-white p-3 pb-6 rounded-sm border border-gray-200 shadow-md hover:shadow-2xl transition-all duration-700 cursor-pointer hover:-translate-y-2 flex flex-col relative animate-in fade-in slide-in-from-bottom-8"
                style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="w-full aspect-4/5 bg-gray-50 rounded-sm mb-4 relative overflow-hidden flex items-center justify-center">
                  {coverUrl ? (
                    <img src={coverUrl} alt={`${event} Cover`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                  ) : (
                    <FolderPlus size={40} className="text-gray-300" strokeWidth={1} />
                  )}

                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur-sm rounded-full shadow-sm p-1">
                    {isEditing ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRenameEvent(event); }}
                        className="p-1.5 bg-charcoal text-white rounded-full hover:bg-mutedbrown transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setNewEventName(event); }}
                        className="p-1.5 text-warmgray hover:text-charcoal hover:bg-gray-100 rounded-full transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event); }}
                      className="p-1.5 text-warmgray hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="text-center px-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm font-serif mb-1 outline-none text-center"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameEvent(event)}
                    />
                  ) : (
                    <h3 className="font-serif xl:text-xl text-lg mb-1 truncate text-charcoal">{event}</h3>
                  )}
                  <p className="text-[10px] text-warmgray font-medium uppercase tracking-[0.2em]">{itemsCount} Moments</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEVEL 3: Unified Media & Drives Grid */}
      {activeClientFolder && activeEventFolder && (
        <div className="space-y-12">
          <div className="space-y-6">
            <h4 className="text-[10px] uppercase font-bold tracking-[0.3em] text-warmgray border-b border-ivory pb-2">
              {activeDrive ? `Inside Drive: ${activeDrive}` : "Collection Highlights"}
            </h4>
            <div className={`min-h-[30vh] ${viewMode === 'masonry' ? 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
              {allMediaItems.map((item, idx) => {
                const id = item._id || idx;
                const isFav = favorites.has(id);
                const isVideo = item.type === 'video';
                const isDrive = item.type === 'drive' || item.type === 'folder';
                const itemUrl = item.url || (item.items?.[0]?.url); // Use folder's first image if group

                return (
                  <div
                    key={id}
                    className="group relative bg-white rounded-3xl overflow-hidden border border-ivory/50 shadow-sm hover:shadow-2xl transition-all duration-700 hover:-translate-y-2 cursor-pointer break-inside-avoid animate-in fade-in slide-in-from-bottom-8 mb-6"
                    style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
                    onClick={() => {
                      if (item.type === 'folder') return setActiveDrive(item.name);
                      if (item.type === 'drive') return window.open(item.link || item.url, '_blank');
                      setLightboxItem(item);
                    }}
                  >
                    <div className="w-full h-full relative overflow-hidden">
                      {isVideo ? (
                        <video src={itemUrl} className="w-full h-auto block group-hover:scale-105 transition-transform duration-3000 ease-out" muted loop onMouseOver={e => e.target.play()} onMouseOut={e => e.target.pause()} />
                      ) : (
                        <img
                          src={itemUrl}
                          alt={item.title || item.name || "Gallery"}
                          className="w-full h-auto bg-gray-50 object-contain block group-hover:scale-105 group-hover:blur-[2px] transition-all duration-3000 ease-out"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {/* Unified Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-charcoal/90 via-charcoal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                      
                      {/* Stealth Drive Badge - ONLY ON HOVER */}
                      {isDrive && (
                        <div className="absolute top-6 left-6 bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 transform -translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          <Share2 size={12} />
                          Drive Access
                        </div>
                      )}

                      <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <h3 className="text-white font-serif text-lg truncate mb-1">{item.title || item.name || "Gallery Moment"}</h3>
                        <div className="flex items-center justify-between mt-3 text-white/50 text-[9px] font-bold uppercase tracking-widest">
                           <span>{isDrive ? "Open Collection" : "View Photo"}</span>
                           <div className="flex gap-2">
                             {!isDrive && (
                               <button onClick={(e) => toggleFavorite(id, e)} className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${isFav ? 'bg-white/20 border-gold/50 text-gold' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
                                 <Heart size={15} fill={isFav ? "currentColor" : "none"} />
                               </button>
                             )}
                             <button onClick={(e) => { e.stopPropagation(); if (isDrive) window.open(item.link || item.url, '_blank'); else downloadItem(itemUrl, e); }} className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md hover:bg-white hover:text-charcoal transition-all">
                                 {isDrive ? <Share2 size={15} /> : <Download size={15} />}
                             </button>
                             <button onClick={(e) => deleteItem(id, e)} className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md hover:bg-red-500 hover:border-red-500 hover:text-white transition-all">
                               <Trash2 size={15} />
                             </button>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {allMediaItems.length === 0 && (
               <div className="py-20 text-center text-warmgray italic">This collection is currently empty.</div>
            )}
          </div>
        </div>
      )}

      {/* Empty State for Media */}
      {activeClientFolder && activeEventFolder && filteredItems.length === 0 && (
        <div className="py-24 text-center flex flex-col items-center opacity-70 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <ImageIcon size={56} className="text-warmgray mb-6 animate-float" strokeWidth={1} />
          <p className="font-serif text-2xl text-warmgray mb-2 animate-gentle-fade">Awaiting the moments...</p>
          <p className="text-xs text-warmgray uppercase tracking-[0.2em] font-medium">No media found in {activeEventFolder}</p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxItem && (
        <div className="fixed inset-0 z-100 bg-charcoal/95 backdrop-blur-2xl animate-in fade-in duration-500 flex items-center justify-center p-4">
          <button onClick={() => setLightboxItem(null)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-all transform hover:rotate-90 hover:scale-110 duration-500 p-2 z-10">
            <X size={32} strokeWidth={1} />
          </button>
          <div className="w-full max-w-7xl max-h-[90vh] flex flex-col items-center">
            {lightboxItem.type === 'video' ? (
              <video src={lightboxItem.url} controls autoPlay className="max-h-[85vh] w-auto rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-700 ease-out" />
            ) : lightboxItem.type === 'drive' ? (
              <div className="flex flex-col items-center justify-center p-16 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md text-center max-w-lg mb-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
                <Folder size={72} className="text-gold mb-8 animate-breathe shadow-gold" strokeWidth={1} />
                <h3 className="font-serif text-4xl text-white mb-3">{lightboxItem.title || "Google Drive Collection"}</h3>
                <p className="text-white/50 text-sm mb-10 tracking-wide font-light">This is an external Drive Link containing high-resolution assets.</p>
                <div className="bg-white/5 hover:bg-white/10 transition-colors px-8 py-5 rounded-2xl border border-white/20">
                  <p className="text-xs text-white uppercase tracking-[0.3em] font-bold flex items-center gap-4">
                    Open to navigate folders
                    <ChevronDown size={18} className="text-gold animate-bounce" />
                  </p>
                </div>
              </div>
            ) : (
              <img src={lightboxItem.url} className="max-h-[85vh] w-auto object-contain rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.5)] animate-in zoom-in-[0.98] fade-in duration-1000 ease-out" alt="Full view" />
            )}

            <div className="mt-8 flex items-center gap-6">
              {lightboxItem.type === 'drive' ? (
                <button onClick={() => window.open(lightboxItem.link || lightboxItem.url, '_blank')} className="flex items-center gap-3 bg-white text-charcoal px-8 py-4 rounded-full hover:bg-gold hover:text-white transition-all shadow-xl hover:-translate-y-1">
                  <Share2 size={20} />
                  <span className="text-xs font-bold uppercase tracking-widest">Open in Google Drive</span>
                </button>
              ) : (
                <button onClick={() => downloadItem(lightboxItem.url)} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                  <Download size={20} />
                  <span className="text-xs font-bold uppercase tracking-widest">Download Original</span>
                </button>
              )}

              {/* Delete inside Lightbox */}
              {lightboxItem._id && (
                <button onClick={(e) => deleteItem(lightboxItem._id, e)} className="flex items-center gap-2 text-white/50 hover:text-red-500 transition-colors ml-4 border-l border-white/20 pl-6">
                  <Trash2 size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Delete Asset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
