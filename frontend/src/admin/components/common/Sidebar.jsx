import { memo, useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { io } from "socket.io-client";
import {
  LayoutDashboard,
  Users,
  Image,
  IndianRupee,
  Calendar,
  X,
  LogOut,
  MessageSquare,
  Bell,
} from "lucide-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Sidebar = function Sidebar({ onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  const pathRef = useRef(location.pathname);

  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;
      socket.emit("join_chat", "admin");

      const fetchUnread = async () => {
        try {
          const res = await axios.get(`${API_URL}/api/chats/unread`, { headers: { "x-auth-token": token } });
          setUnreadCount(res.data.count || 0);
        } catch (err) { }
      };
      fetchUnread();

      socket.on("new_message", (msg) => {
        // Industry-Standard: Re-fetch if addressed to us and we aren't viewing
        const isOutbound = (msg.sender === JSON.parse(localStorage.getItem('user'))?.id);
        const isAdminRecipient = msg.recipient === 'admin' || msg.recipient === 'hardcoded-admin-id' || msg.recipient === JSON.parse(localStorage.getItem('user'))?.id;
        const isOnChatPage = pathRef.current === '/admin/chats';

        if (isAdminRecipient && !isOnChatPage && !isOutbound) {
          fetchUnread();
        }
      });

      socket.on("chat_seen", () => fetchUnread());
      socket.on("unread_count_update", () => fetchUnread());

      return () => socket.disconnect();
    }
  }, []);

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard, exact: true },
    { name: "CRM", path: "/admin/crm", icon: Users },
    { name: "Chats", path: "/admin/chats", icon: MessageSquare },
    { name: "Smart Gallery", path: "/admin/gallery", icon: Image },
    { name: "Finance", path: "/admin/finance", icon: IndianRupee },
    { name: "Calendar", path: "/admin/calendar", icon: Calendar },
    { name: "Activity Log", path: "/admin/activity-log", icon: Bell },
  ];

  return (
    <div className="w-64 h-full bg-white/55 backdrop-blur-[14px] rounded-[24px] border border-white/40 px-6 py-10 flex flex-col shadow-[0_4px_15px_rgba(0,0,0,0.03)] relative z-50">
      <div className="flex justify-between items-center mb-12 px-2">
        <Link to="/" className="flex flex-col gap-4 group transition-transform hover:scale-[1.02]">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
            <img src="/team-alpha-logo.png" alt="Team Alpha Logo" className="w-full h-full object-contain p-1 rounded-2xl" />
          </div>
          <div>
            <h1 className="font-luxury text-2xl tracking-tighter text-[#2d2d2d]">Team Alpha</h1>
            <p className="text-[9px] uppercase tracking-[0.3em] text-[#8a8a8a] font-bold mt-1">The Wedding Artist</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={20} className="text-[#5f5f5f]" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-[6px] relative">
        {menuItems.map((item) => {
          const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.name} to={item.path} end={item.exact} onClick={() => onClose && onClose()}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 group relative z-10 ${isActive ? "text-[#2d2d2d] font-semibold" : "text-[#5f5f5f] hover:text-[#2d2d2d] font-medium"} text-[11px] uppercase tracking-widest`}
              style={{ willChange: "transform" }}
            >
              <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} className={`transition-all duration-200 relative z-20 ${isActive ? "opacity-100" : "opacity-60 group-hover:scale-110 group-hover:opacity-100"}`} />
              <span className="relative z-20 flex items-center gap-2">
                {item.name}
                {item.path === '/admin/chats' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-md ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </span>
              {isActive && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }} className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[#cfe8d5]/50 to-[#d9cdeb]/50 shadow-[0_0_20px_rgba(200,220,255,0.25)] border border-white/40 z-0" />
              )}
              {!isActive && (
                <div className="absolute inset-0 bg-[#78a08c]/[0.06] opacity-0 group-hover:opacity-100 rounded-[14px] transition-all duration-200 -z-10 translate-x-[-4px] group-hover:translate-x-0" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto px-2 mb-4">
        <button onClick={() => { if (window.confirm("Log out?")) { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); } }} className="w-full flex items-center gap-3 px-4 py-3 rounded-[14px] text-[11px] font-medium uppercase tracking-widest transition-all duration-200 text-[#5f5f5f] hover:bg-red-50 hover:text-red-500 group">
          <LogOut size={18} strokeWidth={1.5} className="opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          Log Out
        </button>
      </div>

      <div className="pt-6 border-t border-black/5">
        <div onClick={() => toast("Alpha Core v2.4.0\nCompiling Assets...", { icon: '🚀' })} className="mt-8 px-4 py-6 bg-white/40 rounded-3xl border border-white/60 cursor-pointer hover:shadow-sm transition-all group text-center">
          <p className="text-[9px] uppercase tracking-widest text-[#8a8a8a] font-bold group-hover:text-[#2d2d2d] transition-colors">
            Project: <span className="text-[#2d2d2d]">Alpha Core v2</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;