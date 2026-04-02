import React from "react";
import { Heart } from "lucide-react";

export default function Footer() {
    return (
        <footer className="pt-24 pb-16 border-t border-black/[0.03]">
            <div className="max-w-[1100px]">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20">
                    <div className="text-left">
                        <span className="block text-[10px] font-bold tracking-[6px] uppercase text-luxury-gold mb-3">Team Alpha Studios</span>
                        <h3 className="font-serif text-3xl italic text-stone-800 leading-tight">Preserving your story, <br /> beyond the frame.</h3>
                    </div>
                    
                    <div className="flex items-center gap-10">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase tracking-widest text-luxury-text-muted mb-2 font-bold">Studio Enquiries</span>
                            <a href="https://wa.me/919110603953" target="_blank" rel="noreferrer" className="text-sm font-light hover:text-luxury-gold transition-colors underline decoration-black/5 decoration-2 underline-offset-8">WhatsApp Support</a>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase tracking-widest text-luxury-text-muted mb-2 font-bold">Connect With Us</span>
                            <a href="https://www.instagram.com/teamalpha_crew/" target="_blank" rel="noreferrer" className="text-sm font-light hover:text-luxury-gold transition-colors underline decoration-black/5 decoration-2 underline-offset-8">Instagram</a>
                        </div>
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
