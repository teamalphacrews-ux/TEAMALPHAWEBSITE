import React, { useState, useEffect } from "react";
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

export default function ClientSidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out safely?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

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
        // Clear session if unauthorized to avoid loop spam
        if (err.response?.status === 401) {
          handleLogout();
        }
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { name: "Dashboard", path: "/portal", icon: Home, exact: true },
    { name: "My Gallery", path: "/portal/gallery", icon: Image },
    { name: "Concierge", path: "/portal/chats", icon: MessageSquare, count: unreadCount },
    { name: "The Vault", path: "/portal/cloud", icon: Cloud },
  ];

  return (
    <div className="w-[280px] h-[calc(100vh-40px)] m-5 fixed left-0 top-0 z-[100] flex flex-col glass-card border-white/40 shadow-2xl overflow-hidden py-10 px-6 animate-in slide-in-from-left-4 duration-700">
      
      {/* Brand Identity */}
      <div className="mb-12 px-2 flex justify-between items-center">
        <Link to="/portal" className="flex flex-col gap-4 group">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-110 shadow-lg border border-white/20">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-150" />
          </div>
          <div>
            <span className="block text-xs font-bold tracking-[0.4em] uppercase text-stone-800 transition-colors group-hover:text-luxury-gold">Team Alpha</span>
            <span className="block text-[8px] tracking-[0.4em] uppercase text-luxury-text-muted mt-1">High-End Wedding Cinema</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-black/5 rounded-full text-stone-400">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.exact}
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `
              relative flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group
              ${isActive 
                ? 'bg-black text-white shadow-xl shadow-black/10' 
                : 'text-luxury-text-muted hover:bg-white/40 hover:text-black'}
            `}
          >
            <link.icon size={18} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] relative z-10">{link.name}</span>
            
            {link.count > 0 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-luxury-gold text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-luxury-gold/50">
                {link.count}
              </span>
            )}
            
            {/* Hover Indicator for non-active */}
            {!location.pathname.startsWith(link.path) && (
                <div className="absolute inset-0 bg-gradient-to-r from-luxury-gold/0 to-luxury-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout & Bottom Section */}
      <div className="pt-8 border-t border-black/5 space-y-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-50 hover:text-red-500 transition-all duration-300 group"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Sign Out</span>
        </button>

        <div className="px-5 py-6 bg-white/30 rounded-3xl border border-white/60 text-center">
            <p className="text-[9px] text-stone-400 uppercase tracking-widest leading-relaxed">
                Personal Client Portal <br /> <span className="text-black font-bold">2026 Season</span>
            </p>
            <div className="mt-4 flex justify-center gap-4">
                <a href="https://instagram.com/teamalpha_crew" target="_blank" rel="noreferrer" className="text-stone-300 hover:text-black transition-colors">
                    <Instagram size={14} />
                </a>
            </div>
        </div>
      </div>
    </div>
  );
}
