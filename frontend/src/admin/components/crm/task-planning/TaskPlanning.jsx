import React, { useEffect, useState, useCallback } from "react";
import { getSheetData } from "./taskService";
import GoogleSheetsGrid from "./GoogleSheetsGrid";
import MonthTabs from "./MonthTabs";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

const TaskPlanning = ({ user }) => {
  const [data, setData] = useState({ headers: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("All");
  const [error, setError] = useState(null);

  const loadTasks = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const res = await getSheetData();
      // Ensure completely new reference to prevent UI stale state blocks
      if (res && res.headers && res.rows) {
        setData({
          headers: [...res.headers],
          rows: [...res.rows],
          sheetName: res.sheetName
        });
      } else {
        setData({ headers: [], rows: [], sheetName: "Sheet1" });
      }
    } catch (err) {
      setError("Failed to synchronize with Google Sheets.");
      toast.error("Google Sheets Sync Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    // Auto refresh every 5 seconds for real-time feel
    const interval = setInterval(() => {
      loadTasks(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadTasks]);

  // Filtering based on date column (dynamically finding "DATE" column)
  const dateColIdx = data.headers.findIndex(h => h.toUpperCase().includes("DATE"));
  
  const parseDateString = (str) => {
    if (!str) return null;
    const clean = str.toString().trim();
    if (!clean) return null;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const monthIdx = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      return new Date(year, monthIdx, day);
    }

    // Fallback to standard JS parsing (ISO etc)
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredRows = data.rows.filter(row => {
    if (month === "All") return true;
    
    // Fallback to index 2 if "DATE" column header not found
    const targetIdx = dateColIdx !== -1 ? dateColIdx : 2;
    const dateVal = row.values[targetIdx];
    
    const parsedDate = parseDateString(dateVal);
    if (!parsedDate) return true; // Show empty/unparseable rows to keep them visible

    try {
      const taskMonth = parsedDate.toLocaleString("default", { month: "short" });
      return taskMonth.toUpperCase() === month.toUpperCase();
    } catch (e) { 
      return true; 
    }
  });

  const filteredData = { ...data, rows: filteredRows };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-charcoal">Studio Tasks</h2>
          <p className="text-[10px] text-warmgray uppercase tracking-[0.2em] font-bold mt-1"> Google Sheets Real-time Synchronization </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="p-3 text-warmgray hover:text-charcoal hover:bg-white rounded-full border border-transparent hover:border-ivory transition-all shadow-sm group"
            title="Refresh Grid"
          >
            <RefreshCw size={18} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
        </div>
      </div>

      {loading && data.rows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#e6e3df]/40 shadow-sm p-32 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-mutedbrown" size={40} strokeWidth={1.5} />
          <p className="text-xs text-warmgray uppercase tracking-widest font-bold animate-pulse">Connecting to Live Sheet...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-3xl p-20 flex flex-col items-center justify-center text-center gap-4">
          <AlertCircle size={48} className="text-red-400" strokeWidth={1} />
          <div className="space-y-1">
            <p className="font-serif text-xl text-red-900">{error}</p>
            <p className="text-xs text-red-600/70">Please check your backend Google API configuration.</p>
          </div>
          <button onClick={loadTasks} className="mt-4 bg-white text-red-600 border border-red-200 px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="h-[calc(100vh-250px)] min-h-[600px]">
          <GoogleSheetsGrid
            data={filteredData}
            isAdmin={user?.role === "admin"}
            onRefresh={loadTasks}
            activeMonth={month}
            setMonth={setMonth}
          />
        </div>
      )}
    </div>
  );
};

export default TaskPlanning;
