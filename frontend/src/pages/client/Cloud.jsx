import React, { useState, useEffect } from 'react';
import { FolderOpen, Lock, Unlock, ArrowRight, ShieldCheck, Download, ExternalLink, Info } from 'lucide-react';

const Cloud = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [passwordInput, setPasswordInput] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/auth/me`, {
                        headers: { 'x-auth-token': token }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setUser(data);
                    }
                }
            } catch (err) {
                console.error("Error fetching user for cloud:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    const handleUnlock = () => {
        if (!passwordInput) return;
        setIsUnlocking(true);
        // Luxury simulated delay
        setTimeout(() => {
            setIsUnlocking(false);
            setIsUnlocked(true);
        }, 1500);
    };

    const cloudLink = user?.cloudLink || "https://teamalpha.studio/shared";
    const cloudPassword = user?.cloudPassword || "WAITING...";

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-luxury-gold uppercase tracking-[4px] text-[10px] font-bold">Accessing Secure Vault...</div>
        </div>
    );

    return (
        <div className="flex flex-col w-full animate-fade-up">
            {/* Page Header */}
            <header className="text-left mb-10">
                <h1 className="text-4xl md:text-5xl mb-4 uppercase tracking-[8px] font-light text-stone-800">The Vault</h1>
                <div className="h-1 w-20 bg-gradient-to-r from-luxury-gold to-luxury-gold/20 rounded-full"></div>
                <p className="text-luxury-text-muted italic max-w-2xl text-base mt-6">
                    Your high-resolution legacy, preserved in our private encrypted laboratory.
                </p>
            </header>

            <div className="max-w-[850px] w-full mx-auto">
                {!isUnlocked ? (
                    <div className="glass-card hover-lift p-6 md:p-10 text-left animate-fade-up border-white/40 shadow-2xl relative overflow-hidden border-l-[6px] border-l-luxury-gold/50">
                        <div className="icon-wrapper !w-24 !h-24 mx-auto mb-10 bg-gradient-to-br from-luxury-gold/20 to-white/5 shadow-luxury-gold/20 shadow-2xl">
                            <FolderOpen size={48} className="text-luxury-gold animate-breathe" strokeWidth={1.5} />
                        </div>
                        
                        <div className="text-center mb-10">
                            <h2 className="text-2xl mb-3 font-light tracking-tight uppercase text-stone-800">Secure Access</h2>
                            <p className="text-[10px] uppercase tracking-[4px] text-luxury-text-muted font-bold">
                                Encrypted Vault Entry
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-luxury-gold transition-colors" size={18} />
                                <input 
                                    type="password" 
                                    placeholder="Enter Vault Password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="w-full bg-white/50 border border-white/80 rounded-full py-4 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-luxury-gold/10 focus:border-luxury-gold/30 transition-all font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal text-stone-800"
                                />
                            </div>

                            <button 
                                onClick={handleUnlock}
                                disabled={!passwordInput || isUnlocking}
                                className="btn-luxury-primary w-full flex items-center justify-center gap-3 disabled:opacity-20 py-4"
                            >
                                {isUnlocking ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Authorizing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Unlock Vault</span>
                                        <Unlock size={16} />
                                    </>
                                )}
                            </button>
                            
                            <div className="pt-4 flex items-center justify-center gap-2 text-[9px] uppercase tracking-[3px] text-stone-400 font-medium">
                                <ShieldCheck size={14} className="text-green-500/50" /> Secure Protocol
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-6 md:p-10 animate-fade-up border-luxury-gold/20 shadow-2xl border-l-[6px] border-l-green-500/50">
                        <div className="flex items-center justify-between mb-10 pb-6 border-b border-black/5">
                            <div className="flex items-center gap-5">
                                <div className="icon-wrapper !w-12 !h-12 bg-green-500/10 border-green-500/20">
                                    <Unlock size={20} className="text-green-600" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium text-stone-800 tracking-tight">Vault Unlocked</h2>
                                    <p className="text-[9px] uppercase tracking-[3px] text-green-600 font-bold">Authorized</p>
                                </div>
                            </div>
                            <div className="bg-luxury-gold/5 px-4 py-2 rounded-full flex items-center gap-2 text-[9px] font-bold uppercase tracking-[3px] text-luxury-gold border border-luxury-gold/10">
                                <Info size={12} /> 2026 Season
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-white/50 border border-white rounded-[2rem] p-6 md:p-8 hover:bg-white transition-all group shadow-sm flex flex-col h-full">
                                <div className="icon-wrapper mb-6 group-hover:scale-110 transition-transform">
                                    <FolderOpen size={24} className="text-luxury-gold" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-lg mb-2 text-stone-800">{user?.firstName || "Client"}'s Private Space</h3>
                                <p className="text-[11px] text-luxury-text-muted mb-8 leading-relaxed italic">
                                    Access all your primary cinematic files and high-resolution stills.
                                </p>
                                <a 
                                    href={cloudLink} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="btn-luxury-primary !py-3.5 !px-8 text-[10px] flex items-center justify-center gap-2 w-fit"
                                >
                                    Access Files <ExternalLink size={14} />
                                </a>
                            </div>

                            <div className="bg-stone-50 rounded-[2rem] p-6 md:p-8 border border-black/[0.03] relative overflow-hidden flex flex-col h-full">
                                <div className="absolute top-0 right-0 p-8 opacity-5 text-luxury-gold">
                                    <Lock size={80} />
                                </div>
                                <span className="block text-[9px] uppercase tracking-[3px] text-stone-400 mb-2 font-bold">Vault Password</span>
                                <div className="text-3xl font-mono font-bold tracking-[8px] text-stone-800 mb-6 antialiased">
                                    {cloudPassword}
                                </div>
                                <div className="p-4 bg-white/60 rounded-2xl flex items-center gap-3 text-[10px] text-stone-500 italic border border-white">
                                    <Download size={14} className="text-luxury-gold" /> Enter this password if prompted.
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsUnlocked(false)}
                            className="mt-12 block w-full text-center text-[9px] uppercase tracking-[4px] text-stone-400 hover:text-black transition-colors font-bold"
                        >
                            Log Out of Vault
                        </button>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .folder-pulse { animation: pulse-gold 3s infinite; }
                @keyframes pulse-gold {
                    0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
                    70% { box-shadow: 0 0 0 20px rgba(212, 175, 55, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
                }
            `}} />
        </div>
    );
};

export default Cloud;
