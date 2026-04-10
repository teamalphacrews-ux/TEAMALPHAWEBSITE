import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FolderOpen, Lock, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';

const Cloud = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/auth/me`, {
                    headers: { 'x-auth-token': token }
                });
                setUser(response.data);
            } catch (err) {
                console.error("Failed to fetch user data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-stone-300 animate-spin" strokeWidth={1} />
                <p className="text-[10px] uppercase tracking-[4px] text-stone-400 font-bold animate-pulse">Syncing with Secure Vault...</p>
            </div>
        );
    }

    const cloudLink = user?.cloudLink || "https://teamalpha.studio/shared-access";
    const cloudPassword = user?.cloudPassword || "WAITING";
    const firstName = user?.firstName || "Client";

    return (
        <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Elegant Header */}
            <header className="mb-12">
                <div className="flex items-center gap-4 mb-4">
                    <div className="h-[1px] w-12 bg-stone-200"></div>
                    <span className="text-[10px] uppercase font-black tracking-[4px] text-stone-400">Secure Assets</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-luxury text-stone-900 tracking-tight mb-6">The Vault</h1>
                <p className="text-stone-500 max-w-xl text-lg font-medium leading-relaxed italic opacity-80">
                    Your high-resolution legacy, preserved in our private encrypted laboratory. Use the credentials below to access your files.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-6xl">
                {/* Clickable Folder Card */}
                <a 
                    href={cloudLink}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative flex flex-col bg-white rounded-[40px] p-10 md:p-14 border border-stone-100 shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-500 overflow-hidden"
                >
                    {/* Decorative Background Element */}
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-blue-50/30 rounded-full blur-[80px] group-hover:bg-blue-100/40 transition-colors duration-700"></div>
                    
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center mb-10 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                            <FolderOpen size={36} className="text-white" strokeWidth={1.5} />
                        </div>
                        
                        <h2 className="text-3xl font-luxury text-stone-900 mb-4 group-hover:text-black transition-colors">
                            {firstName}'s Shared Files
                        </h2>
                        
                        <p className="text-stone-400 font-medium mb-12 max-w-[280px]">
                            Access all your primary cinematic files and high-resolution stills.
                        </p>
                        
                        <div className="flex items-center gap-3 text-stone-900 font-black text-[11px] uppercase tracking-[3px]">
                            <span>Enter Repository</span>
                            <ExternalLink size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                        </div>
                    </div>
                </a>

                {/* Password Section */}
                <div className="flex flex-col bg-stone-50/50 rounded-[40px] p-10 md:p-14 border border-stone-100/50 relative overflow-hidden backdrop-blur-sm">
                    <div className="mb-10 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Lock size={14} className="text-stone-400" />
                                <span className="text-[9px] uppercase font-black tracking-[3px] text-stone-400">Vault Pass</span>
                            </div>
                            <h3 className="text-2xl font-luxury text-stone-900">Access Credentials</h3>
                        </div>
                        <div className="px-4 py-2 bg-white rounded-full border border-stone-100 shadow-sm flex items-center gap-2">
                            <ShieldCheck size={14} className="text-blue-500" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-stone-500">Secure</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <div 
                            style={{ userSelect: 'all' }}
                            className="w-full bg-white border-2 border-dashed border-stone-200 rounded-3xl py-10 px-6 flex items-center justify-center text-3xl md:text-5xl font-mono font-bold tracking-[6px] md:tracking-[12px] text-stone-800 cursor-pointer hover:border-black/20 hover:bg-white transition-all duration-300 active:scale-[0.98] select-all shadow-sm group"
                            title="Click to select all"
                        >
                            {cloudPassword}
                        </div>
                        <p className="mt-8 text-[11px] text-stone-400 font-medium italic text-center">
                            Enter this password precisely if prompted by the storage provider.
                        </p>
                    </div>

                    <div className="mt-12 pt-8 border-t border-stone-200/50 flex items-center gap-4 text-stone-300">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        <span className="text-[9px] uppercase font-black tracking-[2px]">Authorized Access Only</span>
                    </div>
                </div>
            </div>

            {/* Custom Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @font-face {
                    font-family: 'Luxury';
                    src: local('Playfair Display'), local('Serif');
                }
                .font-luxury {
                    font-family: 'Playfair Display', serif;
                }
            `}} />
        </div>
    );
};

export default Cloud;
