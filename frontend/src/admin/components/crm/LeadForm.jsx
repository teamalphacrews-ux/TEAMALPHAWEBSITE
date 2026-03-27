import { useState } from "react";
import { X, User, Mail, Phone, Calendar, Tag, Save, MapPin, Clock } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function LeadForm({ onClose, onLeadAdded }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "Wedding",
    eventDate: "",
    eventTime: "",
    eventLocation: "",
    status: "New",
    remarks: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/leads`, formData, authHeader);
      onLeadAdded(response.data);
      toast.success("New luxury inquiry added successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to add lead", err);
      toast.error("Failed to add inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-5 border-b border-ivory flex justify-between items-center bg-ivory/20">
          <div>
            <h2 className="font-serif text-2xl text-charcoal">New Inquiry</h2>
            <p className="text-[9px] text-warmgray mt-1 font-bold uppercase tracking-[0.2em]">Add a new luxury potential client</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-warmgray group transition-all">
            <X size={20} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[80vh] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <User size={12} /> Full Name
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Ananya Sharma"
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Mail size={12} /> Email Address
              </label>
              <input
                required
                type="email"
                placeholder="client@example.com"
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Phone size={12} /> Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91 00000 00000"
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Tag size={12} /> Event Type
              </label>
              <select
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all appearance-none"
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
              >
                <option>Wedding</option>
                <option>Pre-Wedding</option>
                <option>Engagement</option>
                <option>Reception</option>
                <option>Fashion Shoot</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Calendar size={12} /> Preferred Date
              </label>
              <input
                type="date"
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Clock size={12} /> Event Time
              </label>
              <input
                type="time"
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                value={formData.eventTime}
                onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <MapPin size={12} /> Event Location
              </label>
              <input
                type="text"
                placeholder="e.g. Taj Lands End, Mumbai"
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                value={formData.eventLocation}
                onChange={(e) => setFormData({ ...formData, eventLocation: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Tag size={12} /> Initial Status
              </label>
              <select
                className="w-full bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all appearance-none"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option>New</option>
                <option>Follow-up</option>
                <option>Meeting</option>
                <option>Negotiation</option>
                <option>Converted</option>
              </select>
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1">
              <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">
                <Tag size={12} /> Remarks / Inquiry Status
              </label>
              <textarea
                placeholder="Details of inquiry, client responses, what is happening..."
                className="w-full h-16 bg-ivory/40 border border-[#e6e3df] rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all resize-none"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-ivory/20 p-4 rounded-xl border border-ivory/50">
            <div className="col-span-full text-[10px] font-bold uppercase tracking-widest text-mutedbrown mb-1">Payment Plan</div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold tracking-widest text-warmgray ml-1">Total Value (₹)</label>
              <input
                type="number"
                placeholder="0"
                className="w-full bg-white border border-[#e6e3df] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown"
                value={formData.totalAmount || ''}
                onChange={e => setFormData({ ...formData, totalAmount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold tracking-widest text-warmgray ml-1">Deposit (₹)</label>
              <input
                type="number"
                placeholder="0"
                className="w-full bg-white border border-[#e6e3df] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown"
                value={formData.depositAmount || ''}
                onChange={e => setFormData({ ...formData, depositAmount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold tracking-widest text-warmgray ml-1">Payment Status</label>
              <select
                className="w-full bg-white border border-[#e6e3df] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-mutedbrown appearance-none"
                value={formData.paymentStatus || 'Unpaid'}
                onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
              >
                <option>Unpaid</option>
                <option>Deposit Paid</option>
                <option>Paid</option>
              </select>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-charcoal text-white py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-mutedbrown transition-all shadow-md active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            <Save size={16} />
            {loading ? "Adding Lead..." : "Save Inquiry"}
          </button>
        </form>
      </div>
    </div>
  );
}
