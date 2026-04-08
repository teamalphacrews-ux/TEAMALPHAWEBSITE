import { useState, useEffect } from "react";
import axios from "axios";
import { CheckCircle2, Circle, Clock, Plus, Trash2, Loader2, Edit3, Check, X } from "lucide-react";
import toast from "react-hot-toast";

export default function TaskList({ leadId, tasks: initialTasks = [] }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || '';
  const [tasks, setTasks] = useState(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(!leadId && initialTasks.length === 0);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!leadId && initialTasks.length === 0) {
      fetchGlobalTasks();
    } else {
      setTasks(initialTasks);
      setLoading(false);
    }
  }, [leadId, initialTasks]);

  const fetchGlobalTasks = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/tasks`, authHeader);
      setTasks(response.data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
      toast.error("Failed to load global tasks.");
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      let response;
      if (leadId) {
        response = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/leads/${leadId}/tasks`, {
          title: newTaskTitle,
          status: "pending"
        }, authHeader);
      } else {
        // Global task
        response = await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/tasks`, {
          title: newTaskTitle,
          status: "pending"
        }, authHeader);
      }
      setTasks([response.data, ...tasks]);
      setNewTaskTitle("");
      setIsAdding(false);
      toast.success("Task added to workflow.");
    } catch (err) {
      console.error("Failed to add task", err);
      toast.error("Failed to add task.");
    }
  };

  const toggleTask = async (taskId) => {
    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/tasks/${taskId}`, {}, authHeader);
      setTasks(tasks.map(t => t._id === taskId ? response.data : t));
    } catch (err) {
      console.error("Failed to toggle task", err);
      toast.error("Failed to update status.");
    }
  };

  const startEdit = (task) => {
    setEditingId(task._id);
    setEditValue(task.title);
  };

  const saveEdit = async (taskId) => {
    if (!editValue.trim()) return;
    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/tasks/${taskId}`, {
        title: editValue
      }, authHeader);
      setTasks(tasks.map(t => t._id === taskId ? { ...t, title: editValue } : t));
      setEditingId(null);
      toast.success("Task updated.");
    } catch (err) {
      console.error("Failed to update task", err);
      toast.error("Failed to update task.");
    }
  };

  // Note: The taskRoutes.js I created earlier only handled status toggle. 
  // I need to update it to handle title updates too. 
  // I'll do that after this file write.

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/tasks/${taskId}`, authHeader);
      setTasks(tasks.filter(t => t._id !== taskId));
      toast.success("Task cleared.");
    } catch (err) {
      console.error("Failed to delete task", err);
      toast.error("Failed to delete task.");
    }
  };

  if (loading) return (
    <div className="bg-white rounded-3xl border border-[#e6e3df]/40 shadow-sm p-12 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-warmgray" size={32} />
      <p className="text-xs text-warmgray uppercase tracking-widest font-bold">Syncing workflow...</p>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-[#e6e3df]/40 shadow-sm p-8 relative overflow-hidden group h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-ivory rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>

      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h3 className="font-serif text-2xl text-charcoal">Registry Workflow</h3>
          <p className="text-[10px] text-warmgray font-bold uppercase tracking-widest mt-1">
            {tasks.filter(t => t.status !== 'completed').length} pending actions
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-2 rounded-xl transition-all shadow-sm ${isAdding ? 'bg-charcoal text-white' : 'bg-ivory text-warmgray hover:bg-charcoal hover:text-white'}`}
        >
          {isAdding ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={addTask} className="mb-8 animate-in slide-in-from-top-4 duration-300 relative z-10">
          <input
            autoFocus
            type="text"
            placeholder="Input new studio task..."
            className="w-full bg-ivory/50 border border-ivory/80 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <div className="flex justify-end mt-3 gap-2">
            <button
              type="submit"
              className="bg-charcoal text-white text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 rounded-full shadow-lg active:scale-95 transition-all"
            >
              Add to Registry
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4 relative z-10">
        {tasks.length > 0 ? tasks.map((task) => (
          <div key={task._id} className="flex items-center gap-4 group/item p-3 hover:bg-ivory/30 rounded-2xl transition-all border border-transparent hover:border-ivory/50">
            <button
              onClick={() => toggleTask(task._id)}
              className={`transition-all transform active:scale-90 ${task.status === "completed" ? "text-green-500" : "text-warmgray hover:text-charcoal"}`}
            >
              {task.status === "completed" ? (
                <CheckCircle2 size={22} />
              ) : (
                <Circle size={22} />
              )}
            </button>
            <div className="flex-1 min-w-0">
              {editingId === task._id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 bg-white border border-mutedbrown/30 rounded-lg px-3 py-1 text-sm focus:outline-none"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(task._id)}
                  />
                  <button onClick={() => saveEdit(task._id)} className="text-green-600 p-1"><Check size={16} /></button>
                  <button onClick={() => setEditingId(null)} className="text-red-400 p-1"><X size={16} /></button>
                </div>
              ) : (
                <div>
                  <p className={`text-sm truncate transition-all ${task.status === "completed" ? "line-through text-warmgray/60 italic" : "text-charcoal font-medium"}`}>
                    {task.title}
                  </p>
                  {task.lead && !leadId && (
                    <span className="text-[9px] text-mutedbrown/60 uppercase tracking-widest font-bold">
                      Lead: {task.lead.name}
                    </span>
                  )}
                </div>
              )}
            </div>

            {!editingId && (
              <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                <button
                  onClick={() => startEdit(task)}
                  className="p-1.5 text-warmgray hover:text-charcoal transition-all"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => deleteTask(task._id)}
                  className="p-1.5 text-warmgray hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        )) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
            <CheckCircle2 size={48} strokeWidth={1} className="mb-4 text-warmgray" />
            <p className="font-serif italic text-lg">Registry is Clear</p>
            <p className="text-[10px] uppercase tracking-widest font-bold mt-2">All tasks synchronized</p>
          </div>
        )}
      </div>
    </div>
  );
}
