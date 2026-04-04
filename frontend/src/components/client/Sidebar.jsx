import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { 
  Heart, 
  Home, 
  Image, 
  MessageSquare, 
  Cloud, 
  LogOut, 
  Instagram, 
  User,
  X 
} from "lucide-react";
import axios from "axios";
import { io } from "socket.io-client";

export default function ClientSidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

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
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/chats/unread`, {
          headers: { "x-auth-token": token }
        });
        setUnreadCount(res.data.count || 0);
      } catch (err) {
        console.error("Failed to fetch unread chats", err);
      }
    };

    fetchUnread();
    
    // Real-time updates via socket
    const storedUser = JSON.parse(localStorage.getItem("user"));
    const userId = storedUser?.id || storedUser?._id;
    const token = localStorage.getItem("token");

    if (userId && token) {
      const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", { auth: { token } });
      socketRef.current = socket;
      socket.emit("join_chat", userId);

      socket.on("new_message", (msg) => {
        // Industry-Standard: Do NOT re-fetch if we are the sender
        const isOutbound = (msg.sender === userId);
        const isOnChatPage = locationRef.current === '/portal/chats';
        if (msg.recipient === userId && !isOnChatPage && !isOutbound) {
          fetchUnread(); 
        }
      });

      socket.on("chat_seen", (data) => {
        // Reset unread count for the specific conversation
        if (data.chatId === 'admin' || data.chatId === userId) {
          setUnreadCount(0);
        }
      });

      return () => socket.disconnect();
    }
  }, []);

  const navLinks = [
    { name: "Dashboard", path: "/portal", icon: Home, exact: true },
    { name: "My Gallery", path: "/portal/gallery", icon: Image },
    { name: "Concierge", path: "/portal/chats", icon: MessageSquare, count: unreadCount },
    { name: "The Vault", path: "/portal/cloud", icon: Cloud },
  ];

  return (
    <div className="w-[260px] h-[calc(100vh-40px)] m-5 lg:ml-8 lg:mt-6 fixed left-0 top-0 z-[100] flex flex-col bg-white rounded-[32px] border border-black/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden py-10 px-6 animate-in slide-in-from-left-4 duration-700">
      
      <div className="mb-14 px-2 flex justify-between items-center text-center mx-auto">
        <Link to="/portal" className="flex flex-col gap-4 group items-center">
          <div className="w-16 h-16 bg-black rounded-[20px] flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-110 shadow-[0_8px_20px_rgb(0,0,0,0.2)] border border-white/10">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-150" />
          </div>
          <div className="text-center mt-2">
            <span className="block text-[13px] font-bold tracking-[0.3em] uppercase text-stone-800 transition-colors group-hover:text-luxury-gold">Team Alpha</span>
            <span className="block text-[7px] tracking-[0.2em] font-medium uppercase text-stone-400 mt-1.5">High-End Wedding Cinema</span>
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
            onClick={() => {
              if (link.name === "Concierge") {
                setUnreadCount(0);
                // Broadcast to other tabs that we viewed it
                socketRef.current?.emit('chat_seen', 'admin');
              }
              onClose && onClose();
            }}
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
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] relative z-10">
                  {link.name} {link.count > 0 && `(${link.count > 99 ? '99+' : link.count})`}
                </span>
                
                {link.count > 0 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 shadow-lg shadow-red-500/30 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-bounce z-20">
                    {link.count}
                  </span>
                )}
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
