import { useState, useEffect } from 'react';
import { X, Calendar, Link, Image, Loader2, Save } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function EditEventModal({ isOpen, onClose, event, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    driveLink: '',
    eventDate: ''
  });
  const [thumbnail, setThumbnail] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        // We don't have the original link, but we can reconstruct it from driveFolderId or just let them paste a new one
        driveLink: `https://drive.google.com/drive/folders/${event.driveFolderId}`,
        eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : ''
      });
      setPreview(event.thumbnail);
    }
  }, [event]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnail(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const data = new FormData();
      data.append('name', formData.name);
      data.append('driveLink', formData.driveLink);
      data.append('eventDate', formData.eventDate);
      if (thumbnail) {
        data.append('thumbnail', thumbnail);
      }

      await axios.patch(`${API_BASE_URL}/api/drive-gallery/events/${event._id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        }
      });

      toast.success("Event updated!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update event.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="relative p-8">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={20} />
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Edit Event</h2>
            <p className="text-gray-500 text-sm mt-1">Refine event details and source folder</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Event Name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., Grand Wedding Ceremony"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#cfe8d5] focus:border-[#cfe8d5] outline-none transition-all font-medium"
                  required
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white rounded-xl shadow-sm text-[#8a8a8a]">
                  <Save size={16} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Date */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Event Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({...formData, eventDate: e.target.value})}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#cfe8d5] focus:border-[#cfe8d5] outline-none transition-all font-medium"
                    required
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white rounded-xl shadow-sm text-[#8a8a8a]">
                    <Calendar size={16} />
                  </div>
                </div>
              </div>

              {/* Drive Link */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Drive Link</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://drive.google.com/..."
                    value={formData.driveLink}
                    onChange={(e) => setFormData({...formData, driveLink: e.target.value})}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#cfe8d5] focus:border-[#cfe8d5] outline-none transition-all font-medium text-xs font-mono"
                    required
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white rounded-xl shadow-sm text-[#8a8a8a]">
                    <Link size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="space-y-2 text-center">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1 block text-left">Event Thumbnail</label>
              <input
                type="file"
                className="hidden"
                id="edit-event-thumb"
                accept="image/*"
                onChange={handleFileChange}
              />
              <label
                htmlFor="edit-event-thumb"
                className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-2xl cursor-pointer hover:bg-[#f8fcf9] hover:border-[#cfe8d5] transition-all"
              >
                {preview ? (
                   <img src={preview} alt="Thumb" className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                ) : (
                  <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-[#8a8a8a] border border-gray-100">
                    <Image size={24} />
                  </div>
                )}
                <div className="flex-1 text-left">
                  <span className="text-sm font-bold text-[#2d2d2d] block">Update Thumbnail</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">Recommended size 1200x800</span>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#2d2d2d] text-white rounded-2xl font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/10 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
