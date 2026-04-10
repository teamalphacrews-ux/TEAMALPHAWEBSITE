import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Search, Shield, Eye, EyeOff, UserPlus,
  Trash2, Edit3, X, Check, Loader2, Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || "";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'client',
    leadId: '',
    cloudLink: '',
    cloudPassword: ''
  });

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({}); // { userId: boolean }

  const togglePassword = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const token = localStorage.getItem('token');
  const authHeader = { headers: { 'x-auth-token': token } };

  useEffect(() => {
    fetchUsers();
    fetchLeads();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin-users`, authHeader);
      setUsers(res.data);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to fetch users');
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/leads`, authHeader);
      setLeads(res.data);
    } catch (err) {
      console.error('Leads fetch error', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await axios.post(`${API_URL}/api/admin-users/create`, formData, authHeader);
      toast.success('User account created successfully');
      setShowCreateModal(false);
      setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'client', leadId: '', cloudLink: '', cloudPassword: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin-users/${id}`, authHeader);
      toast.success('User removed');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await axios.put(`${API_URL}/api/admin-users/${editingUser._id}`, editingUser, authHeader);
      toast.success('User updated successfully');
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLeadSelect = (leadId) => {
    const lead = leads.find(l => l._id === leadId);
    if (lead) {
      const names = lead.name.split(' ');
      setFormData({
        ...formData,
        leadId: lead._id,
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || '',
        email: lead.email || ''
      });
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen -m-4 md:-m-10 p-6 md:p-12 bg-transparent relative font-sans selection:bg-rose-100 selection:text-rose-900 overflow-visible">
      {/* Immersive Background Layer */}
      <div className="fixed inset-0 bg-[#fdfaf6] -z-20" />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-[#fdf2e9] rounded-full blur-[150px] opacity-80" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] bg-blue-50/30 rounded-full blur-[150px] opacity-60" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px] opacity-50" />
      </div>

      {/* 1. Page Header - Symmetrical Layout */}
      <div className="relative z-10 max-w-7xl mx-auto mb-10 md:mb-16 px-4 md:px-8 pt-6 md:pt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div className="space-y-1.5 translate-x-1">
            <div className="flex items-center gap-5 mb-2">
              <div className="w-1.5 h-12 bg-[#e3ae97] rounded-full shadow-[0_0_25px_rgba(227,174,151,0.4)] animate-pulse" />
              <h1 className="font-luxury text-4xl md:text-7xl text-[#1a1a1a] tracking-tight leading-none">System Registry</h1>
            </div>
            <p className="text-[10px] md:text-[11px] text-stone-400 font-black uppercase tracking-[0.3em] md:tracking-[0.5em] pl-[1.8rem] opacity-70">
              Real-Time User Access <span className="text-stone-300 mx-1">/</span> <span className="text-stone-900">Secure Logs</span>
            </p>
          </div>
          
          <div className="flex items-center gap-6 w-full md:w-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="group w-full md:w-auto px-6 md:px-10 py-3.5 md:py-4 bg-[#1a1a1a] text-white rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] transition-all hover:bg-stone-800 hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] hover:translate-y-[-3px] active:translate-y-0 flex items-center justify-center gap-4 overflow-hidden shadow-xl"
            >
              <UserPlus size={16} className="group-hover:rotate-12 transition-transform duration-300" strokeWidth={1.5} />
              <span className="relative">
                New User
                <span className="absolute bottom-[-3px] left-0 w-full h-[0.5px] bg-white/40 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Unified Master Card - Symmetrical Design */}
      <div className="relative z-10 max-w-7xl mx-auto bg-white rounded-[32px] md:rounded-[56px] shadow-[0_50px_150px_rgba(0,0,0,0.08)] border border-stone-50 overflow-hidden mb-12 md:mb-32 mx-4 md:mx-auto">
        
        {/* Card Header (Symmetric) */}
        <div className="px-6 md:px-16 py-8 md:py-12 border-b border-stone-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white/60 backdrop-blur-xl">
          <div className="flex items-center gap-4 md:gap-6">
            <h3 className="font-luxury text-2xl md:text-4xl text-stone-900">Recent Users</h3>
            <div className="px-3 md:px-5 py-1.5 md:py-2 bg-stone-100 text-stone-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-full border border-stone-200/50">
              {filteredUsers.length} entries
            </div>
          </div>

          {/* Inline Integrated Search */}
          <div className="relative group w-full md:w-96 md:scale-110 md:translate-x-[-1rem]">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 size-4.5" strokeWidth={1} />
            <input
              type="text"
              placeholder="Filter studio repository..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-stone-50/50 border border-transparent focus:border-stone-200 focus:bg-white px-14 py-4 rounded-full text-[14px] transition-all outline-none text-stone-700 placeholder:text-stone-300 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest font-medium"
            />
          </div>
        </div>

        {/* User Content Registry */}
        <div className="overflow-hidden">
          {loading ? (
            <div className="py-32 text-center flex flex-col items-center gap-5">
              <Loader2 className="animate-spin text-stone-200" size={40} strokeWidth={1} />
              <p className="text-[11px] uppercase tracking-[0.4em] text-stone-300 font-black">Syncing Vault...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-32 text-center text-stone-300 text-[11px] uppercase font-black tracking-widest">No matching records found</div>
          ) : (
            <div className="divide-y divide-stone-50/80">
              {filteredUsers.map((user, index) => (
                <motion.div
                  key={user._id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="relative flex flex-col md:grid md:grid-cols-12 items-start md:items-center px-6 md:px-16 py-8 transition-all hover:bg-stone-50/60 group border-l-[6px] border-transparent hover:border-l-[#e3ae9733] gap-6 md:gap-0"
                >
                  {/* Identity */}
                  <div className="col-span-4 flex items-center gap-6 md:gap-8 w-full">
                    <div className="w-12 h-12 md:w-13 md:h-13 flex-shrink-0 rounded-2xl md:rounded-3xl bg-stone-100 border border-stone-200/50 flex items-center justify-center font-serif text-[16px] md:text-[18px] text-stone-800 font-bold shadow-sm group-hover:shadow-md transition-all group-hover:scale-105">
                      {user.firstName?.[0] || user.email?.[0] || '?'}{user.lastName?.[0] || ''}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-[15px] md:text-[16px] font-black text-stone-800 tracking-tight leading-none group-hover:text-black transition-colors truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[11px] md:text-[12px] text-stone-400 font-medium tracking-tight truncate max-w-[200px] md:max-w-[240px]">{user.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="col-span-2 flex md:block items-center gap-3">
                    <span className="md:hidden text-[8px] font-bold uppercase tracking-widest text-stone-300">Role:</span>
                    <span className={`inline-flex items-center px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[8.5px] font-black uppercase tracking-[0.25em] border shadow-sm ${user.role === 'admin'
                      ? 'bg-stone-900 border-stone-800 text-white'
                      : 'bg-white border-stone-100 text-stone-400'
                      }`}>
                      {user.role}
                    </span>
                  </div>

                  {/* Association Status */}
                  <div className="col-span-3 flex md:block items-center gap-3">
                    <span className="md:hidden text-[8px] font-bold uppercase tracking-widest text-stone-300">Status:</span>
                    {user.leadId ? (
                      <div className="inline-flex items-center gap-2.5 px-4 md:px-5 py-1.5 md:py-2 bg-white border border-stone-100/50 rounded-2xl text-stone-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest shadow-sm">
                        <LinkIcon size={10} strokeWidth={2} className="text-[#e3ae97]" />
                        <span>Attached</span>
                      </div>
                    ) : (
                      <span className="text-stone-300 md:text-stone-200 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-60 md:opacity-30 select-none">Solo Vault</span>
                    )}
                  </div>

                  {/* Vault Entry */}
                  <div className="col-span-2 flex md:block items-center gap-3 w-full md:w-auto">
                    <span className="md:hidden text-[8px] font-bold uppercase tracking-widest text-stone-300">Vault:</span>
                    <div className="flex items-center gap-3 group/pass flex-1 md:flex-initial">
                      <div className="bg-stone-50/80 px-4 md:px-5 py-2 rounded-2xl text-[12px] font-mono font-medium text-stone-500 border border-transparent min-w-[100px] md:min-w-[120px] flex justify-center tracking-widest relative overflow-hidden group-hover/pass:bg-white group-hover/pass:border-stone-100 transition-all shadow-sm">
                        {visiblePasswords[user._id] ? (user.plainPassword || 'UNSET') : '••••••••'}
                      </div>
                      <button
                        onClick={() => togglePassword(user._id)}
                        className="p-2 text-stone-300 hover:text-stone-800 transition-all opacity-100 md:opacity-40 md:group-hover:opacity-100 md:scale-110"
                        title="Display Code"
                      >
                        {visiblePasswords[user._id] ? <EyeOff size={16} strokeWidth={1} /> : <Eye size={16} strokeWidth={1} />}
                      </button>
                    </div>
                  </div>

                  {/* Registry Actions */}
                  <div className="col-span-1 flex items-center justify-start md:justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 md:translate-x-2 md:group-hover:translate-x-0 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-stone-50">
                    <button
                      onClick={() => {
                        setEditingUser({ ...user, password: user.plainPassword });
                        setShowEditModal(true);
                      }}
                      className="flex-1 md:flex-none p-3.5 bg-white text-stone-400 hover:text-stone-900 border border-stone-100/50 hover:border-stone-200 rounded-[18px] shadow-sm md:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-0"
                    >
                      <Edit3 size={17} strokeWidth={1} />
                      <span className="md:hidden text-[10px] font-black uppercase tracking-widest">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(user._id)}
                      className="flex-1 md:flex-none p-3.5 bg-white text-stone-400 hover:text-red-500 border border-stone-100/50 hover:border-red-100 rounded-[18px] shadow-sm md:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-0"
                    >
                      <Trash2 size={17} strokeWidth={1} />
                      <span className="md:hidden text-[10px] font-black uppercase tracking-widest">Remove</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Create User Modal - Balanced Boutique Design */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-stone-900/10 backdrop-blur-[4px]" />
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative bg-white w-full max-w-xl rounded-[48px] shadow-[0_50px_120px_rgba(0,0,0,0.12)] border border-stone-50 flex flex-col max-h-[85vh]"
            >
              {/* Internal Header */}
              <div className="px-6 md:px-10 pt-8 md:pt-10 pb-4 flex justify-between items-center bg-white z-10 rounded-t-[48px]">
                <div className="flex items-center gap-4 md:gap-5">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-lg">
                    <Plus size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="font-luxury text-2xl md:text-3xl text-stone-900 tracking-tight leading-none">Initialize</h2>
                    <p className="text-[7.5px] md:text-[8.5px] font-black uppercase tracking-[2px] md:tracking-[3px] text-stone-300 mt-1.5">New Access Protocol</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-3 rounded-full hover:bg-stone-50 transition-colors text-stone-300 hover:text-stone-900">
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-6">
                <form onSubmit={handleCreate} className="space-y-6 py-4">
                  <div className="space-y-2.5">
                    <label className="text-[9px] font-black uppercase tracking-[2px] text-stone-300 ml-5 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#e3ae97]" />
                      Association
                    </label>
                    <div className="relative group">
                      <select
                        onChange={(e) => handleLeadSelect(e.target.value)}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[24px] outline-none focus:bg-white focus:border-stone-200 focus:shadow-sm transition-all text-[14px] font-medium appearance-none cursor-pointer pr-12"
                      >
                        <option value="">Search lead repository...</option>
                        {leads.map(lead => (
                          <option key={lead._id} value={lead._id}>
                            {lead.name} — {lead.phone}
                          </option>
                        ))}
                      </select>
                      <Plus className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-300 size-4" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">First Name</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Last Name</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Primary Email Path</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="example@studio.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[24px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium placeholder:text-stone-200" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Permissions</label>
                      <select 
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 appearance-none cursor-pointer text-[11px] font-black uppercase tracking-widest"
                      >
                        <option value="client">Client Agent</option>
                        <option value="admin">System Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Vault Pass</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="Generate..."
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium placeholder:text-stone-200" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Cloud Link (Gallery/Drive)</label>
                      <input 
                        type="url" 
                        placeholder="https://..."
                        value={formData.cloudLink}
                        onChange={(e) => setFormData({...formData, cloudLink: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium placeholder:text-stone-200" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Cloud Password</label>
                      <input 
                        type="text" 
                        placeholder="External Pass..."
                        value={formData.cloudPassword}
                        onChange={(e) => setFormData({...formData, cloudPassword: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium placeholder:text-stone-200" 
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      disabled={isCreating}
                      className="w-full py-5 bg-stone-900 text-white rounded-[28px] text-[12px] font-black uppercase tracking-[4px] hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-4 group"
                    >
                      {isCreating ? 'Synchronizing...' : 'Authorize Registry'}
                      <Check size={18} className="opacity-40 group-hover:opacity-100 transition-all" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Edit User Modal - Balanced Boutique Design */}
      <AnimatePresence>
        {showEditModal && editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-stone-900/10 backdrop-blur-[4px]" />
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative bg-white w-full max-w-xl rounded-[48px] shadow-[0_50px_120px_rgba(0,0,0,0.12)] border border-stone-50 flex flex-col max-h-[85vh]"
            >
              {/* Internal Header */}
              <div className="px-10 pt-10 pb-4 flex justify-between items-center bg-white z-10 rounded-t-[48px]">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#e3ae97] text-white flex items-center justify-center shadow-lg">
                    <Shield size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="font-luxury text-3xl text-stone-900 tracking-tight leading-none">Re-Authorize</h2>
                    <p className="text-[8.5px] font-black uppercase tracking-[3px] text-stone-300 mt-1.5">Modify User Protocol</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-3 rounded-full hover:bg-stone-50 transition-colors text-stone-300 hover:text-stone-900">
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-6">
                <form onSubmit={handleUpdate} className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">First Name</label>
                      <input 
                        type="text" 
                        required 
                        value={editingUser.firstName}
                        onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Last Name</label>
                      <input 
                        type="text" 
                        required 
                        value={editingUser.lastName}
                        onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Email Path</label>
                    <input 
                      type="email" 
                      required 
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                      className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[24px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Access Level</label>
                      <select 
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 appearance-none cursor-pointer text-[11px] font-black uppercase tracking-widest"
                      >
                        <option value="client">Client</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Vault Pass</label>
                      <input 
                        type="password" 
                        placeholder="Leave blank to keep"
                        value={editingUser.password || ''}
                        onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Cloud Link</label>
                      <input 
                        type="url" 
                        value={editingUser.cloudLink || ''}
                        onChange={(e) => setEditingUser({...editingUser, cloudLink: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[8px] font-black uppercase tracking-[2px] text-stone-300 ml-5">Cloud Password</label>
                      <input 
                        type="text" 
                        value={editingUser.cloudPassword || ''}
                        onChange={(e) => setEditingUser({...editingUser, cloudPassword: e.target.value})}
                        className="w-full px-6 py-4 bg-stone-50/50 border border-stone-100/50 rounded-[20px] outline-none focus:bg-white focus:border-stone-200 transition-all text-[14px] font-medium" 
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      disabled={isUpdating}
                      className="w-full py-5 bg-stone-900 text-white rounded-[28px] text-[12px] font-black uppercase tracking-[4px] hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-4 group"
                    >
                      {isUpdating ? 'Updating Vault...' : 'Confirm Modification'}
                      <Check size={18} className="opacity-40 group-hover:opacity-100 transition-all" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
