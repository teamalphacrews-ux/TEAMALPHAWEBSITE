import { memo, useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux';
import { fetchUnreadCounts, setAdminUnreadCount, handleRoomUpdate } from '../../../store/slices/chatSlice';
import { motion } from "framer-motion";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../../../context/AuthContext";
import new_logo from "../../../assets/new_logo_original.png";

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

const API_URL = import.meta.env.VITE_API_URL || "";

const Sidebar = function Sidebar({ onClose }) {
  const { user: authUser, token: authContextToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const unreadCount = useSelector(state => state.chat.adminUnreadCount);
  const socketRef = useRef(null);
  
  const cleanToken = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.replace(/^["']|["']$/g, '').trim();
    return cleaned === 'null' || cleaned === 'undefined' ? null : cleaned;
  };

  useEffect(() => {
    const token = cleanToken(authContextToken || localStorage.getItem("token"));
    
    // Auth Gate: Strictly only fire if we have a valid user and a sanitized token
    if (authUser && token) {
      console.log('--- [SIDEBAR] --- Session Ready, Initializing Hooks ---');
      
      const socket = io(API_URL, { 
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5 
      });
      socketRef.current = socket;
      
      socket.on("connect", () => {
          socket.emit("join_chat", "admin");
          // Re-sync counts on every clean connection
          dispatch(fetchUnreadCounts());
      });

      socket.on("room_updated", (data) => dispatch(handleRoomUpdate(data)));
      
      socket.on("unread_count_update", (data) => {
        if (data && typeof data.count === 'number') dispatch(setAdminUnreadCount(data.count));
      });

      // Initial Sync via Redux (Guarded)
      dispatch(fetchUnreadCounts());

      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, [authUser, authContextToken]);

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
    <div className="w-[280px] lg:w-64 h-full bg-[#fdfbf7] lg:bg-white/55 lg:backdrop-blur-[14px] rounded-none lg:rounded-[24px] border-r border-[#e6e3df] lg:border-white/40 px-6 py-10 flex flex-col shadow-2xl lg:shadow-[0_4px_15px_rgba(0,0,0,0.03)] relative z-50">
      <div className="flex justify-between items-center mb-12 px-2">
        <Link to="/" className="flex flex-col gap-0 group transition-transform hover:scale-[1.02]">
          <img
            src={new_logo}
            alt="Team Alpha Logo"
            style={{
              width: "120px",
              height: "auto",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              padding: 0,
              margin: 0,
              objectFit: "contain"
            }}
          />
          <div className="mt-[-12px]">
            <h1 className="font-luxury text-2xl tracking-tighter text-[#2d2d2d]">Team Alpha</h1>
            <p className="text-[9px] uppercase tracking-[0.3em] text-[#8a8a8a] font-bold">The Wedding Artist</p>
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
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}>
                    <Bell size={14} className="text-[#e11d48] fill-[#e11d48]/10 drop-shadow-[0_0_8px_rgba(225,29,72,0.4)]" />
                  </motion.div>
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
