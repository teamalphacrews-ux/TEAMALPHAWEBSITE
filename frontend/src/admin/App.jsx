import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/common/Layout";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import SmartGallery from "./pages/SmartGallery";
import Finance from "./pages/Finance";
import CalendarPage from "./pages/Calendar";
import ActivityLog from "./pages/ActivityLog";
import Chats from "./pages/Chats";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1C1C1C',
            color: '#F7F5F2',
            borderRadius: '16px',
            fontSize: '12px',
            padding: '16px 24px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="crm" element={<CRM />} />
          <Route path="gallery" element={<SmartGallery />} />
          <Route path="finance" element={<Finance />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="activity-log" element={<ActivityLog />} />
          <Route path="chats" element={<Chats />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}
