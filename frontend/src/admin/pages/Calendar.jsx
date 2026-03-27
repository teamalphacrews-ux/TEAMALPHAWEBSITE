import { useState, useEffect } from "react";
import axios from "axios";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin, Filter, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import EventForm from "../components/calendar/EventForm";

export default function Calendar() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loading, setLoading] = useState(false);

    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/calendar`, authHeader);
            setEvents(res.data);
        } catch (error) {
            console.error("Failed to fetch events", error);
            toast.error("Could not load itinerary");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEvent = async (formData) => {
        try {
            if (selectedEvent) {
                // Update
                const res = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/calendar/${selectedEvent._id}`, formData, authHeader);
                setEvents(events.map(e => e._id === res.data._id ? res.data : e));
                toast.success("Event updated");
            } else {
                // Create
                const res = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/calendar`, formData, authHeader);
                setEvents([...events, res.data]);
                toast.success("Event scheduled");
            }
            setIsModalOpen(false);
            setSelectedEvent(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save event");
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm("Are you sure you want to remove this event?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/calendar/${id}`, authHeader);
            setEvents(events.filter(e => e._id !== id));
            toast.success("Event removed");
            setIsModalOpen(false);
            setSelectedEvent(null);
        } catch (error) {
            toast.error("Failed to delete event");
        }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const jumpToToday = () => setCurrentDate(new Date());

    // Generate days for the grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    // Find the starting Monday (even if it's in prev month)
    // simplistic approach: just fill days of month, maybe handle empty cells for offset?
    // Better: just list 1..31 and let user know DOW, or align properly. 
    // The previous design had a simple 7-col grid. Let's stick to generating days of current month 
    // and maybe padding start if we want to align with "Mon".
    // For simplicity and matching the reference image which looked like a simple list of boxes 
    // (the ref image started at 01 on Mon, so it was perfectly aligned or hypothetical).

    // Let's do a proper calendar alignment:
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    // We need to pad the start to match the first day of the week (Mon=0 in our array?)
    // date-fns getDay: Sun=0, Mon=1...Sat=6.
    // We want Mon as start.
    const startDayIndex = (monthStart.getDay() + 6) % 7; // Mon=0, Tue=1... Sun=6
    const blanks = Array(startDayIndex).fill(null);

    const upcomingEvents = events
        .filter(e => new Date(e.start) >= startOfDay(new Date()))
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

    const navigate = useNavigate();

    return (
        <div className="space-y-8 md:space-y-12 text-charcoal px-4 md:px-0 pb-20 animate-in fade-in duration-1500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-4 animate-in slide-in-from-top-8 duration-1000 fill-mode-forwards">
                <div>
                    <h1 className="font-serif text-3xl md:text-5xl animate-gentle-fade">Studio Itinerary</h1>
                    <p className="text-[10px] md:text-xs text-warmgray mt-3 font-bold uppercase tracking-[0.4em]">Coordinating luxury moments across the globe.</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto relative z-20">
                    <button
                        onClick={() => navigate('/admin/crm')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 border border-ivory/50 bg-white px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 hover:shadow-md transition-all shadow-sm"
                    >
                        <Users size={18} /> Teams
                    </button>
                    <button
                        onClick={() => { setSelectedEvent(null); setIsModalOpen(true); }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-charcoal text-white px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all shadow-xl hover:shadow-2xl"
                    >
                        <Plus size={18} /> Event
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 lg:gap-12 animate-in fade-in slide-in-from-bottom-12 duration-[1500ms] delay-200 fill-mode-backwards">
                {/* Calendar Grid */}
                <div className="xl:col-span-2 bg-white rounded-3xl sm:rounded-[2.5rem] border border-ivory shadow-sm p-4 sm:p-6 md:p-12 relative overflow-hidden transition-all duration-700 hover:shadow-xl group/cal">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                        <div className="flex items-center gap-4">
                            <h3 className="font-serif text-3xl md:text-4xl min-w-[200px]">{format(currentDate, 'MMMM yyyy')}</h3>
                            <div className="flex bg-ivory/50 p-1 rounded-xl border border-ivory">
                                <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg transition-all text-warmgray hover:text-charcoal shadow-sm">
                                    <ChevronLeft size={16} />
                                </button>
                                <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg transition-all text-warmgray hover:text-charcoal shadow-sm">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4 w-full sm:w-auto relative">
                            <button onClick={jumpToToday} className="flex-1 sm:flex-none text-[9px] font-bold uppercase tracking-widest bg-ivory/50 hover:bg-ivory px-6 py-2.5 rounded-full border border-ivory transition-colors">Today</button>

                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                className={`flex-1 sm:flex-none p-2.5 border border-ivory rounded-full hover:bg-ivory transition-colors ${filter !== 'All' ? 'bg-charcoal text-white hover:bg-mutedbrown' : 'text-warmgray'}`}
                            >
                                <Filter size={18} />
                            </button>

                            {showFilterMenu && (
                                <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-xl border border-ivory p-2 z-50 min-w-[150px] animate-in fade-in zoom-in-95 duration-200">
                                    {["All", "Wedding", "Pre-Wedding", "Meeting", "Engagement"].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => { setFilter(f); setShowFilterMenu(false); }}
                                            className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ivory transition-colors ${filter === f ? 'bg-ivory text-charcoal' : 'text-warmgray'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-px bg-ivory/40 rounded-3xl overflow-hidden border border-ivory shadow-inner">
                        {weekDays.map((day, dIdx) => (
                            <div key={day} className="bg-ivory/20 py-2 sm:py-5 px-1 sm:px-5 text-[7px] sm:text-[10px] uppercase tracking-widest sm:tracking-[0.2em] text-mutedbrown font-bold text-center border-b border-ivory">
                                {day}
                            </div>
                        ))}

                        {blanks.map((_, i) => (
                            <div key={`blank-${i}`} className="bg-ivory/5 min-h-[60px] sm:min-h-[100px] md:min-h-[140px] border-r border-b border-ivory/30"></div>
                        ))}

                        {daysInMonth.map((day, i) => {
                            const isTodayDate = isToday(day);
                            const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.start), day));

                            return (
                                <div
                                    key={day}
                                    onClick={() => {
                                        // Optional: click to create logic if desired
                                        // setSelectedEvent({ start: day.toISOString(), end: day.toISOString() }); 
                                        // setIsModalOpen(true);
                                    }}
                                    className={`bg-white min-h-[60px] sm:min-h-[100px] md:min-h-[140px] p-1 sm:p-2 md:p-3 hover:bg-ivory/10 transition-all group relative cursor-pointer border-r border-b border-ivory/30 ${isTodayDate ? 'bg-ivory/10' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[9px] sm:text-[11px] font-bold tracking-widest flex items-center justify-center rounded-xl ${isTodayDate ? 'bg-charcoal text-white w-5 h-5 sm:w-7 sm:h-7 shadow-lg' : 'text-warmgray group-hover:text-charcoal'}`}>
                                            {format(day, 'dd')}
                                        </span>
                                        {dayEvents.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>}
                                    </div>

                                    <div className="space-y-1.5">
                                        {dayEvents.map(event => (
                                            <div
                                                key={event._id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setIsModalOpen(true); }}
                                                className={`p-1 sm:p-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[9px] border-l-2 leading-tight shadow-sm hover:scale-[1.02] transition-transform ${event.type === 'Wedding' ? 'bg-charcoal text-white border-gold' :
                                                    event.type === 'Pre-Wedding' ? 'bg-ivory text-charcoal border-mutedbrown border' :
                                                        'bg-gray-50 text-gray-600 border-gray-300'
                                                    }`}
                                            >
                                                <span className="font-bold uppercase tracking-widest block truncate">{event.type}</span>
                                                <span className="opacity-70 block truncate font-medium">{event.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-8 md:space-y-10">
                    {/* Upcoming Registry */}
                    <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-ivory shadow-sm p-6 sm:p-8 md:p-10 relative overflow-hidden group hover:shadow-xl transition-all duration-700 hover:-translate-y-2">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-ivory rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-beige/50 transition-colors duration-[2000ms] animate-slow-spin"></div>
                        <h4 className="font-serif text-2xl md:text-3xl mb-10 relative z-10 transition-transform duration-700 group-hover:translate-x-2">Upcoming Registry</h4>

                        <div className="space-y-10 relative z-10 min-h-[200px]">
                            {loading ? <p className="text-sm text-warmgray italic">Loading schedule...</p> :
                                upcomingEvents.length > 0 ? (
                                    upcomingEvents.map(event => (
                                        <div key={event._id} className="group/item cursor-pointer" onClick={() => { setSelectedEvent(event); setIsModalOpen(true); }}>
                                            <div className="flex gap-6">
                                                <div className="flex flex-col items-center justify-center w-14 h-16 bg-ivory rounded-2xl border border-ivory shadow-sm group-hover/item:bg-charcoal group-hover/item:text-white transition-all duration-500">
                                                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">{format(parseISO(event.start), 'MMM')}</span>
                                                    <span className="text-2xl font-serif">{format(parseISO(event.start), 'dd')}</span>
                                                </div>
                                                <div className="flex-1 space-y-3">
                                                    <h5 className="text-sm font-bold text-charcoal group-hover/item:text-mutedbrown transition-colors truncate">
                                                        {event.title}
                                                    </h5>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2.5 text-[10px] text-warmgray font-bold uppercase tracking-widest">
                                                            <Clock size={12} className="text-gold" /> {format(parseISO(event.start), 'hh:mm a')}
                                                        </div>
                                                        {event.location && (
                                                            <div className="flex items-center gap-2.5 text-[10px] text-warmgray font-bold uppercase tracking-widest">
                                                                <MapPin size={12} className="text-gold" /> {event.location}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-warmgray italic">No upcoming events found.</p>
                                )}
                        </div>

                        <button
                            onClick={() => { setFilter("All"); jumpToToday(); }}
                            className="w-full mt-12 py-5 bg-white border border-ivory rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-ivory hover:shadow-md transition-all shadow-sm relative z-20"
                        >
                            View Full Studio Schedule
                        </button>
                    </div>

                    {/* Team Sync Card */}
                    <div className="bg-charcoal text-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-700">
                        <div className="absolute inset-0 bg-linear-to-tr from-white/5 to-transparent pointer-events-none"></div>
                        <h4 className="font-serif text-2xl md:text-3xl mb-6 relative z-10 transition-transform duration-700 group-hover:translate-x-2">Team Sync</h4>
                        <p className="text-[11px] text-white/50 leading-relaxed mb-10 font-medium relative z-10">
                            Teams are synchronized for the upcoming week. Global coordination is active.
                        </p>
                        <div className="flex -space-x-4 relative z-10 mb-10">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-12 h-12 rounded-[1.25rem] border-2 border-charcoal bg-white/10 backdrop-blur-md flex items-center justify-center text-xs text-white font-bold hover:translate-y-[-5px] transition-transform cursor-pointer">
                                    {String.fromCharCode(64 + i)}
                                </div>
                            ))}
                            <div className="w-12 h-12 rounded-[1.25rem] border-2 border-charcoal bg-gold flex items-center justify-center text-[10px] text-white font-bold shadow-lg">
                                +{Math.max(0, upcomingEvents.length)}
                            </div>
                        </div>
                        <button
                            onClick={handleTeamSync}
                            className="w-full py-5 bg-white/10 border border-white/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all relative z-20 shadow-md"
                        >
                            Assign Lead Team
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <EventForm
                    onClose={() => { setIsModalOpen(false); setSelectedEvent(null); }}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                    initialData={selectedEvent}
                />
            )}
        </div>
    );
}
