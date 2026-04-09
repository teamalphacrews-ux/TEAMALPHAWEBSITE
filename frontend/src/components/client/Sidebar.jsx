import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux';
import { fetchClientUnreadCounts, setClientUnreadCount, handleRoomUpdate } from '../../store/slices/chatSlice';
import { motion } from "framer-motion";
import { 
  Heart, 
  Home, 
  Image, 
  MessageSquare, 
  Cloud, 
  LogOut, 
  Instagram, 
  X,
  Bell
} from "lucide-react";
import { io } from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
import new_logo from "../../assets/new_logo_original.png";


export default function ClientSidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const unreadCount = useSelector(state => state.chat.clientUnreadCount);
  const socketRef = useRef(null);
  
  const { user } = useAuth();
  const userId = user?.id || user?._id;

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out safely?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (userId && token) {
      const socket = io(import.meta.env.VITE_API_URL || "", { 
        auth: { token },
        reconnection: true
      });
      socketRef.current = socket;
      socket.emit("join_chat", userId);

      // Global Redux Sync
      dispatch(fetchClientUnreadCounts());

      socket.on("room_updated", (data) => dispatch(handleRoomUpdate(data)));
      
      socket.on("chat_seen", (data) => {
        if (data.chatId === 'admin' || data.chatId === userId) {
            dispatch(setClientUnreadCount(0));
        }
      });

      return () => socket.disconnect();
    }
  }, [userId]);

  const navLinks = [
    { name: "Dashboard", path: "/portal", icon: Home, exact: true },
    { name: "My Gallery", path: "/portal/gallery", icon: Image },
    { name: "Concierge", path: "/portal/chats", icon: MessageSquare, hasUnread: unreadCount > 0 },
    { name: "The Vault", path: "/portal/cloud", icon: Cloud },
  ];

  return (
    <div className="w-[280px] lg:w-[260px] h-full lg:h-[calc(100vh-40px)] m-0 lg:m-5 lg:ml-8 lg:mt-6 relative z-50 flex flex-col bg-white rounded-none lg:rounded-[32px] border-r lg:border border-black/[0.03] shadow-2xl lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden py-10 px-6 animate-in slide-in-from-left-4 duration-700">
      
      <div className="mb-14 px-2 flex justify-between items-center text-center mx-auto">
        <Link to="/portal" className="flex flex-col gap-0 group items-center">
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
          <div className="text-center mt-[-12px]">
            <span className="block text-[13px] font-bold tracking-[0.3em] uppercase text-stone-800 transition-colors group-hover:text-luxury-gold">Team Alpha</span>
            <span className="block text-[7px] tracking-[0.2em] font-medium uppercase text-stone-400 mt-1">High-End Wedding Cinema</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-black/5 rounded-full text-stone-400">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-3 px-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.exact}
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `
              relative flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group
              ${isActive 
                ? 'bg-gradient-to-r from-[#FDE8E8] to-[#FDFBF7] text-[#BA6A5D] shadow-[0_4px_20px_rgba(186,106,93,0.15)] border border-[#BA6A5D]/10' 
                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'}
            `}
          >
            {({ isActive }) => (
              <>
                <link.icon size={16} strokeWidth={isActive ? 2 : 1.5} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] relative z-10 flex items-center gap-2">
                  {link.name}
                  {link.hasUnread && (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}>
                      <Bell size={12} className="text-[#BA6A5D] fill-[#BA6A5D]/10" />
                    </motion.div>
                  )}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="pt-6 border-t border-black/5 space-y-4 px-1 pb-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-[#BA6A5D] hover:bg-[#BA6A5D]/10 transition-all duration-300 group"
        >
          <LogOut size={16} strokeWidth={1.5} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Sign Out</span>
        </button>

        <div className="px-5 py-4 bg-stone-50 rounded-[20px] text-center">
            <p className="text-[8px] text-stone-500 uppercase tracking-widest leading-[1.6]">
                Personal Client Portal <br /> <span className="text-stone-800 font-bold">2026 Season</span>
            </p>
            <div className="mt-3 flex justify-center gap-4">
                <a href="https://instagram.com/teamalpha_crew" target="_blank" rel="noreferrer" className="text-stone-400 hover:text-stone-800 transition-colors">
                    <Instagram size={12} strokeWidth={1.5} />
                </a>
            </div>
        </div>
      </div>
    </div>
  );
}
