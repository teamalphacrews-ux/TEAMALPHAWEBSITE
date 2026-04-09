import { memo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, User, Instagram, Menu, MessageCircle, X, Check, Trash2, Clock, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import AdminProfileModal from "./AdminProfileModal";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../../context/AuthContext";
import API_BASE_URL from "../../../utils/apiConfig";

const Topbar = memo(function Topbar({ onMenuClick, isVisibleProp }) {
    const navigate = useNavigate();
    const { user: adminProfile, logout, updateUser } = useAuth();
    const [showProfileModal, setShowProfileModal] = useState(false);
    
    // Premium Scroll Behavior State
    const [isVisible, setIsVisible] = useState(true);
    const [isScrolled, setIsScrolled] = useState(false);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    // Sync with external visibility prop if provided
    useEffect(() => {
        if (isVisibleProp !== undefined) {
            setIsVisible(isVisibleProp);
        }
    }, [isVisibleProp]);

    useEffect(() => {
        // Only use internal scroll listener if no external prop is passed
        if (isVisibleProp !== undefined) {
            const handleScrollSimple = () => {
                setIsScrolled(window.scrollY > 10);
            };
            window.addEventListener("scroll", handleScrollSimple, { passive: true });
            return () => window.removeEventListener("scroll", handleScrollSimple);
        }

        const updateHeader = () => {
            const currentScrollY = window.scrollY;
            
            // Toggle shadow based on scroll position
            setIsScrolled(currentScrollY > 10);

            // Hide/Show logic with 10px threshold to avoid flicker
            if (currentScrollY < 10) {
                setIsVisible(true);
            } else if (currentScrollY > lastScrollY.current) {
                setIsVisible(false);
            } else if (currentScrollY < lastScrollY.current - 5) {
                // Requiring a 5px upward scroll to trigger re-appearance for stability
                setIsVisible(true);
            }

            lastScrollY.current = currentScrollY;
            ticking.current = false;
        };

        const handleScroll = () => {
            if (!ticking.current) {
                window.requestAnimationFrame(updateHeader);
                ticking.current = true;
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [isVisibleProp]);

    // Notifications State
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const notifRef = useRef(null);

    // Initial check: if no user is present, Topbar should still render but with defaults
    const activeProfile = {
        name: adminProfile?.name || (adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ""}`.trim() : "Admin"),
        role: adminProfile?.role === 'admin' ? "Admin Registry" : (adminProfile?.role || "Staff")
    };

    // --- Notifications Logic ---
    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res && res.data && Array.isArray(res.data)) {
                setNotifications(res.data);
            } else {
                setNotifications([]);
            }
        } catch (err) {
            console.error("Topbar notifications error:", err);
            if (err.response?.status === 401) {
                // Halt polling on unauthorized to prevent infinite loops
                localStorage.removeItem("token");
                navigate('/auth');
            }
            setNotifications([]);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Efficient background polling
        return () => clearInterval(interval);
    }, [navigate]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id, e) => {
        e?.stopPropagation();
        try {
            const token = localStorage.getItem("token");
            await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            toast.error("Failed to update notification");
        }
    };

    const deleteNotification = async (id, e) => {
        e?.stopPropagation();
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/notifications/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.filter(n => n._id !== id));
        } catch (err) {
            toast.error("Error deleting notification");
        }
    };

    const markAllAsRead = async (e) => {
        e?.stopPropagation();
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/notifications/mark-all-read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success("All caught up!");
        } catch (err) {
            toast.error("Error marking all read");
        }
    };

    const clearAll = async (e) => {
        e?.stopPropagation();
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/notifications/clear-all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications([]);
            setShowNotifications(false);
            toast.success("Activity log cleared.");
        } catch (err) {
            toast.error("Error clearing notifications");
        }
    };

    const unseenCount = notifications.filter(n => !n.isRead).length;

    return (
        <>
            <header className={`h-[60px] px-4 flex items-center gap-4 bg-white/60 backdrop-blur-[14px] rounded-[18px] border border-white/40 shadow-[0_8px_25px_rgba(0,0,0,0.05)] relative z-30 transition-all duration-300 ease-in-out ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"}`}>
                {/* Icons Area */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-[8px] text-[#5f5f5f] hover:bg-black/5 hover:text-[#2d2d2d] transition-all duration-200"
                    >
                        <Menu size={18} />
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Notifications */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative text-warmgray hover:text-charcoal transition-all p-2.5 bg-black/5 hover:bg-ivory rounded-full group shrink-0 hover:-translate-y-0.5 flex items-center justify-center"
                                title="Recent Activity & Notifications"
                            >
                                <Bell size={20} className={`${unseenCount > 0 ? "text-charcoal" : ""}`} strokeWidth={1.5} />
                                {unseenCount > 0 && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown Panel */}
                            {showNotifications && (
                                <div className="absolute top-full -right-[65px] sm:right-0 mt-3 w-[290px] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-[#e6e3df]/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                    <div className="p-4 border-b border-[#e6e3df]/60 flex justify-between items-center bg-gray-50/50">
                                        <h4 className="font-bold text-charcoal text-sm flex items-center gap-2">
                                            Activity Log
                                            {unseenCount > 0 && <span className="bg-red-100 text-red-600 text-[9px] px-2 py-0.5 rounded-full">{unseenCount} new</span>}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <button onClick={markAllAsRead} className="text-[10px] font-bold uppercase tracking-widest text-warmgray hover:text-charcoal p-1">Read All</button>
                                            <button onClick={clearAll} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete All"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    <div className="max-h-[400px] overflow-y-auto w-full custom-scrollbar">
                                        {notifications.length > 0 ? notifications.map((notif) => (
                                            <div
                                                key={notif._id}
                                                onClick={(e) => {
                                                    if (!notif.isRead) markAsRead(notif._id, e);
                                                    navigate(notif.link ? (notif.link.startsWith('/admin') ? notif.link : '/admin' + notif.link) : '/admin/crm');
                                                    setShowNotifications(false);
                                                }}
                                                className={`p-4 border-b border-[#e6e3df]/60 last:border-0 hover:bg-gray-50 cursor-pointer transition-all relative flex gap-3 group ${!notif.isRead ? 'bg-amber-50/30 shadow-inner' : 'bg-white opacity-60 hover:opacity-100'}`}
                                            >
                                                {!notif.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]"></div>}
                                                <div className="mt-0.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${notif.isRead ? 'bg-gray-100 text-warmgray' : 'bg-gold/20 text-gold-700 shadow-sm'}`}>
                                                        <Clock size={14} />
                                                    </div>
                                                </div>
                                                <div className="flex-1 pr-6">
                                                    <p className={`text-sm transition-colors ${notif.isRead ? 'text-warmgray font-medium' : 'text-charcoal font-black'}`}>{notif.title}</p>
                                                    <p className={`text-xs mt-1 line-clamp-2 transition-colors ${notif.isRead ? 'text-warmgray/60' : 'text-charcoal/80 font-medium'}`}>{notif.description}</p>
                                                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-2 transition-colors ${notif.isRead ? 'text-warmgray/50' : 'text-mutedbrown'}`}>
                                                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                                    </p>
                                                </div>

                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    {!notif.isRead && (
                                                        <button
                                                            onClick={(e) => markAsRead(notif._id, e)}
                                                            className="w-6 h-6 rounded-full bg-white border border-[#e6e3df] text-warmgray hover:text-charcoal hover:shadow-md flex items-center justify-center transition-all bg-opacity-90 backdrop-blur-sm"
                                                            title="Mark as seen"
                                                        >
                                                            <Check size={12} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => deleteNotification(notif._id, e)}
                                                        className="w-6 h-6 rounded-full bg-white border border-[#e6e3df] text-red-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 hover:shadow-md flex items-center justify-center transition-all bg-opacity-90 backdrop-blur-sm"
                                                        title="Delete this notification"
                                                    >
                                                        <Trash2 size={12} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-10 text-center text-warmgray flex flex-col items-center justify-center gap-3">
                                                <Bell size={24} className="opacity-30" />
                                                <p className="text-sm font-medium">No recent activity detected.</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 border-t border-[#e6e3df]/60 bg-white shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.05)] relative z-10">
                                        <button onClick={() => { setShowNotifications(false); navigate('/admin/activity-log'); }} className="w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-charcoal hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-[#e6e3df]">
                                            View Full Activity
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-1 md:gap-4 md:border-l border-[#e6e3df] pl-1 md:pl-4">
                            <button
                                onClick={() => window.open('https://www.instagram.com/teamalpha_crew/', '_blank')}
                                className="text-warmgray hover:text-charcoal transition-all p-2.5 bg-black/5 hover:bg-ivory rounded-full shrink-0 hover:-translate-y-0.5 flex items-center justify-center"
                                title="Visit Team Alpha Instagram"
                            >
                                <Instagram size={20} strokeWidth={1.5} />
                            </button>
                            <button
                                onClick={() => window.open('https://wa.me/919110603953', '_blank')}
                                className="text-warmgray hover:text-[#25D366] transition-all p-2.5 bg-black/5 hover:bg-ivory rounded-full shrink-0 hover:-translate-y-0.5 flex items-center justify-center"
                                title="Contact Admin via WhatsApp"
                            >
                                <MessageCircle size={20} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-3 group cursor-pointer pl-1 shrink-0"
                        onClick={() => setShowProfileModal(true)}
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-charcoal">{activeProfile.name}</p>
                            <p className="text-[9px] text-warmgray uppercase tracking-[0.2em] font-bold">{activeProfile.role}</p>
                        </div>
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-[10px] md:rounded-2xl bg-ivory border border-[#e6e3df] flex items-center justify-center overflow-hidden transition-all group-hover:shadow-md group-hover:scale-105 shrink-0">
                            <User size={18} className="md:w-6 md:h-6 text-warmgray translate-y-1" />
                        </div>
                    </div>
                </div>
            </header>

            {showProfileModal && (
                <AdminProfileModal
                    profile={adminProfile}
                    onClose={() => setShowProfileModal(false)}
                    onSave={(updated) => {
                        updateUser(updated);
                        toast.success("Profile updated successfully");
                        setShowProfileModal(false);
                    }}
                />
            )}
        </>
    );
});

export default Topbar;
