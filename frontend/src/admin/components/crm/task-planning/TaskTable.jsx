import React from 'react';
import TaskRow from "./TaskRow";
import { Plus } from "lucide-react";
import { addTask } from "./taskService";
import toast from "react-hot-toast";

const TaskTable = ({ tasks, setTasks, isAdmin, onRefresh }) => {

  const handleAddNewRow = async () => {
    if (!isAdmin) return;
    const newTask = {
      clientName: "New Client",
      event: "Wedding",
      date: new Date().toISOString().split('T')[0],
      photos: "Yet to Start",
      video: "Yet to Start",
      editor: "",
      highlights: "Yet to Start",
      highlightsBy: "",
      album: "Yet to Start",
      albumBy: "",
      print: "Yet to Start",
      deadline: ""
    };

    try {
      await addTask(newTask);
      toast.success("New task added to Google Sheets");
      onRefresh();
    } catch (err) {
      toast.error("Failed to add task");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e6e3df]/40 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-4 md:p-6 border-b border-[#f0f0f0] flex items-center justify-between bg-ivory/10">
        <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-charcoal flex items-center gap-2">
          Team Alpha Planning Grid
          <span className="bg-white text-mutedbrown border border-ivory px-2 py-0.5 rounded-full text-[8px]">
            {tasks.length} Active Records
          </span>
        </h3>
        {isAdmin && (
          <button
            onClick={handleAddNewRow}
            className="flex items-center gap-2 bg-charcoal text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all shadow-md active:scale-95"
          >
            <Plus size={14} />
            Add New Entry
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-ivory/30 border-b border-ivory text-[9px] md:text-[10px] uppercase tracking-widest text-warmgray font-bold">
              <th className="px-4 py-4 min-w-[200px] border-r border-ivory/40">Client Profile</th>
              <th className="px-4 py-4 min-w-[120px] border-r border-ivory/40">Event Type</th>
              <th className="px-4 py-4 min-w-[120px] border-r border-ivory/40">Event Date</th>
              <th className="px-4 py-4 min-w-[130px] border-r border-ivory/40 text-center">Photos Drive</th>
              <th className="px-4 py-4 min-w-[130px] border-r border-ivory/40 text-center">Edited Video</th>
              <th className="px-4 py-4 min-w-[120px] border-r border-ivory/40">Assigned To</th>
              <th className="px-4 py-4 min-w-[130px] border-r border-ivory/40 text-center">Highlights</th>
              <th className="px-4 py-4 min-w-[120px] border-r border-ivory/40">Assigned (HL)</th>
              <th className="px-4 py-4 min-w-[130px] border-r border-ivory/40 text-center">Album</th>
              <th className="px-4 py-4 min-w-[120px] border-r border-ivory/40">Album (By)</th>
              <th className="px-4 py-4 min-w-[130px] border-r border-ivory/40 text-center">Print</th>
              <th className="px-4 py-4 min-w-[120px]">Deadline</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-ivory text-xs">
            {tasks.length > 0 ? tasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                tasks={tasks}
                setTasks={setTasks}
                isAdmin={isAdmin}
              />
            )) : (
              <tr>
                <td colSpan="12" className="px-8 py-32 text-center text-warmgray italic opacity-60">
                   No planning records found for this period. 
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskTable;
