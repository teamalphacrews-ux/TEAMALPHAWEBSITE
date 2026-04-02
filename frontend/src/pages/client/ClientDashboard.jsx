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
                    const res = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/me`, {
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
        <div id="home" className="animate-fade-up">
            {/* Cinematic Hero Banner */}
            <section className="relative h-[280px] rounded-[24px] overflow-hidden mb-10 shadow-2xl">
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105"
                    style={{ backgroundImage: `url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                
                <div className="absolute inset-0 flex items-center px-12 md:px-20">
                    <div className="max-w-xl bg-white/10 backdrop-blur-md border border-white/20 p-8 md:p-10 rounded-3xl animate-slide-in">
                        <span className="text-[10px] uppercase tracking-[4px] text-luxury-gold font-bold mb-3 block">Establishing Timeless Memories</span>
                        <h1 className="text-3xl md:text-5xl text-white mb-6 uppercase tracking-tighter">
                            Welcome back, <span className="font-bold underline decoration-luxury-gold/30">{user?.firstName || "Client"}</span>
                        </h1>
                        <Link to="/portal/gallery" className="btn-luxury-primary inline-flex items-center gap-3 !px-10">
                            Explore Your Stories <Sparkles size={16} />
                        </Link>
                    </div>
                </div>
            </section>
            
            {/* Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {user && (user.cloudLink || user.galleryTag) && <CloudAssets user={user} />}
                <Testimonials />
            </div>

            <section className="mt-10">
                <CTA />
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
                    <div className="grid grid-cols-2 gap-4">
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
        <div className="glass-card !p-16 text-left overflow-hidden relative group rounded-3xl border-white/60">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-luxury-gold/5 rounded-full -mr-32 -mt-32 blur-[80px] group-hover:bg-luxury-gold/10 transition-all duration-1000"></div>
            <div className="relative z-10 flex flex-col items-start">
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
