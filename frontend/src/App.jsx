import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";

// Public website pages load independently of internal Studio OS routes.
const PublicLayout = lazy(() => import("./public/PublicLayout"));
const LuxuryHome = lazy(() => import("./public/LuxuryHome"));
const Portfolio = lazy(() => import("./public/Portfolio"));
const StoryPage = lazy(() => import("./public/StoryPage"));
const Films = lazy(() => import("./public/Films"));
const Enquiry = lazy(() => import("./public/Enquiry"));
const StudioPage = lazy(() =>
  import("./public/StudioPages").then((module) => ({
    default: module.StudioPage,
  })),
);
const CollectionsPage = lazy(() =>
  import("./public/StudioPages").then((module) => ({
    default: module.CollectionsPage,
  })),
);
const LocationPage = lazy(() =>
  import("./public/StudioPages").then((module) => ({
    default: module.LocationPage,
  })),
);
const LegalPage = lazy(() =>
  import("./public/StudioPages").then((module) => ({
    default: module.LegalPage,
  })),
);
const PublicNotFound = lazy(() =>
  import("./public/StudioPages").then((module) => ({
    default: module.PublicNotFound,
  })),
);
const SharedQuotation = lazy(() => import("./pages/SharedQuotation"));
const AuthPage = lazy(() => import("./components/AuthPage"));

import ProtectedRoute from "./components/ProtectedRoute";

// Admin imports
const AdminLayout = lazy(() => import("./admin/components/common/Layout"));
const AdminDashboard = lazy(() => import("./admin/pages/Dashboard"));
const AdminContacts = lazy(() => import("./admin/pages/Contacts"));
const AdminContactDetail = lazy(() => import("./admin/pages/ContactDetail"));
const AdminStudioProjects = lazy(() => import("./admin/pages/StudioProjects"));
const AdminStudioProjectDetail = lazy(
  () => import("./admin/pages/StudioProjectDetail"),
);
const AdminQuoteTemplates = lazy(() => import("./admin/pages/QuoteTemplates"));
const InvoiceWorkspace = lazy(() => import("./admin/pages/InvoiceWorkspace"));
const PublicInvoice = lazy(() => import("./pages/PublicInvoice"));
const AdminQuotations = lazy(() => import("./admin/pages/Quotations"));
const AdminDataManagement = lazy(() => import("./admin/pages/DataManagement"));
const AdminSettings = lazy(() => import("./admin/pages/Settings"));
const AdminIntegrations = lazy(() => import("./admin/pages/Integrations"));
const AdminEmail = lazy(() => import("./admin/pages/GmailInbox"));
const AdminProjects = lazy(() => import("./admin/pages/Projects"));
const AdminCrew = lazy(() => import("./admin/pages/Crew"));
const AdminPostProduction = lazy(() => import("./admin/pages/PostProduction"));
const AdminCRM = lazy(() => import("./admin/pages/CRM"));
const AdminFinance = lazy(() => import("./admin/pages/Finance"));
const AdminCalendarPage = lazy(() => import("./admin/pages/Calendar"));
const AdminActivityLog = lazy(() => import("./admin/pages/ActivityLog"));
const AdminChats = lazy(() => import("./admin/pages/ProjectSupport"));
const AdminUserManagement = lazy(() => import("./admin/pages/UserManagement"));

import { Toaster } from "react-hot-toast";

function App() {
  const location = useLocation();
  const isStudioPage = location.pathname === "/auth" || location.pathname === "/admin" || location.pathname.startsWith("/admin/");

  return (
    <div className={`font-sans text-[#1C1C1C] ${isStudioPage ? "bg-white" : "bg-[#F7F5F2]"} min-h-screen selection:bg-black selection:text-white`}>
      <Toaster position="top-right" />
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center text-xl">
            Loading...
          </div>
        }
      >
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/quote/:token" element={<SharedQuotation />} />
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/quote-preview/:id" element={<SharedQuotation />} />
            </Route>
            <Route element={<PublicLayout />}>
              <Route index element={<LuxuryHome />} />
              <Route
                path="portfolio"
                element={
                  <main id="public-main" tabIndex={-1}>
                    <Portfolio />
                  </main>
                }
              />
              <Route path="stories/:slug" element={<StoryPage />} />
              <Route
                path="films"
                element={
                  <main id="public-main" tabIndex={-1}>
                    <Films />
                  </main>
                }
              />
              <Route path="studio" element={<StudioPage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="locations/:slug" element={<LocationPage />} />
              <Route path="enquire" element={<Enquiry />} />
              <Route path="privacy" element={<LegalPage type="privacy" />} />
              <Route path="terms" element={<LegalPage type="terms" />} />
              <Route path="*" element={<PublicNotFound />} />
            </Route>
            <Route path="/quote" element={<Navigate to="/enquire" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/portal/*" element={<Navigate to="/" replace />} />

            {/* Protected Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="crm" element={<AdminCRM />} />
                <Route path="quotations" element={<AdminQuotations />} />
                <Route path="contacts" element={<AdminContacts />} />
                <Route path="contacts/:id" element={<AdminContactDetail />} />
                <Route
                  path="studio-projects"
                  element={<AdminStudioProjects />}
                />
                <Route
                  path="studio-projects/:id"
                  element={<AdminStudioProjectDetail />}
                />
                <Route
                  path="quote-templates"
                  element={<AdminQuoteTemplates />}
                />
                <Route path="templates" element={<AdminQuoteTemplates />} />
                <Route path="invoices/new" element={<InvoiceWorkspace />} />
                <Route path="invoices/:id" element={<InvoiceWorkspace />} />
                <Route
                  path="clients"
                  element={<Navigate to="/admin/contacts" replace />}
                />
                <Route path="data" element={<AdminDataManagement />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="integrations" element={<AdminIntegrations />} />
                <Route path="email" element={<AdminEmail />} />
                <Route path="projects" element={<AdminProjects />} />
                <Route path="crew" element={<AdminCrew />} />
                <Route
                  path="post-production"
                  element={<AdminPostProduction />}
                />
                <Route
                  path="gallery/*"
                  element={<Navigate to="/admin/studio-projects" replace />}
                />
                <Route path="finance" element={<AdminFinance />} />
                <Route path="calendar" element={<AdminCalendarPage />} />
                <Route path="activity-log" element={<AdminActivityLog />} />
                <Route path="chats" element={<AdminChats />} />
                <Route path="users" element={<AdminUserManagement />} />
              </Route>
            </Route>
          </Routes>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default App;
