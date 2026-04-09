import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { Suspense, lazy, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext';

// Website imports (Lazy loaded for performance)
const Navbar = lazy(() => import('./components/Navbar'));
const Hero = lazy(() => import('./components/Hero'));
const About = lazy(() => import('./components/About'));
const Services = lazy(() => import('./components/Services'));
const Gallery = lazy(() => import('./components/Gallery'));
const Testimonials = lazy(() => import('./components/Testimonials'));
const Contact = lazy(() => import('./components/Contact'));
const Footer = lazy(() => import('./components/Footer'));
const GetQuote = lazy(() => import('./components/GetQuote'));
const AuthPage = lazy(() => import('./components/AuthPage'));

import ProtectedRoute from './components/ProtectedRoute';
import Breadcrumbs from './components/common/Breadcrumbs';
import PageTransition from './components/common/PageTransition';

// Portal imports
import ClientDashboard from './pages/client/ClientDashboard';
const ClientGallery = lazy(() => import('./pages/client/Gallery'));
const Chats = lazy(() => import('./pages/client/Chats'));
const Cloud = lazy(() => import('./pages/client/Cloud'));
import ClientHeader from './components/client/Header';
import ClientFooter from './components/client/Footer';
import ClientSidebar from './components/client/Sidebar';

// Admin imports
import AdminLayout from './admin/components/common/Layout';
const AdminDashboard = lazy(() => import('./admin/pages/Dashboard'));
const AdminCRM = lazy(() => import('./admin/pages/CRM'));
const AdminSmartGallery = lazy(() => import('./admin/pages/SmartGallery'));
const AdminFinance = lazy(() => import('./admin/pages/Finance'));
const AdminCalendarPage = lazy(() => import('./admin/pages/Calendar'));
const AdminActivityLog = lazy(() => import('./admin/pages/ActivityLog'));
const AdminChats = lazy(() => import('./admin/pages/Chats'));
const AdminDriveGalleryDetail = lazy(() => import('./admin/pages/DriveGalleryDetail'));
const AdminClientEvents = lazy(() => import('./admin/pages/ClientEvents'));

const PortalLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();

  // Subtle warm yellow and red gradient blending into white
  const clientBackgroundStyle = {
      background: `
          radial-gradient(circle at top left, rgba(255, 235, 133, 0.6) 0%, rgba(253, 251, 247, 0) 50%),
          radial-gradient(circle at top right, rgba(255, 182, 193, 0.5) 0%, rgba(253, 251, 247, 0) 50%),
          #FDFBF7
      `,
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
  };

  return (
    <div 
        className="flex h-screen selection:bg-black selection:text-white overflow-hidden font-sans text-stone-900" 
        style={clientBackgroundStyle}
    >
      {/* Sidebar - Hidden on mobile, fixed on desktop */}
      <div className="hidden lg:block w-[320px] shrink-0 sticky top-0 h-screen">
        <ClientSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Content */}
      <div className={`fixed inset-y-0 left-0 z-[200] lg:hidden transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <ClientSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <ClientHeader toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </div>

        <main className="flex-1 w-full max-w-[1200px] px-4 md:px-6 lg:px-8 py-6 lg:py-8 space-y-8 lg:space-y-12 pt-24 lg:pt-8 mx-auto">
          <div className="mb-8 flex justify-between items-center relative z-50">
            <Breadcrumbs />

            {/* Top Right Profile Widget */}
            <div className="hidden sm:flex items-center gap-3 bg-white/30 backdrop-blur-xl px-4 py-2 rounded-[20px] border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.03)] hover:bg-white/50 transition-all cursor-default">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-800 to-black text-[#D4AF37] flex items-center justify-center font-serif text-sm border border-stone-700 shadow-inner">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0) || ''}
                </div>
                <div className="text-left pr-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-800 leading-tight">
                    {user ? `${user.firstName} ${user.lastName}` : "Client User"}
                  </p>
                  <p className="text-[7px] uppercase tracking-[0.2em] text-stone-500 font-medium">
                    {user?.email || "Studio Guest"}
                  </p>
                </div>
            </div>
          </div>
          
          <PageTransition>
            <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-xl opacity-50">Loading Portal...</div>}>
              <Outlet />
            </Suspense>
          </PageTransition>

          <div className="pt-20">
            <ClientFooter />
          </div>
        </main>
      </div>
    </div>
  );
};

import { Toaster } from 'react-hot-toast';

function App() {
  const location = useLocation();

  return (
    <div className="font-sans text-[#1C1C1C] bg-[#F7F5F2] min-h-screen selection:bg-black selection:text-white">
      <Toaster position="top-right" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-xl">Loading...</div>}>
        <AnimatePresence mode="wait">
          <Routes location={location}>
            {/* Main Website Routes */}
            <Route path="/" element={
              <>
                <Navbar />
                <Hero />
                <About />
                <Services />
                <Gallery />
                <Testimonials />
                <Contact />
                <Footer />
              </>
            } />
            <Route path="/quote" element={<><Navbar /><GetQuote /><Footer /></>} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected Portal Routes (Clients) */}
            <Route element={<ProtectedRoute allowedRoles={['client']} />}>
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<ClientDashboard />} />
                <Route path="gallery" element={<ClientGallery />} />
                <Route path="chats" element={<Chats />} />
                <Route path="cloud" element={<Cloud />} />
              </Route>
            </Route>

            {/* Protected Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="crm" element={<AdminCRM />} />
                <Route path="gallery" element={<AdminSmartGallery />} />
                <Route path="gallery/:id" element={<AdminClientEvents />} />
                <Route path="gallery/event/:eventId" element={<AdminDriveGalleryDetail />} />
                <Route path="finance" element={<AdminFinance />} />
                <Route path="calendar" element={<AdminCalendarPage />} />
                <Route path="activity-log" element={<AdminActivityLog />} />
                <Route path="chats" element={<AdminChats />} />
              </Route>
            </Route>
            {/* Catch-All Route for invalid URLs */}
            <Route path="*" element={<AuthPage />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default App;
