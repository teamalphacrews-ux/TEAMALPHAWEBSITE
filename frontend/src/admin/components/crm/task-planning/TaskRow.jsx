import React, { useState } from 'react';
import { STATUS, EVENTS, TEAM, STATUS_COLORS } from "./constants";
import { updateTask } from "./taskService";
import toast from "react-hot-toast";

const TaskRow = ({ task, index, tasks, setTasks, isAdmin }) => {
  const [loading, setLoading] = useState(false);

  const handleChange = async (field, value) => {
    if (!isAdmin || loading) return;
    setLoading(true);

    const updated = [...tasks];
    updated[index][field] = value;
    setTasks(updated);

    try {
      await updateTask(task.id, updated[index]);
      toast.success("Sync successful");
    } catch (err) {
      toast.error("Failed to sync change");
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = (field, value) => {
    const color = STATUS_COLORS[value] || "gray";
    const bgClass = {
      green: 'bg-green-50 text-green-700 border-green-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      yellow: 'bg-amber-50 text-amber-700 border-amber-200',
      gray: 'bg-ivory text-warmgray border-ivory/50'
    }[color] || 'bg-ivory text-warmgray';

    if (!isAdmin) {
      return (
        <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${bgClass}`}>
          {value}
        </span>
      );
    }

    return (
      <select
        value={value}
        onChange={e => handleChange(field, e.target.value)}
        className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border focus:outline-none cursor-pointer transition-all ${bgClass}`}
      >
        {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  };

  const renderDropdown = (field, value, options) => {
    if (!isAdmin) return <span className="text-charcoal font-medium">{value}</span>;
    return (
      <select
        value={value}
        onChange={e => handleChange(field, e.target.value)}
        className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-charcoal font-medium cursor-pointer"
      >
        <option value="">Select...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  };

  const renderInput = (field, value, type = "text") => {
    if (!isAdmin) return <span className="text-charcoal font-medium">{value}</span>;
    return (
      <input
        type={type}
        value={value || ""}
        onChange={e => handleChange(field, e.target.value)}
        className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-charcoal font-medium"
        placeholder="..."
      />
    );
  };

  return (
    <tr className={`hover:bg-ivory/20 transition-all group ${loading ? 'opacity-50' : ''}`}>
      <td className="px-4 py-4 border-r border-ivory/40">
        {renderInput("clientName", task.clientName)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40">
        {renderDropdown("event", task.event, EVENTS)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40">
        {renderInput("date", task.date, "date")}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40 text-center">
        {renderStatus("photos", task.photos)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40 text-center">
        {renderStatus("video", task.video)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40">
        {renderDropdown("editor", task.editor, TEAM)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40 text-center">
        {renderStatus("highlights", task.highlights)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40">
        {renderDropdown("highlightsBy", task.highlightsBy, TEAM)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40 text-center">
        {renderStatus("album", task.album)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40">
        {renderDropdown("albumBy", task.albumBy, TEAM)}
      </td>
      <td className="px-4 py-4 border-r border-ivory/40 text-center">
        {renderStatus("print", task.print)}
      </td>
      <td className="px-4 py-4">
        {renderInput("deadline", task.deadline, "text")}
      </td>
    </tr>
  );
};

export default TaskRow;
