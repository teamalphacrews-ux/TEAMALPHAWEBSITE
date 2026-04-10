import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, startOfDay, addDays } from "date-fns";
import { X, Calendar as CalendarIcon, MapPin, Users, Clock, Save, Trash2, LogOut, ChevronLeft, ChevronRight, Plus, RefreshCw, Filter, Settings, Search, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import EventForm from "../components/calendar/EventForm";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import API_BASE_URL from "../../utils/apiConfig";

const PASTEL_COLORS = {
    yellow: "#FDE68A",
    red: "#FCA5A5",
    blue: "#7DD3FC",
    purple: "#C4B5FD",
    neutral: "#E5E7EB",
    empty: "#f3f4f6", // For blank/empty day cards
    background: "#f8f5f2",
    text: "#2d2d2d"
};

const STICKY_COLORS = [
    PASTEL_COLORS.yellow,
    PASTEL_COLORS.red,
    PASTEL_COLORS.blue,
    PASTEL_COLORS.purple,
    PASTEL_COLORS.neutral
];

const EVENT_TYPE_COLORS = {
    'Wedding': PASTEL_COLORS.red,
    'Pre-Wedding': PASTEL_COLORS.purple,
    'Meeting': PASTEL_COLORS.blue,
    'Engagement': PASTEL_COLORS.yellow,
    'Birthday': PASTEL_COLORS.yellow,
    'Other': PASTEL_COLORS.neutral
};

export default function Calendar() {
    const [selectedDate, setSelectedDate] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || API_BASE_URL;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState({ isSynced: false, email: "" });
    const [isSyncing, setIsSyncing] = useState(false);

    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const socketRef = useRef(null);

    useEffect(() => {
        fetchEvents();
        handleFetchSyncStatus();

        // --- Real-Time Authorized Socket Connection ---
        const socket = io(API, { auth: { token } });
        socketRef.current = socket;

        socket.on('calendar_update', (data) => {
            console.log("⚡ Real-time update received:", data);
            if (data.action === 'DISCONNECT') {
                setSyncStatus({ isSynced: false, email: "" });
            }
            
            if (data.action === 'SYNC_ERROR') {
                toast.error(data.error, { id: 'sync-error', duration: 6000 });
            }

            if (data.action === 'SYNC') {
                toast.success("Calendar updated in real-time");
            }
            
            // Instantly update UI for local database changes
            fetchEvents();
            handleFetchSyncStatus();
        });

        // Handle sync status from URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('sync') === 'success') {
            toast.success("Google Calendar connected successfully!");
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchEvents();
            handleFetchSyncStatus();
        } else if (urlParams.get('sync') === 'error') {
            toast.error("Failed to connect Google Calendar.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const handleFetchSyncStatus = async () => {
        try {
            const res = await axios.get(`${API}/api/calendar/sync-status`, authHeader);
            setSyncStatus(res.data);
        } catch (error) {
            console.error("Failed to fetch sync status", error);
        }
    };

    const handleSyncNow = async () => {
        setIsSyncing(true);
        const toastId = toast.loading("Synchronizing with Google...");
        try {
            await axios.get(`${API}/api/calendar/sync-now`, authHeader);
            toast.success("Calendar synced", { id: toastId });
            fetchEvents();
        } catch (error) {
            toast.error("Sync failed", { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm("Are you sure you want to disconnect Google Calendar? All synced events will be removed from the website.")) return;

        const toastId = toast.loading("Disconnecting...");
        try {
            await axios.post(`${API}/api/calendar/disconnect-google`, {}, authHeader);
            toast.success("Disconnected successfully", { id: toastId });
            setSyncStatus({ isSynced: false, email: "" });
            fetchEvents();
        } catch (error) {
            toast.error("Failed to disconnect", { id: toastId });
        }
    };

    const fetchEvents = async () => {
        // Only show loading if we don't have events yet (for smoother background updates)
        if (events.length === 0) setLoading(true);
        try {
            const res = await axios.get(`${API}/api/calendar`, authHeader);
            console.log("📅 Events from backend:", res.data);
            setEvents(res.data);
        } catch (error) {
            console.error("Failed to fetch events", error);
            toast.error("Could not load itinerary");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEvent = async (formData) => {
        // --- Optimistic UI Update ---
        const isUpdate = selectedEvent && selectedEvent._id;
        const tempId = isUpdate ? selectedEvent._id : `temp-${Date.now()}`;
        const optimisticEvent = {
            ...formData,
            _id: tempId,
            isOptimistic: true // Flag to show it's pending
        };

        const previousEvents = [...events];
        if (isUpdate) {
            setEvents(events.map(e => e._id === tempId ? optimisticEvent : e));
        } else {
            setEvents([...events, optimisticEvent]);
        }

        setIsModalOpen(false);

        try {
            if (isUpdate) {
                const res = await axios.patch(`${API}/api/calendar/${selectedEvent._id}`, formData, authHeader);
                setEvents(prev => prev.map(e => e._id === tempId ? res.data : e));

                if (res.data.syncWarning) {
                    toast.error(res.data.syncWarning, { duration: 5000 });
                } else {
                    toast.success("Event updated & synced with Google");
                }
            } else {
                const res = await axios.post(`${API}/api/calendar`, formData, authHeader);
                setEvents(prev => prev.map(e => e._id === tempId ? res.data : e));

                if (res.data.syncWarning) {
                    toast.error(res.data.syncWarning, { duration: 5000 });
                } else {
                    toast.success("Event scheduled & synced with Google");
                }
            }
            setSelectedEvent(null);
        } catch (error) {
            console.error(error);
            setEvents(previousEvents); // Rollback on error
            toast.error(error.response?.data?.message || "Failed to save event");
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm("Are you sure you want to remove this event?")) return;

        // --- Optimistic UI Update ---
        const previousEvents = [...events];
        setEvents(events.filter(e => e._id !== id));
        setIsModalOpen(false);
        setSelectedEvent(null);

        const toastId = toast.loading("Removing event...");
        try {
            await axios.delete(`${API}/api/calendar/${id}`, authHeader);
            toast.success("Event removed", { id: toastId });
        } catch (error) {
            console.error(error);
            setEvents(previousEvents); // Rollback on error
            toast.error("Failed to delete event", { id: toastId });
        }
    };

    const handleConnectGoogle = async () => {
        try {
            const res = await axios.get(`${API}/api/auth/google`, authHeader);
            if (res.data.url) {
                window.location.href = res.data.url;
            }
        } catch (error) {
            console.error("Failed to get Google OAuth URL", error);
            toast.error("Could not initiate Google connection");
        }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const jumpToToday = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayIndex = (monthStart.getDay() + 6) % 7;
    const blanks = Array(startDayIndex).fill(null);

    const upcomingEvents = events
        .filter(e => {
            const eventDate = new Date(e.start);
            const now = startOfDay(new Date());
            const ninetyDaysFromNow = new Date();
            ninetyDaysFromNow.setDate(now.getDate() + 90);
            
            return eventDate >= now && eventDate <= ninetyDaysFromNow;
        })
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .slice(0, 3);

    const [filter, setFilter] = useState("All");
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    const filteredEvents = filter === "All"
        ? events
        : events.filter(e => e.type === filter);

    const handleTeamSync = () => {
        setSelectedEvent({
            title: "Team Sync",
            type: "Meeting",
            start: new Date().toISOString(),
            end: new Date(new Date().setHours(new Date().getHours() + 1)).toISOString(),
            description: "Global team coordination meeting"
        });
        setIsModalOpen(true);
    };

    const [hoveredIdx, setHoveredIdx] = useState(null);
    const navigate = useNavigate();
    const [isRegistryOpen, setIsRegistryOpen] = useState(false);

    return (
        <div className="min-h-screen text-[#2d2d2d] px-4 md:px-12 pb-20 animate-in fade-in duration-1000 overflow-x-hidden">
            {/* MOBILE RESPONSIVE FIX: Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 py-8 md:py-12">
                <div className="md:max-w-xl">
                    <h1 className="font-serif text-4xl md:text-6xl text-[#2d2d2d] tracking-tight">Studio Calendar</h1>
                    <p className="text-[9px] md:text-xs text-[#BB998B] mt-3 md:mt-4 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] opacity-80 leading-relaxed md:leading-normal">
                        Coordinating luxury moments across the globe
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto relative z-20">
                    {/* Sync Status Pill - High Visibility */}
                    <div className={`
                        inline-flex items-center gap-3 px-5 md:px-6 py-3 md:py-3.5 rounded-full border-2 border-black/5
                        ${syncStatus.isSynced ? (syncStatus.syncError ? 'bg-amber-50 text-amber-600' : 'bg-white text-[#5B6A57]') : 'bg-red-50 text-red-400'}
                        transition-all duration-700 shadow-sm hover:shadow-md cursor-help group flex-1 md:flex-none justify-center md:justify-start
                    `}>
                        <div className="relative shrink-0">
                            <span className={`block w-2 md:w-2.5 h-2 md:h-2.5 rounded-full ${syncStatus.isSynced ? (syncStatus.syncError ? 'bg-amber-500' : 'bg-green-500 animate-pulse') : 'bg-red-400'}`}></span>
                            {(syncStatus.isSynced && !syncStatus.syncError) && (
                                <span className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-25"></span>
                            )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] opacity-40 leading-none mb-0.5 whitespace-nowrap">
                                {syncStatus.isSynced 
                                    ? (syncStatus.syncError ? 'Sync Warning' : 'Google Live') 
                                    : 'Offline Mode'}
                            </span>
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate max-w-[100px] md:max-w-[140px] leading-none">
                                {syncStatus.isSynced 
                                    ? (syncStatus.syncError ? 'Action Required' : syncStatus.email) 
                                    : 'No Sync Active'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-4 w-full md:w-auto">
                        <button
                            onClick={handleSyncNow}
                            disabled={isSyncing || loading}
                            className="bg-white border-2 border-gray-100 px-4 md:px-7 py-3 md:py-4 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                        >
                            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} /> REFRESH
                        </button>
                        <button
                            onClick={syncStatus.isSynced ? handleDisconnect : handleConnectGoogle}
                            className={`
                                ${syncStatus.isSynced ? 'bg-[#D1C4D1] hover:bg-[#C4B5CD]' : 'bg-white border-2 border-gray-100 hover:bg-gray-50'} 
                                text-[#2d2d2d] px-4 md:px-7 py-3 md:py-4 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95
                            `}
                        >
                            {syncStatus.isSynced ? <LogOut size={12} /> : <Plus size={12} />}
                            {syncStatus.isSynced ? 'OFF' : 'SYNC'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Application Interface */}
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-10">
                
                {/* 1. THE CALENDAR BOARD */}
                <div className="col-span-8 bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-3xl p-4 md:p-12 border-4 border-black/5 shadow-2xl shadow-black/5 flex flex-col gap-8 md:gap-12 transition-all">
                    
                    {/* Board Header: Month & Year */}
                    <div className="flex flex-row justify-between items-center px-2 md:px-4">
                        <div className="flex items-baseline gap-2 md:gap-4">
                            <h3 className="font-serif text-2xl md:text-5xl text-[#2d2d2d]">{format(currentDate, 'MMMM')}</h3>
                            <span className="text-sm md:text-2xl font-bold text-[#2d2d2d]/20 tracking-[0.2em]">{format(currentDate, 'yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-3 w-auto">
                            <button onClick={jumpToToday} className="flex-none text-[8px] md:text-[10px] font-bold uppercase tracking-widest bg-white/60 hover:bg-white px-3 md:px-6 py-2 md:py-3.5 rounded-xl md:rounded-2xl transition-all shadow-sm border border-black/5 text-center">Today</button>
                            <button onClick={prevMonth} className="flex-none p-2 md:p-3.5 bg-white/60 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-black/5 flex justify-center">
                                <ChevronLeft size={16} className="text-[#2d2d2d]" />
                            </button>
                            <button onClick={nextMonth} className="flex-none p-2 md:p-3.5 bg-white/60 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-black/5 flex justify-center">
                                <ChevronRight size={16} className="text-[#2d2d2d]" />
                            </button>
                        </div>
                    </div>

                    {/* Branded Day Labels Row */}
                    <div className="w-full pb-0 md:pb-6">
                        <div className="w-full">
                            <div className="grid grid-cols-7 gap-1 md:gap-6 px-0 md:px-4">
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                            <div key={day} className="text-[7px] md:text-[9px] font-bold text-[#2d2d2d]/40 tracking-[0.1em] md:tracking-[0.5em] text-center pb-3 md:pb-4 border-b-2 border-black/5">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Interactive Days Grid */}
                    <div className="grid grid-cols-7 gap-6 relative px-2">
                        {(() => {
                            const monthStart = startOfMonth(currentDate);
                            const monthEnd = endOfMonth(monthStart);
                            
                            // Calculate leading days from previous month
                            const startDay = monthStart.getDay(); 
                            const adjustedStartDay = (startDay === 0 ? 6 : startDay - 1); // MON=0, SUN=6
                            const prevMonthDays = Array.from({ length: adjustedStartDay }, (_, i) => {
                                const d = new Date(monthStart);
                                d.setDate(d.getDate() - (adjustedStartDay - i));
                                return d;
                            });

                            // Current month days
                            const currentMonthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

                            // Calculate trailing days to fill 42 cells (7x6)
                            const remaining = 42 - (prevMonthDays.length + currentMonthDays.length);
                            const nextMonthDays = Array.from({ length: remaining }, (_, i) => {
                                const d = new Date(monthEnd);
                                d.setDate(d.getDate() + (i + 1));
                                return d;
                            });

                            const allDisplayDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

                            return allDisplayDays.map((day, gridIdx) => {
                                const isHovered = hoveredIdx === gridIdx;
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                
                                // --- Localized Bump Logic (RECOVERED FROM COMMIT c2f4c1e) ---
                                const isTop = hoveredIdx !== null && gridIdx === hoveredIdx - 7;
                                const isBottom = hoveredIdx !== null && gridIdx === hoveredIdx + 7;
                                const isLeft = hoveredIdx !== null && gridIdx === hoveredIdx - 1 && hoveredIdx % 7 !== 0;
                                const isRight = hoveredIdx !== null && gridIdx === hoveredIdx + 1 && hoveredIdx % 7 !== 6;

                                let x = 0, y = 0;
                                if (isLeft) x = -40;
                                if (isRight) x = 40;
                                if (isTop) y = -40;
                                if (isBottom) y = 40;

                                const isTodayDate = isToday(day);
                                const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.start), day));
                                
                                let cardColor = PASTEL_COLORS.empty;
                                if (dayEvents.length > 0) {
                                    cardColor = EVENT_TYPE_COLORS[dayEvents[0].type] || PASTEL_COLORS.neutral;
                                } else {
                                    cardColor = STICKY_COLORS[gridIdx % STICKY_COLORS.length];
                                }

                                return (
                                    <motion.div
                                        key={day.toISOString()}
                                        layout
                                        onMouseEnter={() => !isMobile && setHoveredIdx(gridIdx)}
                                        onMouseLeave={() => !isMobile && setHoveredIdx(null)}
                                        animate={{
                                            x: isMobile ? 0 : x, 
                                            y: isMobile ? 0 : y,
                                            scale: isHovered && !isMobile ? 1.5 : 1,
                                            zIndex: isHovered && !isMobile ? 50 : (isTop || isBottom || isLeft || isRight ? 40 : 1),
                                            boxShadow: isHovered && !isMobile ? "0 30px 60px -15px rgba(0,0,0,0.15)" : "0 4px 6px -1px rgba(0,0,0,0.02)"
                                        }}
                                        transition={{ 
                                            type: "spring", 
                                            stiffness: 500, 
                                            damping: 45 
                                        }}
                                        onClick={() => {
                                            if (!isCurrentMonth) return; 
                                            setSelectedEvent({ 
                                                start: day.toISOString(), 
                                                end: day.toISOString(), 
                                                title: "",
                                                type: 'Wedding'
                                            });
                                            setIsModalOpen(true);
                                        }}
                                        style={{ backgroundColor: cardColor }}
                                        className={`
                                            min-h-[70px] md:min-h-[110px] p-2 md:p-5 rounded-xl md:rounded-2xl cursor-pointer relative group flex flex-col items-start transition-shadow
                                            ${!isCurrentMonth ? 'opacity-25 grayscale shadow-none pointer-events-none' : ''}
                                            ${isTodayDate ? 'ring-2 md:ring-4 ring-black/10 ring-offset-2 md:ring-offset-4 ring-offset-transparent' : ''}
                                        `}
                                    >
                                        {/* CALENDAR GRID FIX: Bold Solid Border */}
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-xl md:rounded-2xl overflow-hidden">
                                            <rect width="100%" height="100%" fill="none" rx="10" ry="10" stroke="rgba(0,0,0,0.06)" strokeWidth="1.5" className="md:rx-14 md:ry-14 md:stroke-width-2.5" />
                                        </svg>

                                        <div className="flex w-full justify-between items-start mb-1 md:mb-2 group-hover:scale-105 transition-transform origin-left relative z-10">
                                            <span className="text-[10px] md:text-sm font-bold text-[#2d2d2d] leading-none">{format(day, 'd')}</span>
                                            {isTodayDate && <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-black/40" />}
                                            {!isCurrentMonth && <span className="text-[6px] md:text-[7px] font-bold opacity-30 text-black uppercase tracking-tighter">{format(day, 'MMM')}</span>}
                                            
                                            {/* Quick-Add Button */}
                                            {isCurrentMonth && (
                                                <motion.button
                                                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.1)' }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEvent({ 
                                                            start: day.toISOString(), 
                                                            end: day.toISOString(), 
                                                            title: "",
                                                            type: 'Wedding' 
                                                        });
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="absolute -top-2 -right-2 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 hover:text-black text-[#2d2d2d]/30"
                                                >
                                                    <Plus size={14} />
                                                </motion.button>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-0.5 md:gap-1 w-full overflow-hidden relative z-10 flex-1">
                                            {dayEvents.slice(0, isMobile ? 1 : 3).map(event => (
                                                <motion.div 
                                                    key={event._id}
                                                    whileHover={{ scale: 1.02, x: 2 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEvent(event);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="w-full px-1 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg bg-white/30 hover:bg-white/50 backdrop-blur-sm border border-black/5 flex items-center gap-1 md:gap-1.5 cursor-pointer transition-colors"
                                                >
                                                    <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full shrink-0" style={{ backgroundColor: EVENT_TYPE_COLORS[event.type] || '#2d2d2d' }} />
                                                    <span className="text-[8px] md:text-[10px] font-black text-[#2d2d2d] leading-none truncate uppercase tracking-tighter">
                                                        {event.title}
                                                    </span>
                                                </motion.div>
                                            ))}
                                            {dayEvents.length > (isMobile ? 1 : 3) && (
                                                <div className="text-[6px] md:text-[8px] font-black text-black/40 uppercase pl-0.5 md:pl-1 pt-0.5">
                                                    + {dayEvents.length - (isMobile ? 1 : 3)}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            });
                            })()}
                        </div>
                    </div>
                </div>
                </div>

                {/* 2. SIDEBAR COMPONENT */}
                <div className="col-span-4 flex flex-col gap-10">
                    {/* Upcoming Registry */}
                    <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-3xl border-4 border-black/5 p-6 md:p-10 shadow-sm flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <CalendarIcon size={80} />
                        </div>
                        <h4 className="font-serif text-2xl md:text-3xl mb-8 md:mb-12 text-[#2d2d2d] relative z-10">Upcoming Events</h4>

                        <div className="space-y-4 md:space-y-6 mb-8 md:mb-12 relative z-10 min-h-[auto] md:min-h-[300px]">
                            {loading ? (
                                <div className="space-y-6">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="bg-black/5 animate-pulse rounded-[1.5rem] h-32 w-full" />
                                    ))}
                                </div>
                            ) : upcomingEvents.length > 0 ? (
                                upcomingEvents.map((event, idx) => (
                                    <motion.div 
                                        key={event._id} 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        whileHover={{ x: -10, scale: 1.02 }}
                                        className="rounded-[1.25rem] md:rounded-[1.5rem] p-4 md:p-6 flex items-center gap-4 md:gap-6 shadow-sm border border-black/5 cursor-pointer group relative overflow-hidden"
                                        style={{ backgroundColor: EVENT_TYPE_COLORS[event.type] || PASTEL_COLORS.neutral }}
                                        onClick={() => { setSelectedEvent(event); setIsModalOpen(true); }}
                                    >
                                        <div className="w-14 h-14 md:w-20 md:h-20 bg-white/40 rounded-full border border-white/40 flex flex-col items-center justify-center shrink-0 shadow-inner">
                                            <span className="text-[8px] md:text-[10px] font-bold uppercase opacity-40 mb-0.5 md:mb-1">{format(parseISO(event.start), 'MMM')}</span>
                                            <span className="text-xl md:text-2xl font-bold leading-none text-[#2d2d2d]">{format(parseISO(event.start), 'dd')}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1 md:mb-2">
                                                <h5 className="text-sm md:text-lg font-bold text-[#2d2d2d] leading-tight tracking-tight group-hover:text-black transition-colors">{event.title}</h5>
                                                {event.isReadOnly && <Lock size={10} className="text-[#2d2d2d]/30" />}
                                            </div>
                                            <div className="flex flex-col gap-0.5 md:gap-1">
                                                <div className="flex items-center gap-2 text-[8px] md:text-[10px] text-[#2d2d2d]/40 font-bold uppercase tracking-widest">
                                                    <Clock size={10} /> {format(parseISO(event.start), 'hh:mm a')}
                                                </div>
                                                <div className="flex items-center gap-2 text-[8px] md:text-[10px] text-[#2d2d2d]/40 font-bold uppercase tracking-widest">
                                                    <MapPin size={10} /> {event.location || 'Studio HQ'}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Type Badge */}
                                        <div className="absolute top-3 right-3 bg-black/5 px-2 py-0.5 rounded-full text-[6px] md:text-[8px] font-bold uppercase tracking-widest opacity-40">
                                            {event.type}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="h-48 md:h-64 flex flex-col items-center justify-center text-center opacity-30 border-2 border-dashed border-black/10 rounded-[1.5rem] md:rounded-[2rem]">
                                    <CalendarIcon size={24} className="mb-3" />
                                    <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em]">No upcoming events</p>
                                </div>
                            )}
                        </div>

                        <motion.button 
                            whileHover={{ scale: 1.02, backgroundColor: "#EBE7D8" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsRegistryOpen(true)}
                            className="w-full py-4 md:py-5 bg-[#F3F0E6] border-2 border-dashed border-black/5 rounded-[1.25rem] md:rounded-[1.5rem] text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all text-[#2d2d2d] outline-none shadow-sm relative z-10"
                        >
                            FULL STUDIO SCHEDULE
                        </motion.button>
                    </div>

                    {/* Team Sync Card */}
                    <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-3xl border-4 border-black/5 p-6 md:p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Users size={80} />
                        </div>
                        <h4 className="font-serif text-2xl md:text-3xl mb-6 md:mb-8 text-[#2d2d2d] relative z-10">Team Sync</h4>
                        <p className="text-[10px] md:text-[11px] text-[#2d2d2d]/60 leading-relaxed mb-8 md:mb-10 font-medium relative z-10">
                            Standard synchronization active across all specialized units. 
                        </p>
                        <div className="flex flex-wrap gap-2 md:gap-3 mb-8 md:mb-12 relative z-10">
                            {[
                                { n: 'A', c: '#FCA5A5' }, { n: 'S', c: '#FDE68A' }, { n: 'H', c: '#7DD3FC' }, 
                                { n: 'H', c: '#C4B5FD' }, { n: 'VB', c: '#A9AC83' }, { n: 'JP', c: '#E8D0DC' }
                            ].map((team, i) => (
                                <motion.div 
                                    key={i} 
                                    style={{ backgroundColor: team.c }}
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
                                    whileHover={{ scale: 1.2, rotate: 5, zIndex: 10 }}
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-[#2d2d2d] border-2 border-white/80 shadow-sm cursor-pointer"
                                >
                                    {team.n}
                                </motion.div>
                            ))}
                        </div>
                        <motion.button 
                            whileHover={{ scale: 1.02, backgroundColor: "#EBE7D8" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleTeamSync} 
                            className="w-full py-4 md:py-5 bg-[#F3F0E6] border-2 border-dashed border-black/5 rounded-[1.25rem] md:rounded-[1.5rem] text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all text-[#2d2d2d] outline-none shadow-sm relative z-10"
                        >
                            COORDINATE LEAD TEAM
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Registry Modal Overlay */}
            <AnimatePresence>
                {isRegistryOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-12 overflow-hidden"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 50, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 50, opacity: 0 }}
                            className="bg-white/80 backdrop-blur-3xl w-full max-w-6xl h-full rounded-[3rem] border-8 border-black/5 shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-12 border-b border-black/5 flex justify-between items-center">
                                <div>
                                    <h2 className="font-serif text-5xl text-[#2d2d2d]">Studio Schedule</h2>
                                    <p className="text-xs text-[#BB998B] mt-3 font-bold uppercase tracking-widest">A chronological record of every production moment</p>
                                </div>
                                <button 
                                    onClick={() => setIsRegistryOpen(false)}
                                    className="p-5 hover:bg-black/5 rounded-full transition-colors"
                                >
                                    <LogOut className="rotate-180" size={32} />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                                <div className="space-y-12">
                                    {events
                                        .filter(e => {
                                            const eventDate = new Date(e.start);
                                            const now = startOfDay(new Date());
                                            const yearFromNow = new Date();
                                            yearFromNow.setFullYear(now.getFullYear() + 1);
                                            return eventDate >= now && eventDate <= yearFromNow;
                                        })
                                        .sort((a, b) => new Date(a.start) - new Date(b.start))
                                        .map((event, i) => (
                                            <motion.div 
                                                key={event._id}
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="grid grid-cols-12 gap-8 items-center group cursor-help"
                                                onClick={() => { setSelectedEvent(event); setIsModalOpen(true); }}
                                            >
                                                <div className="col-span-2 text-left">
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 block mb-2">{format(parseISO(event.start), 'MMMM')}</span>
                                                    <span className="text-5xl font-serif text-[#2d2d2d] leading-none">{format(parseISO(event.start), 'dd')}</span>
                                                </div>
                                                <div className="col-span-7 bg-white/60 p-8 rounded-[2rem] border-2 border-black/5 group-hover:border-black/20 transition-all shadow-sm">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-2xl font-bold text-[#2d2d2d]">{event.title}</h3>
                                                        {event.isReadOnly && <Lock size={16} className="text-[#2d2d2d]/20" />}
                                                    </div>
                                                    <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest opacity-60">
                                                        <span className="flex items-center gap-2"><Clock size={14}/> {format(parseISO(event.start), 'hh:mm a')}</span>
                                                        <span className="flex items-center gap-2"><MapPin size={14}/> {event.location || 'Studio HQ'}</span>
                                                        <span className="px-3 py-1 rounded-full bg-black/5 text-[8px]">{event.type}</span>
                                                    </div>
                                                </div>
                                                <div className="col-span-3 text-right block">
                                                    <button className="text-[10px] font-bold uppercase tracking-widest p-4 rounded-full border border-black/10 transition-all">VIEW DETAILS</button>
                                                </div>
                                            </motion.div>
                                        ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Event Management Brief (Modal) */}
            <AnimatePresence>
                {isModalOpen && (
                    <EventForm
                        onClose={() => { setIsModalOpen(false); setSelectedEvent(null); }}
                        onSave={handleSaveEvent}
                        onDelete={handleDeleteEvent}
                        initialData={selectedEvent}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
