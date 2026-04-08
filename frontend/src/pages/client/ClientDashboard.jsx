import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Quote, FolderOpen, Lock, CheckCircle, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/auth/me`, {
                        headers: { 'x-auth-token': token }
                    });
                    setUser(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch user", err);
            }
        };
        fetchUser();
    }, []);

    return (
        <div id="home" className="animate-fade-up max-w-[1000px] mx-auto pb-20">
            {/* Top Banner: Hero */}
            <section className="relative h-[250px] md:h-[300px] w-full rounded-[24px] overflow-hidden mb-8 shadow-sm group bg-stone-900">
                {/* Background Image on Right */}
                <div className="absolute inset-y-0 right-0 w-3/4">
                    <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-[2000ms] group-hover:scale-105"
                        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-900 via-stone-900/60 to-transparent" />
                </div>
                
                {/* Left Side Content Area */}
                <div className="absolute inset-0 bg-gradient-to-r from-stone-900 via-stone-900/90 to-transparent z-10 w-2/3" />
                
                {/* Soft Warm Top Light Overlay */}
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#fcd34d]/10 rounded-full blur-[100px] pointer-events-none mix-blend-overlay z-20" />

                <div className="relative z-30 h-full flex flex-col justify-center px-8 md:px-14">
                    <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-semibold mb-4 block drop-shadow-sm">
                        Establishing Timeless Memories
                    </span>
                    
                    <h1 className="text-3xl md:text-[42px] text-white mb-8 uppercase tracking-wide font-serif leading-[1.1] drop-shadow-md">
                        Welcome back,<br />
                        {user?.firstName || "Client"}
                    </h1>
                    
                    <Link to="/portal/gallery" className="w-fit inline-flex items-center gap-3 bg-[#181818] hover:bg-black text-white px-6 py-3 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all duration-300">
                        Explore Your Stories <Sparkles size={12} className="text-white relative top-[-1px]" />
                    </Link>
                </div>
            </section>
            
            {/* Bottom Banner: Testimonials */}
            <section className="relative h-[250px] md:h-[300px] w-full rounded-[24px] overflow-hidden shadow-sm group bg-[#F5F2EB]">
                {/* Background Image on Right */}
                <div className="absolute inset-y-0 right-0 w-3/4">
                    <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-[2000ms] group-hover:scale-105"
                        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=2070&auto=format&fit=crop')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#F5F2EB] via-[#F5F2EB]/80 to-transparent" />
                </div>
                
                {/* Left Side Content Area */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#F5F2EB] via-[#F5F2EB]/95 to-transparent z-10 w-2/3" />

                <div className="relative z-30 h-full flex flex-col justify-center px-8 md:px-14">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full border border-[#D4AF37]/30 bg-white/40 shadow-inner flex items-center justify-center font-serif text-[#C4A052] text-sm">
                            99
                        </div>
                        <h3 className="text-[9px] uppercase tracking-[0.3em] text-[#C4A052] font-semibold">
                            A Legacy of Love
                        </h3>
                    </div>

                    <blockquote className="text-2xl md:text-[28px] italic font-serif leading-[1.3] text-stone-800 mb-8 max-w-[600px] drop-shadow-sm">
                        "Team Alpha captured more than just scenes; they captured the <span className="font-bold not-italic">stolen glances</span> and breathless moments."
                    </blockquote>
                    
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/60 border border-[#D4AF37]/20 flex items-center justify-center font-serif text-[#C4A052] text-xs shadow-sm">
                            MA
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-800">Meghna & Arjun</p>
                            <p className="text-[8px] text-stone-500 uppercase tracking-[0.2em] mt-1">Villa Experience, 2025</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

function CloudAssets({ user }) {
    return (
        <div className="glass-card hover-lift flex flex-col items-start text-left">
            <div className="icon-wrapper mb-8">
                <FolderOpen size={24} strokeWidth={1.5} className="text-luxury-gold" />
            </div>
            <h3 className="text-2xl font-light mb-4 uppercase tracking-widest text-stone-800">The Private Vault</h3>
            <p className="text-luxury-text-muted mb-8 leading-relaxed italic text-sm">
                Your high-resolution cinema captures are preserved in our private encrypted vault. 
                Access your legacy with the highest fidelity.
            </p>
            
            <div className="w-full space-y-4">
                {user.cloudLink && (
                    <div className="flex items-center gap-4 bg-white/40 p-5 rounded-2xl border border-white/60">
                        <CheckCircle className="text-green-500" size={24} />
                        <div className="flex-1">
                            <span className="block text-[10px] uppercase tracking-widest text-luxury-text-muted mb-1 font-bold">Status: Collections Ready</span>
                            <a href={user.cloudLink} target="_blank" rel="noreferrer" className="text-luxury-gold font-semibold hover:underline flex items-center gap-2 group italic">
                                Access Full Collection <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>
                )}
                
                {(user.cloudPassword || user.galleryTag) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {user.cloudPassword && (
                            <div className="bg-black/5 p-4 rounded-2xl border border-black/5 flex flex-col gap-1">
                                <span className="text-[9px] uppercase tracking-widest text-luxury-text-muted font-bold">Vault Password</span>
                                <span className="font-mono text-sm font-bold tracking-widest text-stone-800">{user.cloudPassword}</span>
                            </div>
                        )}
                        {user.galleryTag && (
                            <div className="bg-black/5 p-4 rounded-2xl border border-black/5 flex flex-col gap-1">
                                <span className="text-[9px] uppercase tracking-widest text-luxury-text-muted font-bold">Gallery ID</span>
                                <span className="font-mono text-sm font-bold tracking-widest text-stone-800">{user.galleryTag}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function Testimonials() {
    return (
        <div className="glass-card hover-lift flex flex-col items-start text-left">
            <div className="icon-wrapper mb-8">
                <Quote size={24} strokeWidth={1.5} className="text-luxury-gold" />
            </div>
            <h3 className="text-sm uppercase tracking-[4px] text-luxury-gold font-bold mb-6">A Legacy of Love</h3>
            <blockquote className="text-xl md:text-2xl italic font-light leading-[1.6] mb-10 text-stone-700">
                "Team Alpha captured more than just scenes; they captured the <span className="font-bold">stolen glances</span> and breathless moments."
            </blockquote>
            <div className="flex items-center gap-4 mt-auto">
                <div className="w-10 h-10 rounded-full bg-ivory border border-luxury-gold/20 flex items-center justify-center font-serif text-luxury-gold text-xs">MA</div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-800">Meghna & Arjun</p>
                    <p className="text-[9px] text-luxury-text-muted uppercase tracking-widest">Villa Experience, 2025</p>
                </div>
            </div>
        </div>
    );
}

function CTA() {
    return (
        <div className="glass-card !p-8 md:!p-16 text-left overflow-hidden relative group rounded-3xl border-white/60">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-luxury-gold/5 rounded-full -mr-32 -mt-32 blur-[80px] group-hover:bg-luxury-gold/10 transition-all duration-1000"></div>
            <div className="relative z-10 flex flex-col items-start w-full">
                <div className="px-4 py-1.5 bg-luxury-gold/10 text-luxury-gold text-[9px] font-bold uppercase tracking-[4px] rounded-full mb-8">
                    Limited Availability
                </div>
                <h3 className="text-4xl md:text-5xl font-light mb-6 tracking-tight leading-none italic uppercase text-stone-800">Preserve Your Legacy</h3>
                <p className="text-lg text-luxury-text-muted font-light mb-12 max-w-2xl leading-relaxed italic">
                    Our bookings for the 2026/27 season are closing soon. Let's start planning the most beautiful day of your life.
                </p>
                <Link to="/portal/chats" className="btn-luxury-primary !px-12 flex items-center gap-4 group">
                    Message The Studio <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </Link>
            </div>
        </div>
    );
}
