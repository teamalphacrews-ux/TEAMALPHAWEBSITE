import React from "react";
import { Heart, Instagram, Flower } from "lucide-react";

export default function Footer() {
    return (
        <footer className="pt-24 pb-16 relative mt-10">
            {/* Elegant Floral Divider */}
            <div className="absolute top-0 inset-x-0 mx-auto w-full max-w-5xl flex items-center justify-center opacity-80">
                <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-stone-400/60 to-stone-400/60"></div>
                <div className="px-6 flex items-center justify-center text-stone-800 drop-shadow-sm opacity-60">
                    <Flower size={26} strokeWidth={1} className="animate-[spin_12s_linear_infinite]" />
                </div>
                <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-stone-400/60 to-stone-400/60"></div>
            </div>

            <div className="max-w-[1100px] mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20">
                    <div className="text-left">
                        <span className="block text-[10px] font-bold tracking-[6px] uppercase text-luxury-gold mb-3">Team Alpha Studios</span>
                        <h3 className="font-serif text-3xl italic text-stone-800 leading-tight">Preserving your story, <br /> beyond the frame.</h3>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <a 
                            href="https://wa.me/919110603953" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="w-12 h-12 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center text-stone-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200 hover:-translate-y-1 transition-all duration-300 shadow-sm"
                            aria-label="WhatsApp Support"
                            title="WhatsApp Support"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.966-.944 1.162-.175.195-.349.21-.646.06-1.758-.891-3.136-2.03-4.305-3.82-.128-.198.053-.357.251-.663.109-.17.2-.361.298-.543.084-.176.037-.34-.038-.491-.073-.15-.673-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359C5.895 7.154 5 8.169 5 10.187c0 2.016 1.487 3.966 1.696 4.246.21.28 2.872 4.604 7.126 6.326 2.454.996 3.405.86 4.09.722.8-.163 2.193-.896 2.502-1.76.31-.864.31-1.605.218-1.76-.092-.154-.34-.246-.634-.38z"/><path d="M11.963 22c-1.637 0-3.238-.426-4.66-1.233L2 22l1.29-5.127A9.957 9.957 0 012 11.977C2 6.471 6.474 2 11.968 2c2.671 0 5.18.103 7.065 1.986C20.916 5.869 22 8.375 22 11.981 22 17.487 17.502 22 11.963 22z"/></svg>
                        </a>
                        <a 
                            href="https://www.instagram.com/teamalpha_crew/" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="w-12 h-12 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center text-stone-500 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200 hover:-translate-y-1 transition-all duration-300 shadow-sm"
                            aria-label="Instagram"
                            title="Instagram"
                        >
                            <Instagram size={20} strokeWidth={1.5} />
                        </a>
                    </div>
                </div>

                <div className="pt-12 border-t border-black/[0.03] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 text-[10px] text-luxury-text-muted font-medium uppercase tracking-[4px]">
                        Crafted with <Heart size={10} className="text-red-400 fill-red-400 animate-pulse" /> Team Alpha © {new Date().getFullYear()}
                    </div>
                    
                    <div className="flex items-center gap-8 text-[9px] uppercase tracking-[3px] text-stone-400 font-bold">
                        <a href="#" className="hover:text-black transition-colors text-stone-400">Privacy Policy</a>
                        <a href="#" className="hover:text-black transition-colors text-stone-400">Terms of Service</a>
                        <a href="#" className="hover:text-black transition-colors text-stone-400">Client Guidelines</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
