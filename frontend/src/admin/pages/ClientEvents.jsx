import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Calendar, MoreVertical, Loader2, ArrowLeft, Image as ImageIcon, ChevronRight, Pencil, Trash2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Components
import CreateEventModal from "../components/gallery/CreateEventModal";
import EditEventModal from "../components/gallery/EditEventModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function ClientEvents() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    fetchClientAndEvents();
  }, [clientId]);

  const fetchClientAndEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch Client Info
      const clientRes = await axios.get(`${API_BASE_URL}/api/drive-gallery/${clientId}`, {
        headers: { 'x-auth-token': token }
      });
      setClient(clientRes.data);

      // Fetch Events
      const eventsRes = await axios.get(`${API_BASE_URL}/api/drive-gallery/${clientId}/events`, {
        headers: { 'x-auth-token': token }
      });
      setEvents(eventsRes.data);
    } catch (err) {
      toast.error("Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (e, eventId) => {
    e.stopPropagation();
    if (!window.confirm("Remove this event?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/drive-gallery/events/${eventId}`, {
        headers: { 'x-auth-token': token }
      });
      setEvents(prev => prev.filter(ev => ev._id !== eventId));
      toast.success("Event removed.");
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

  const handleEdit = (e, event) => {
    e.stopPropagation();
    setEditingEvent(event);
  };

  return (
    <div className="min-h-screen pb-20 animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/admin/gallery')}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8a8a8a] hover:text-[#2d2d2d] transition-all"
          >
            <ArrowLeft size={14} /> Back to Clients
          </button>
          <div className="space-y-1">
            <h1 className="page-title text-4xl text-[#2d2d2d]">{client?.name || "Client Events"}</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#cfe8d5] ml-1">Event Collections</p>
          </div>
        </div>

        <button 
          onClick={() => setIsCreateOpen(true)}
          className="add-btn flex items-center gap-3 px-8 py-4 shadow-xl shadow-[#cfe8d5]/40"
        >
          <Plus size={18} />
          <span className="text-xs font-bold uppercase tracking-widest text-[#2d2d2d]">Add New Event</span>
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1,2,3].map(n => <div key={n} className="h-80 bg-white/40 animate-pulse rounded-[40px] border border-white/60" />)}
        </div>
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
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
              onClick={() => navigate(`/admin/gallery/event/${event._id}`)}
              className="group relative aspect-[3.5/4.5] rounded-[32px] overflow-hidden bg-black shadow-2xl transition-all duration-500 cursor-pointer"
            >
              {/* Full Image Background */}
              <motion.img 
                src={event.thumbnail} 
                alt={event.name}
                whileHover={{ scale: 1.15 }}
                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
              />

              {/* Sophisticated Gradient Overlays */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

              {/* Glassmorphic Management Controls (appear on hover) */}
              <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 delay-100 z-50">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleEdit(e, event);
                  }}
                  className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-[#cfe8d5]/40 text-white rounded-2xl transition-all shadow-lg group/edit"
                  title="Edit Event"
                >
                  <Pencil size={16} className="group-hover/edit:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    deleteEvent(e, event._id);
                  }}
                  className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-red-500/40 text-white hover:text-red-200 rounded-2xl transition-all shadow-lg group/del"
                  title="Remove Event"
                >
                   <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                </button>
              </div>

              {/* Dynamic Text Content Overlay */}
              <div className="absolute inset-0 p-8 flex flex-col justify-end pointer-events-none z-30">
                <motion.div 
                  initial={false}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 w-fit mb-4 group-hover:bg-[#cfe8d5]/20 group-hover:border-[#cfe8d5]/40 transition-all duration-500"
                >
                  <span className="text-[10px] text-white/90 group-hover:text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <ImageIcon size={10} className="mb-0.5" />
                    Event Collection
                  </span>
                </motion.div>

                <h3 className="text-3xl font-bold text-white tracking-tight mb-2 group-hover:text-[#cfe8d5] transition-colors duration-500">
                  {event.name}
                </h3>

                <div className="flex items-center gap-3 text-white/50 group-hover:text-white/80 transition-colors duration-500">
                  <Calendar size={12} className="shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest pt-0.5">
                    {new Date(event.eventDate || event.createdAt).toLocaleDateString()}
                  </span>
                  <div className="h-px flex-1 bg-white/10 group-hover:bg-white/20 transition-all" />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-500" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-1000">
           <div className="avatar !w-20 !h-20 !rounded-[32px] mb-6 bg-linear-to-br from-[#cfe8d5] to-transparent flex items-center justify-center">
              <ImageIcon size={32} className="text-[#8a8a8a]" strokeWidth={1} />
           </div>
           <h3 className="page-title !text-xl text-[#8a8a8a]">No events found for this client.</h3>
           <p className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a8a] mt-2">Start by creating your first event</p>
        </div>
      )}

      {/* Event Form Modal */}
      <CreateEventModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)}
        clientId={clientId}
        onEventCreated={(newEvent) => {
          setEvents(prev => [newEvent, ...prev]);
        }}
      />

      <EditEventModal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        event={editingEvent}
        onSuccess={fetchClientAndEvents}
      />

    </div>
  );
}
