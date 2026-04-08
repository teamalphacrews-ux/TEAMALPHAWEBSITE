import React from "react";
import { Link } from "react-router-dom";
import { Menu, Instagram, MessageSquare } from "lucide-react";

export default function Header({ toggleSidebar }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-[120] lg:hidden">
      <div className="mx-auto px-6 py-4">
        <div className="glass-card !rounded-full px-6 py-3 flex items-center justify-between border-white/40 shadow-xl bg-white/70 backdrop-blur-2xl">
          
          {/* Brand */}
          <Link to="/portal" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-150" />
            </div>
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Team Alpha</span>
          </Link>

          {/* Quick Actions & Menu Toggle */}
          <div className="flex items-center gap-4">
            <a href="https://instagram.com/teamalpha_crew" target="_blank" rel="noreferrer" className="text-stone-400 hover:text-stone-800 transition-colors">
                <Instagram size={18} />
            </a>
            
            {/* Mobile Menu Toggle */}
            <button 
              onClick={toggleSidebar}
              className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-full transition-transform active:scale-95 shadow-sm"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
