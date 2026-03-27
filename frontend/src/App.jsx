import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Services from './components/Services';
import Gallery from './components/Gallery';
import Testimonials from './components/Testimonials';
import Contact from './components/Contact';
import GetQuote from './components/GetQuote';
import AuthPage from './components/AuthPage';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Breadcrumbs from './components/common/Breadcrumbs';
import PageTransition from './components/common/PageTransition';

// Portal imports
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientGallery = lazy(() => import('./pages/client/Gallery'));
const Chats = lazy(() => import('./pages/client/Chats'));
const Cloud = lazy(() => import('./pages/client/Cloud'));
import ClientHeader from './components/client/Header';
import ClientFooter from './components/client/Footer';

// Admin imports
import AdminLayout from './admin/components/common/Layout';
const AdminDashboard = lazy(() => import('./admin/pages/Dashboard'));
const AdminCRM = lazy(() => import('./admin/pages/CRM'));
const AdminSmartGallery = lazy(() => import('./admin/pages/SmartGallery'));
const AdminFinance = lazy(() => import('./admin/pages/Finance'));
const AdminCalendarPage = lazy(() => import('./admin/pages/Calendar'));
const AdminActivityLog = lazy(() => import('./admin/pages/ActivityLog'));
const AdminChats = lazy(() => import('./admin/pages/Chats'));

const PortalLayout = () => {
  return (
    <div className="app-container">
      <ClientHeader />
      <main className="content p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <Breadcrumbs />
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <ClientFooter />
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
          <Routes location={location} key={location.pathname}>
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
                <Route path="finance" element={<AdminFinance />} />
                <Route path="calendar" element={<AdminCalendarPage />} />
                <Route path="activity-log" element={<AdminActivityLog />} />
                <Route path="chats" element={<AdminChats />} />
              </Route>
            </Route>
          </Routes>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default App;
