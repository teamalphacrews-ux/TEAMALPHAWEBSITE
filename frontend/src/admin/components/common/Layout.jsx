import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Menu, X } from "lucide-react";
import Breadcrumbs from "../../../components/common/Breadcrumbs";
import PageTransition from "../../../components/common/PageTransition";


export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);

    return (
        <div className="flex bg-ivory min-h-screen font-sans selection:bg-mutedbrown/20 relative">
            {/* Desktop Sidebar */}
            {!isFocusMode && (
                <div className="hidden lg:block fixed left-0 top-0 h-screen overflow-hidden">
                    <Sidebar />
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
                    lg:hidden fixed left-0 top-0 h-screen z-100 transition-transform duration-500 ease-in-out
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}>
                    <Sidebar onClose={() => setIsSidebarOpen(false)} />
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex-1 transition-all duration-500 flex flex-col min-w-0 ${!isFocusMode ? "lg:ml-64" : "ml-0"}`}>
                <div className={`sticky top-0 z-40 transition-all duration-500 ${isFocusMode ? "opacity-0 -translate-y-full pointer-events-none absolute" : "opacity-100 translate-y-0"}`}>
                    <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
                </div>

                <main className={`w-full mx-auto transition-all duration-500 ${isFocusMode ? "p-0 max-w-none h-screen flex flex-col justify-center" : "p-4 md:p-10 lg:p-12 max-w-[1600px] animate-in fade-in slide-in-from-top-4 duration-1000"}`}>
                    <PageTransition>
                        {!isFocusMode && <Breadcrumbs />}
                        <Outlet context={{ setIsFocusMode }} />
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
