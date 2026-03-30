import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2, Settings2 } from 'lucide-react';
import { getDropdownConfig, updateDropdownConfig } from './taskService';
import toast from 'react-hot-toast';

const DropdownSettingsModal = ({ isOpen, onClose, onUpdate }) => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(null); // type being saved
    const [newOptions, setNewOptions] = useState({});

    useEffect(() => {
        if (isOpen) fetchConfigs();
    }, [isOpen]);

    const fetchConfigs = async () => {
        setLoading(true);
        const data = await getDropdownConfig();
        setConfigs(data);
        setLoading(false);
    };

    const handleAddOption = (type) => {
        const val = newOptions[type];
        if (!val) return;
        
        const updated = configs.map(c => {
            if (c.type === type) {
                return { ...c, options: [...c.options, val] };
            }
            return c;
        });
        setConfigs(updated);
        setNewOptions({ ...newOptions, [type]: "" });
    };

    const handleDeleteOption = (type, index) => {
        const updated = configs.map(c => {
            if (c.type === type) {
                const newOpts = [...c.options];
                newOpts.splice(index, 1);
                return { ...c, options: newOpts };
            }
            return c;
        });
        setConfigs(updated);
    };

    const handleSave = async (type, options) => {
        setSaving(type);
        const res = await updateDropdownConfig(type, options);
        if (res.success) {
            toast.success(`${type.toUpperCase()} options updated`);
            if (onUpdate) onUpdate();
        } else {
            toast.error("Failed to update options");
        }
        setSaving(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/50">
                {/* Header */}
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
                            <Settings2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Column Configurator</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Customize your interactive grid dropdowns</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-emerald-500" size={40} />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Configurations...</p>
                        </div>
                    ) : configs.map((config) => (
                        <div key={config.type} className="bg-slate-50/50 rounded-3xl p-8 border border-slate-200/40 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
                                    <h3 className="text-lg font-black text-slate-700 uppercase tracking-wider">{config.type} list</h3>
                                </div>
                                <button 
                                    onClick={() => handleSave(config.type, config.options)}
                                    disabled={saving === config.type}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {saving === config.type ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                    Save Changes
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {config.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl group transition-all hover:border-red-200 hover:bg-red-50/10 shadow-sm">
                                        <span className="text-[13px] font-bold text-slate-600">{opt}</span>
                                        <button 
                                            onClick={() => handleDeleteOption(config.type, idx)}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 mt-4">
                                <input 
                                    type="text" 
                                    placeholder={`Add new ${config.type}...`}
                                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-6 py-3.5 text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                                    value={newOptions[config.type] || ""}
                                    onChange={(e) => setNewOptions({ ...newOptions, [config.type]: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddOption(config.type)}
                                />
                                <button 
                                    onClick={() => handleAddOption(config.type)}
                                    className="p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-xl active:scale-95"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex justify-end">
                    <button onClick={onClose} className="px-10 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full text-[12px] font-black uppercase tracking-[0.2em] transition-all">
                        Close Settings
                    </button>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }` }} />
        </div>
    );
};

export default DropdownSettingsModal;
