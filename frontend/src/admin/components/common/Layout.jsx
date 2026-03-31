import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Menu, X } from "lucide-react";
import Breadcrumbs from "../../../components/common/Breadcrumbs";
import PageTransition from "../../../components/common/PageTransition";


export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    
    // Header Scroll Visibility Logic (Matches Topbar)
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    
                    if (currentScrollY < 10) {
                        setIsVisible(true);
                    } else if (currentScrollY > lastScrollY.current) {
                        setIsVisible(false);
                    } else if (currentScrollY < lastScrollY.current - 5) {
                        setIsVisible(true);
                    }
                    
                    lastScrollY.current = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const backgroundStyle = useMemo(() => ({
        background: `
            radial-gradient(circle at top left, #CFE8D5 0%, transparent 40%),
            radial-gradient(circle at top right, #F6E6B4 0%, transparent 40%),
            radial-gradient(circle at bottom left, #D9CDEB 0%, transparent 40%),
            #FFFFFF
        `,
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
    }), []);

    return (
        <div 
            className="flex min-h-screen font-sans selection:bg-mutedbrown/20 relative"
            style={backgroundStyle}
        >
            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .floating-card-animation {
                    animation: fadeIn 0.4s ease forwards;
                }
                `}
            </style>

            {/* Desktop Sidebar Container (Floating) */}
            {!isFocusMode && (
                <div className="hidden lg:block fixed left-0 top-0 h-screen z-50 p-5 pointer-events-none">
                    <div className="h-full pointer-events-auto floating-card-animation">
                        <Sidebar />
                    </div>
                </div>
            )}

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && !isFocusMode && (
                <div
                    className="lg:hidden fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-90 animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar Content */}
            {!isFocusMode && (
                <div className={`
                    lg:hidden fixed left-0 top-0 h-screen z-100 transition-transform duration-500 ease-in-out p-4
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}>
                    <div className="h-full floating-card-animation">
                        <Sidebar onClose={() => setIsSidebarOpen(false)} />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex-1 transition-all duration-500 flex flex-col min-w-0 ${!isFocusMode ? "lg:ml-[280px]" : "ml-0"}`}>
                <div className={`sticky top-0 z-40 transition-all duration-500 pt-8 px-10 pb-4 flex items-center justify-between ${isFocusMode || !isVisible ? "opacity-0 -translate-y-full pointer-events-none" : "opacity-100 translate-y-0"}`}>
                    <div className={`floating-card-animation transition-all duration-700 ${isVisible ? "opacity-100 translate-y-[6px]" : "opacity-0 -translate-y-10 pointer-events-none"}`}>
                        {!isFocusMode && <Breadcrumbs />}
                    </div>
                    <div className="floating-card-animation">
                        <Topbar onMenuClick={() => setIsSidebarOpen(true)} isVisibleProp={isVisible} />
                    </div>
                </div>

                <main className={`w-full mx-auto transition-all duration-500 ${isFocusMode ? "p-0 max-w-none h-screen flex flex-col justify-center" : "px-4 pt-24 md:px-10 lg:px-12 max-w-[1600px] animate-in fade-in slide-in-from-top-4 duration-1000"}`}>
                    <PageTransition>
                        <Suspense fallback={<div className="flex h-64 w-full items-center justify-center text-xl opacity-50">Loading Dashboard...</div>}>
                            <Outlet context={{ setIsFocusMode }} />
                        </Suspense>
                    </PageTransition>
                </main>

                {!isFocusMode && (
                    <footer className="mt-auto p-8 border-t border-[#e6e3df] text-center">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-warmgray font-bold">
                            Team Alpha Photography © 2026 • Luxury Studio Management
                        </p>
                    </footer>
                )}
            </div>
        </div>
    );
}
