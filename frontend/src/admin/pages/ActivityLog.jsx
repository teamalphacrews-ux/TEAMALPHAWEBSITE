import { useState, useEffect } from "react";
import axios from "axios";
import { Bell, Clock, Trash2, Check, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

export default function ActivityLog() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const API = import.meta.env.VITE_API_URL || '';
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            if (!token) { setLoading(false); return; }
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/notifications`, authHeader);
            setNotifications(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch notifications");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        return () => clearInterval(interval);
    }, []);

    const markAsRead = async (id, e) => {
        e?.stopPropagation();
        try {
            await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/notifications/${id}/read`, {}, authHeader);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            toast.error("Failed to update notification");
        }
    };

    const markAllAsRead = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/notifications/mark-all-read`, {}, authHeader);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success("All caught up!");
        } catch (err) {
            toast.error("Error marking all read");
        }
    };

    const deleteNotification = async (id, e) => {
        e?.stopPropagation();
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/notifications/${id}`, authHeader);
            setNotifications(prev => prev.filter(n => n._id !== id));
            toast.success("Activity deleted");
        } catch (err) {
            toast.error("Error deleting notification");
        }
    };

    const clearAll = async () => {
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/notifications/clear-all`, authHeader);
            setNotifications([]);
            toast.success("Activity log cleared.");
        } catch (err) {
            toast.error("Error clearing notifications");
        }
    };

    const unseenCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in duration-1500 w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 animate-in slide-in-from-top-8 duration-1000 fill-mode-forwards">
                <div>
                    <h1 className="font-serif text-4xl md:text-5xl text-charcoal animate-gentle-fade">System Activity Log</h1>
                    <p className="text-[10px] md:text-xs text-warmgray mt-3 font-bold uppercase tracking-[0.4em]">Real-Time Registry Notifications</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={markAllAsRead}
                        className="px-5 py-2.5 rounded-full border border-[#e6e3df] text-[10px] font-bold uppercase tracking-[0.2em] text-warmgray hover:bg-white hover:text-charcoal hover:border-charcoal transition-all bg-white/50"
                    >
                        Mark All Read
                    </button>
                    <button
                        onClick={clearAll}
                        className="px-5 py-2.5 rounded-full border border-red-100 bg-red-50 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                        Clear All
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl md:rounded-4xl border border-[#e6e3df]/60 shadow-sm overflow-hidden w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 fill-mode-backwards">
                <div className="p-6 border-b border-[#e6e3df]/60 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-serif text-2xl text-charcoal flex items-center gap-3">
                        Recent Logs
                        {unseenCount > 0 && <span className="bg-charcoal text-white font-sans text-xs px-3 py-1 rounded-full animate-pulse">{unseenCount} unseen</span>}
                    </h2>
                </div>

                {loading ? (
                    <div className="p-20 flex justify-center text-warmgray">
                        <div className="w-8 h-8 border-2 border-[#e6e3df] border-t-charcoal rounded-full animate-spin"></div>
                    </div>
                ) : notifications.length > 0 ? (
                    <div className="divide-y divide-[#e6e3df]/60">
                        {notifications.map((notif, idx) => (
                            <div
                                key={notif._id}
                                className={`p-5 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 group transition-all duration-500 relative animate-in fade-in slide-in-from-bottom-4 ${!notif.isRead ? 'bg-amber-50/30 shadow-[inset_4px_0_0_rgba(212,175,55,1)]' : 'bg-white hover:bg-gray-50 hover:-translate-y-1 hover:shadow-lg z-10'}`}
                                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
                            >
                                <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-colors ${notif.isRead ? 'bg-gray-100 text-warmgray group-hover:bg-charcoal group-hover:text-white' : 'bg-gold/20 text-gold-700 shadow-sm'}`}>
                                    <Bell size={18} className="md:w-5 md:h-5" strokeWidth={1.5} />
                                </div>

                                <div className="flex-1 w-full sm:pr-24">
                                    <div className="flex items-center gap-4 mb-2">
                                        <h3 className={`text-base sm:text-lg transition-colors ${notif.isRead ? 'text-charcoal/80 font-medium' : 'text-charcoal font-black'}`}>
                                            {notif.title}
                                        </h3>
                                        {!notif.isRead && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                                    </div>
                                    <p className={`text-sm md:text-base leading-relaxed transition-colors ${notif.isRead ? 'text-warmgray/70' : 'text-charcoal/80'}`}>
                                        {notif.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-4 text-[10px] uppercase font-bold tracking-widest text-warmgray">
                                        <Clock size={12} />
                                        <span>{formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}</span>
                                        <span className="opacity-50">• {new Date(notif.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                </div>

                                <div className="mt-4 sm:mt-0 sm:absolute right-6 top-1/2 sm:-translate-y-1/2 flex items-center justify-end gap-3 w-full sm:w-auto">
                                    {!notif.isRead && (
                                        <button
                                            onClick={(e) => markAsRead(notif._id, e)}
                                            className="w-10 h-10 rounded-full bg-white border border-[#e6e3df] text-warmgray hover:text-charcoal hover:shadow-md flex items-center justify-center transition-all shadow-sm"
                                            title="Mark as seen"
                                        >
                                            <Check size={18} strokeWidth={2.5} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => deleteNotification(notif._id, e)}
                                        className="w-10 h-10 rounded-full bg-white border border-[#e6e3df] text-red-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 hover:shadow-md flex items-center justify-center transition-all opacity-100 sm:opacity-0 group-hover:opacity-100 pr-0.5 shadow-sm"
                                        title="Delete this log"
                                    >
                                        <Trash2 size={16} strokeWidth={2} className="translate-x-px" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-20 text-center text-warmgray flex flex-col items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center border border-[#e6e3df]/60 mb-2 shadow-inner">
                            <AlertCircle size={32} className="opacity-40 animate-float" />
                        </div>
                        <p className="font-serif text-2xl text-charcoal animate-gentle-fade">All clear</p>
                        <p className="text-sm font-medium">No activity traces or notifications detected in the system database.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
