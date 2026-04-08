import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Save } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function EditClientModal({ isOpen, onClose, client, onSuccess }) {
  const [name, setName] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [password, setPassword] = useState('');
  const [selectedClientId, setSelectedClientId] = useState("");
  const [availableClients, setAvailableClients] = useState([]);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setPreview(client.thumbnail);
      setSelectedClientId(client.clientId || "");
      fetchClients();
    }
  }, [client]);

  const fetchClients = async () => {
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/drive-gallery/users/clients`, {
            headers: { 'x-auth-token': token }
        });
        setAvailableClients(res.data);
    } catch (err) {
        console.error("Failed to fetch clients:", err);
    }
  };

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
      const formData = new FormData();
      formData.append('name', name);
      if (password) formData.append('password', password);
      if (selectedClientId) formData.append('clientId', selectedClientId);
      
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }

      await axios.patch(`${API_BASE_URL}/api/drive-gallery/${client._id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        }
      });

      toast.success("Client updated successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update client.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="relative p-8">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={20} />
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Edit Client</h2>
            <p className="text-gray-500 text-sm mt-1">Update collection details</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Client Name</label>
              <input
                type="text"
                placeholder="e.g., Twinkling Knots"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#cfe8d5] focus:border-[#cfe8d5] outline-none transition-all font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Link Client Account</label>
              <select 
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#cfe8d5] focus:border-[#cfe8d5] outline-none transition-all font-medium appearance-none"
              >
                <option value="">Select a registered client (Optional)</option>
                {availableClients.map(client => (
                    <option key={client._id} value={client._id}>
                        {client.firstName} {client.lastName} ({client.email})
                    </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Update Access Password</label>
              <input
                type="text"
                placeholder="Leave blank to keep current"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#cfe8d5] focus:border-[#cfe8d5] outline-none transition-all font-medium"
              />
              <p className="text-[9px] text-[#8a8a8a] italic ml-1 leading-relaxed">Update the secure access code for this client.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a8a] ml-1">Cover Thumbnail</label>
              <div className="relative group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="edit-client-thumb"
                  accept="image/*"
                />
                <label 
                  htmlFor="edit-client-thumb"
                  className="flex flex-col items-center justify-center w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer group-hover:border-[#cfe8d5] group-hover:bg-[#f8fcf9] transition-all overflow-hidden"
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 bg-white rounded-2xl shadow-sm text-[#8a8a8a] group-hover:text-[#2d2d2d] transition-colors">
                        <Upload size={24} />
                      </div>
                      <span className="text-sm font-medium text-gray-500">Change Background</span>
                    </div>
                  )}
                  {preview && (
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="px-4 py-2 bg-white/90 backdrop-blur rounded-xl text-xs font-bold text-[#2d2d2d]">Change Image</div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#2d2d2d] text-white rounded-2xl font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/10"
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
