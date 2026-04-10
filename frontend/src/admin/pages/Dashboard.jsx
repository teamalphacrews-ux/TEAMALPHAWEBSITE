import { useState, useEffect } from "react";
import axios from "axios";
import StatCard from "../components/dashboard/StatCard";
import { TrendingUp, Users, ImageIcon, PieChart, ArrowUpRight, Clock, MapPin, MoreVertical, Trash2, Edit3, X } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { logout } = useAuth(); // Destructure logout from context
  const token = localStorage.getItem('token');
  const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
  const API = import.meta.env.VITE_API_URL || '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPhotos: 0,
    storageUsage: '0%',
    pendingApprovals: 0,
    traffic: '0'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [isSystemOnline, setIsSystemOnline] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    eventDate: "",
    eventType: ""
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/auth');
        
        const currentAuthHeader = { headers: { Authorization: `Bearer ${token}` } };
        
        const [statsRes, activityRes, eventsRes] = await Promise.all([
          axios.get(`${API}/api/dashboard/stats`, currentAuthHeader),
          axios.get(`${API}/api/dashboard/recent-activity`, currentAuthHeader),
          axios.get(`${API}/api/dashboard/upcoming-events`, currentAuthHeader)
        ]);

        if (isMounted) {
          setStats(statsRes.data);
          setRecentActivity(activityRes.data);
          setUpcomingEvents(eventsRes.data);
          setIsSystemOnline(true);
          setLoading(false);
        }
      } catch (err) {
        console.error("Dashboard error:", err);
        if (err.response?.status === 401) {
          logout(); // Use centralized logout to clear both Context and localStorage
          return;
        }
        if (isMounted) {
          setIsSystemOnline(false);
          setLoading(false); // Force show structure even on error
        }
      }
    };

    fetchData(); 
    const intervalId = setInterval(fetchData, 8000); // Efficient polling

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [navigate, API]);

  // DELETE FEATURE
  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentActivity(prev => prev.filter(item => item._id !== id));
      toast.success("Delivery deleted successfully");
      setShowDeleteModal(false);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete delivery");
    }
  };

  // EDIT FEATURE
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/api/leads/${selectedDelivery._id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state for immediate feedback
      setRecentActivity(prev => prev.map(item => 
        item._id === selectedDelivery._id 
          ? { 
              ...item, 
              name: `${editFormData.eventType || 'Event'} of ${editFormData.name}`,
              rawName: editFormData.name,
              rawType: editFormData.eventType,
              rawDate: editFormData.eventDate,
              date: new Date(editFormData.eventDate).toLocaleDateString()
            } 
          : item
      ));
      
      toast.success("Delivery updated successfully");
      setShowEditModal(false);
    } catch (err) {
      console.error("Edit error:", err);
      toast.error("Failed to update delivery");
    }
  };

  const openEditModal = (delivery) => {
    setSelectedDelivery(delivery);
    setEditFormData({
      name: delivery.rawName || "",
      eventDate: delivery.rawDate ? new Date(delivery.rawDate).toISOString().split('T')[0] : "",
      eventType: delivery.rawType || ""
    });
    setShowEditModal(true);
    setMenuOpenId(null);
  };

  const openDeleteModal = (delivery) => {
    setSelectedDelivery(delivery);
    setShowDeleteModal(true);
    setMenuOpenId(null);
  };

  return (
    <div className="space-y-6 md:space-y-10 w-full animate-fade-up">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-luxury text-4xl md:text-5xl text-[#2d2d2d] tracking-tight">Registry Overview</h1>
          <p className="text-[11px] md:text-[13px] text-[#7a7a7a] mt-3 font-medium uppercase tracking-[1px]">Team Alpha Luxury Photography Studio</p>
        </div>
        <div className={`flex items-center gap-3 bg-white/55 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/40 text-[10px] font-bold uppercase tracking-widest ${isSystemOnline ? 'text-[#7a7a7a]' : 'text-red-500'} shadow-sm transition-colors`}>
          <div className={`w-2 h-2 rounded-full ${isSystemOnline ? 'bg-[#CFE8D5] shadow-[0_0_8px_#CFE8D5]' : 'bg-red-500'} `}></div>
          {isSystemOnline ? 'Studio System Online' : 'System Offline (Check Server)'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="Clients & Smart Drives"
          value={stats.totalPhotos}
          icon={<Users size={20} />}
          delayClass="animate-stagger-1"
        />
        <StatCard
          title="Cloud Storage"
          value={stats.storageUsage}
          icon={<PieChart size={20} />}
          delayClass="animate-stagger-2"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<Clock size={20} />}
          delayClass="animate-stagger-3"
        />
        <StatCard
          title="Website Traffic"
          value={stats.traffic}
          icon={<Users size={20} />}
          delayClass="animate-stagger-4"
        />
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Latest Deliveries - Glass List */}
        <div className="xl:col-span-2 bg-white/55 backdrop-blur-[14px] rounded-[24px] p-6 md:p-10 border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.06)] animate-fade-up animate-stagger-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
            <h2 className="font-luxury text-2xl md:text-3xl text-[#2d2d2d]">Latest Deliveries</h2>
            <Link
              to="/admin/crm"
              className="text-[11px] font-bold uppercase tracking-widest text-[#7a7a7a] hover:text-[#2d2d2d] transition-all px-4 py-2 bg-white/40 rounded-full hover:bg-white/60"
            >
              All Registry Assets
            </Link>
          </div>

          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((session, i) => (
              <Link
                key={session._id || i}
                to="/admin/gallery"
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-[14px] hover:bg-white/50 transition-all duration-300 cursor-pointer hover:translate-x-1 group/item border border-transparent hover:border-white/50 block"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white/60 rounded-[12px] flex items-center justify-center text-[#6b6b6b] shadow-sm ring-1 ring-white/50">
                    <ImageIcon size={22} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#2d2d2d]">{session.name}</h4>
                    <p className="text-[11px] text-[#8c8c8c] mt-0.5 font-medium uppercase tracking-wider">{session.date} • {session.count}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <span className={`text-[11px] font-medium px-4 py-1.5 rounded-full ${session.status === 'Delivered' ? 'bg-[#f3e5c8] text-[#9c7a2a]' : 'bg-[#D9CDEB]/30 text-[#2d2d2d]'}`}>
                    {session.status}
                  </span>
                  
                  {/* EDIT & DELETE MENU */}
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === session._id ? null : session._id);
                      }}
                      className="w-9 h-9 flex items-center justify-center bg-white/40 rounded-full text-[#5f5f5f] hover:bg-white hover:text-[#2d2d2d] hover:shadow-md transition-all"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {menuOpenId === session._id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl border border-white/40 rounded-[16px] shadow-xl z-[100] overflow-hidden animate-in fade-in zoom-in duration-200">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEditModal(session);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-semibold text-[#2d2d2d] hover:bg-[#F7F5F2] transition-colors border-b border-[#F7F5F2]"
                        >
                          <Edit3 size={16} className="text-[#9c7a2a]" />
                          Edit Delivery
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openDeleteModal(session);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-semibold text-red-500 hover:bg-red-50/50 transition-colors"
                        >
                          <Trash2 size={16} />
                          Delete Delivery
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="w-9 h-9 flex items-center justify-center bg-white/40 rounded-full text-[#5f5f5f] hover:bg-white hover:text-[#2d2d2d] hover:shadow-md transition-all">
                    <ArrowUpRight size={18} />
                  </div>
                </div>
              </Link>
            )) : (
              <p className="text-center text-[#8c8c8c] text-sm italic py-10">No recent activity found.</p>
            )}
          </div>
        </div>

        {/* Weekly Registry - Pastel Glass Panel */}
        <div className="bg-white/55 backdrop-blur-[16px] rounded-[24px] p-6 md:p-10 border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.06)] flex flex-col h-full animate-fade-up animate-stagger-5">
          <h3 className="font-luxury text-2xl md:text-3xl text-[#2d2d2d] mb-10">Weekly Registry</h3>
          
          <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {upcomingEvents.length > 0 ? upcomingEvents.map((event, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F6E6B4] shadow-[0_0_8px_#F6E6B4]"></div>
                  <span className="text-[11px] uppercase tracking-[1px] font-medium text-[#8c8c8c]">
                    {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <Link
                  to="/admin/calendar"
                  className="bg-white/40 backdrop-blur-md rounded-[20px] p-5 border border-white/40 hover:bg-white/60 transition-all duration-500 cursor-pointer active:scale-[0.98] group block"
                >
                  <h4 className="text-sm font-semibold text-[#2d2d2d] group-hover:text-black">
                    {event.name}
                  </h4>
                  <div className="flex flex-col gap-2 mt-4 text-[11px] text-[#7a7a7a] font-medium">
                    <div className="flex items-center gap-2.5">
                      <Clock size={12} className="opacity-60" />
                      {event.eventTime || 'Time TBD'}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={12} className="opacity-60" />
                      <span className="truncate">{event.eventLocation || 'Location TBD'}</span>
                    </div>
                  </div>
                </Link>
              </div>
            )) : (
              <p className="text-[#8c8c8c] text-sm italic">No upcoming events this week.</p>
            )}
          </div>

          <Link
            to="/admin/calendar"
            className="w-full mt-10 py-4 bg-gradient-to-br from-[#f6e6b4] to-[#e8d8ff] text-[#2d2d2d] rounded-full text-[12px] font-semibold uppercase tracking-[1px] hover:-translate-y-1 hover:scale-[1.03] transition-all shadow-md active:scale-95 text-center flex items-center justify-center"
          >
            Studio Full Calendar
          </Link>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-8 max-w-md w-full border border-white/40 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="font-luxury text-2xl text-[#2d2d2d] mb-4">Delete Delivery?</h3>
            <p className="text-sm text-[#7a7a7a] mb-8 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-[#2d2d2d]">"{selectedDelivery?.name}"</span>? 
              This action cannot be undone and will remove all associated data.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3.5 bg-white/50 hover:bg-white rounded-full text-[11px] font-bold uppercase tracking-widest text-[#7a7a7a] border border-[#eee] transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(selectedDelivery._id)}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 rounded-full text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-red-200 transition-all"
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DELIVERY MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-8 md:p-10 max-w-lg w-full border border-white/40 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-luxury text-3xl text-[#2d2d2d]">Edit Delivery</h3>
              <button onClick={() => setShowEditModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F7F5F2] transition-colors uppercase">
                <X size={20} className="text-[#8c8c8c]" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[1px] text-[#8c8c8c] ml-1">Delivery Name</label>
                <input 
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full bg-white/50 border border-[#eee] rounded-[16px] px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f3e5c8]/50 transition-all"
                  placeholder="Client/Delivery Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[1px] text-[#8c8c8c] ml-1">Event Date</label>
                  <input 
                    type="date"
                    required
                    value={editFormData.eventDate}
                    onChange={(e) => setEditFormData({...editFormData, eventDate: e.target.value})}
                    className="w-full bg-white/50 border border-[#eee] rounded-[16px] px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f3e5c8]/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[1px] text-[#8c8c8c] ml-1">Type</label>
                  <select 
                    value={editFormData.eventType}
                    onChange={(e) => setEditFormData({...editFormData, eventType: e.target.value})}
                    className="w-full bg-white/50 border border-[#eee] rounded-[16px] px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f3e5c8]/50 transition-all appearance-none"
                  >
                    <option value="Wedding">Wedding</option>
                    <option value="Engagement">Engagement</option>
                    <option value="Event">Event</option>
                    <option value="Portrait">Portrait</option>
                    <option value="Photos">Photos</option>
                    <option value="Videos">Videos</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 bg-white/50 hover:bg-white rounded-full text-[11px] font-bold uppercase tracking-widest text-[#7a7a7a] border border-[#eee] transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-gradient-to-r from-[#2d2d2d] to-black hover:to-[#444] rounded-full text-[11px] font-bold uppercase tracking-widest text-white shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
