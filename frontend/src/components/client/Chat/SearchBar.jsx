import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatSearchBar({ onSearch, placeholder = "Search messages..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    const closeSearch = () => {
        setIsOpen(false);
        setQuery("");
        onSearch("");
    };

    // ESC key support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                closeSearch();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    // Click outside detection
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(e.target)) {
                closeSearch();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSearch = (val) => {
        setQuery(val);
        onSearch(val);
    };

    return (
        <div ref={containerRef} className="flex items-center justify-end relative h-10">
            <AnimatePresence initial={false}>
                {!isOpen ? (
                    <motion.button
                        key="search-btn"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setIsOpen(true)}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-800 hover:bg-black/5 transition-all shadow-sm border border-transparent hover:border-black/5"
                    >
                        <Search size={18} />
                    </motion.button>
                ) : (
                    <motion.div
                        key="search-input"
                        initial={{ width: 40, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 40, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        className="flex items-center bg-[#F7F5F2] rounded-full border border-black/10 px-4 h-10 shadow-sm overflow-hidden"
                    >
                        <Search size={16} className="text-luxury-gold shrink-0 mr-2" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={placeholder}
                            className="bg-transparent border-none outline-none text-sm text-stone-800 w-full placeholder:text-stone-400 font-medium"
                        />
                        {query && (
                            <button 
                                onClick={() => handleSearch("")}
                                className="text-stone-400 hover:text-stone-800 p-1 mx-1"
                            >
                                <X size={14} />
                            </button>
                        )}
                        <button 
                            onClick={closeSearch}
                            className="ml-1 p-1 text-stone-400 hover:text-red-500 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
