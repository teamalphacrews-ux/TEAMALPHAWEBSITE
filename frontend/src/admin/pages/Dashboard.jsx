import { useState, useEffect } from "react";
import axios from "axios";
import StatCard from "../components/dashboard/StatCard";
import { TrendingUp, Users, ImageIcon, PieChart, ArrowUpRight, Clock, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPhotos: 0,
    storageUsage: '0%',
    pendingApprovals: 0,
    traffic: '0'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [isSystemOnline, setIsSystemOnline] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [statsRes, activityRes, eventsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL || ""}/api/dashboard/stats`, authHeader),
          axios.get(`${import.meta.env.VITE_API_URL || ""}/api/dashboard/recent-activity`, authHeader),
          axios.get(`${import.meta.env.VITE_API_URL || ""}/api/dashboard/upcoming-events`, authHeader)
        ]);

        if (isMounted) {
          setStats(statsRes.data);
          setRecentActivity(activityRes.data);
          setUpcomingEvents(eventsRes.data);
          setIsSystemOnline(true);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
        if (isMounted) setIsSystemOnline(false);
      }
    };

    fetchData(); // Initial immediate load

    // Real-time efficient background polling
    const intervalId = setInterval(fetchData, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-6 md:space-y-10 w-full animate-in fade-in duration-1500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in slide-in-from-top-8 duration-1000 fill-mode-forwards">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl text-charcoal animate-gentle-fade">Registry Overview</h1>
          <p className="text-[10px] md:text-xs text-warmgray mt-3 font-bold uppercase tracking-[0.4em]">Team Alpha Luxury Photography Studio</p>
        </div>
        <div className={`flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-ivory text-[10px] font-bold uppercase tracking-widest ${isSystemOnline ? 'text-warmgray' : 'text-red-500'} shadow-sm transition-colors`}>
          <div className={`w-2 h-2 rounded-full ${isSystemOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'} `}></div>
          {isSystemOnline ? 'Studio System Online' : 'System Offline (Check Server)'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 fill-mode-backwards">
        <StatCard
          title="Global Photo Assets"
          value={stats.totalPhotos.toLocaleString()}
          icon={<ImageIcon size={20} className="text-mutedbrown" />}
        />
        <StatCard
          title="Cloud Storage"
          value={stats.storageUsage}
          icon={<PieChart size={20} className="text-mutedbrown" />}
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<Clock size={20} className="text-mutedbrown" />}
        />
        <StatCard
          title="Website Traffic"
          value={stats.traffic}
          icon={<Users size={20} className="text-mutedbrown" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-12 duration-[1500ms] delay-300 fill-mode-backwards">
        {/* Recent Activity section */}
        <div className="xl:col-span-2 bg-white rounded-3xl md:rounded-[2.5rem] p-5 md:p-12 border border-[#e6e3df]/60 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-700 hover:-translate-y-2">
          <div className="absolute top-0 right-0 w-80 h-80 bg-ivory/40 rounded-full blur-[100px] -mr-40 -mt-40 group-hover:bg-beige/40 transition-all duration-[2000ms] animate-slow-spin"></div>

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
              <h2 className="font-serif text-2xl md:text-3xl transition-transform duration-700 group-hover:translate-x-2">Latest Deliveries</h2>
              <button
                onClick={() => navigate('/admin/crm')}
                className="text-[10px] font-bold uppercase tracking-widest text-mutedbrown hover:text-charcoal border-b border-[#e6e3df] hover:border-charcoal transition-all pb-2 opacity-70 hover:opacity-100"
              >
                All Registry Assets
              </button>
            </div>

            <div className="space-y-10">
              {recentActivity.length > 0 ? recentActivity.map((session, i) => (
                <div
                  key={session._id || i}
                  onClick={() => navigate('/admin/crm')}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-10 border-b border-ivory/60 last:border-0 last:pb-0 group/item cursor-pointer hover:bg-ivory/20 rounded-xl p-2 transition-colors -mx-2"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-ivory/50 rounded-3xl flex items-center justify-center text-warmgray group-hover/item:bg-charcoal group-hover/item:text-white transition-all duration-700 shadow-sm">
                      <ImageIcon size={28} strokeWidth={1} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-charcoal">{session.name}</h4>
                      <p className="text-[11px] text-warmgray mt-1 font-bold uppercase tracking-wider">{session.date} • {session.count}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <span className={`text-[9px] uppercase tracking-widest font-bold px-4 py-1.5 rounded-full ${session.status === 'Delivered' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                      {session.status}
                    </span>
                    <button className="p-3 border border-ivory rounded-full text-warmgray hover:text-charcoal hover:bg-white hover:shadow-md transition-all">
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-center text-warmgray text-sm italic py-10">No recent activity found. Add leads to populate this.</p>
              )}
            </div>
          </div>
        </div>

        {/* Studio Calendar View */}
        <div className="bg-charcoal text-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-700">
          <div className="absolute top-0 right-0 w-full h-full bg-linear-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="font-serif text-2xl md:text-3xl mb-12 transition-transform duration-700 group-hover:translate-x-2">Weekly Registry</h3>
            <div className="space-y-10 flex-1">
              {upcomingEvents.length > 0 ? upcomingEvents.map((event, i) => (
                <div key={i} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]"></div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/50">
                      {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div
                    onClick={() => navigate('/admin/calendar')}
                    className="bg-white/5 backdrop-blur-3xl rounded-4xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-pointer group/card active:scale-[0.98]"
                  >
                    <h4 className="text-base font-bold group-hover/card:text-gold transition-colors">
                      {event.eventType ? `${event.eventType}: ` : ''}{event.name}
                    </h4>
                    <div className="flex flex-col gap-3 mt-6 text-[11px] text-white/60 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                          <Clock size={12} className="text-gold" />
                        </div>
                        {event.eventTime || 'Time TBD'}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                          <MapPin size={12} className="text-gold" />
                        </div>
                        {event.eventLocation || 'Location TBD'}
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-white/40 text-sm italic">No upcoming events this week.</p>
              )}
            </div>
            <button
              onClick={() => navigate('/admin/calendar')}
              className="w-full mt-12 py-5 bg-white text-charcoal rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-gold hover:text-white hover:shadow-[0_20px_40px_rgba(212,175,55,0.3)] transition-all shadow-2xl active:scale-95"
            >
              Studio Full Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
