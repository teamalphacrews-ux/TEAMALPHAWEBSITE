import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { Suspense, lazy, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

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

  return (
    <div className="flex min-h-screen luxury-gradient-bg selection:bg-black selection:text-white overflow-x-hidden">
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
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <ClientHeader toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </div>

        <main className="flex-1 w-full max-w-[1200px] px-6 lg:px-8 py-8 space-y-12">
          <div className="mb-8">
            <Breadcrumbs />
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
