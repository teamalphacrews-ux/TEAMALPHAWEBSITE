import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { updateCell, batchUpdateCells, addRow, addColumn, getSheetData, deleteRow, deleteColumn, getDropdownConfig } from './taskService';
import DropdownSettingsModal from './DropdownSettingsModal';
import {
    Plus, Search, Filter, Loader2, Maximize2, Minimize2,
    Table as TableIcon, Layout, ChevronDown, Check, X,
    HelpCircle, FileText, Share2, Grid3X3, Bold, Italic,
    AtSign, Calendar, Clock, MousePointer2, Settings, ExternalLink,
    Database, Layers, Copy, CheckCircle, Trash2, RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
// import { STATUS, EVENTS, TEAM, PHOTO_STATUS, STATUS_COLORS } from './constants'; // Will use dynamic options where possible
import { STATUS_COLORS } from './constants';


const API_URL = import.meta.env.VITE_API_URL || "";

const MONTHS = ["All", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GoogleSheetsGrid = ({ data, onRefresh, isAdmin, activeMonth, setMonth }) => {
    const [headers, setHeaders] = useState(data.headers || []);
    const [rows, setRows] = useState(data.rows || []);
    const [sheetName, setSheetName] = useState(data.sheetName || "Loading...");
    const [selectedCell, setSelectedCell] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSheetIDOpen, setIsSheetIDOpen] = useState(false);
    const [newSheetID, setNewSheetID] = useState(localStorage.getItem('google_sheet_id') || "");
    const [isMutating, setIsMutating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({}); // { "rowId-colIdx": value }
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [options, setOptions] = useState({
        status: [],
        event: [],
        photos: [],
        team: []
    });

    const gridRef = useRef(null);
    const socketRef = useRef(null);
    const switchButtonRef = useRef(null);

    useEffect(() => {
        if (data.headers) setHeaders([...data.headers]);
        if (data.rows) setRows([...data.rows]);
        if (data.sheetName) setSheetName(data.sheetName);

        if (selectedCell && selectedCell.colIdx >= (data.headers?.length || 0)) {
            setSelectedCell(null);
        }

        fetchOptions();
    }, [data]);

    const fetchOptions = async () => {
        const configData = await getDropdownConfig();
        const newOptions = {};
        configData.forEach(c => {
            newOptions[c.type] = c.options;
        });
        setOptions(newOptions);
    };

    useEffect(() => {
        // ALWAYS use the dynamic API_URL for socket connection
        socketRef.current = io(API_URL);

        socketRef.current.on('connect', () => {
            // Silently connected
        });

        socketRef.current.on('sheet_cell_updated', (update) => {
            setRows(prevRows => {
                return prevRows.map(row => {
                    if (row.rowId === parseInt(update.rowId)) {
                        const newValues = [...row.values];
                        newValues[update.colIndex] = update.value;
                        return { ...row, values: newValues };
                    }
                    return row;
                });
            });
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        if (isFullScreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isFullScreen]);

    const handleSwitchSheet = async () => {
        if (!newSheetID) {
            toast.error("Please enter a valid Sheet ID");
            return;
        }
        localStorage.setItem('google_sheet_id', newSheetID);
        setIsSheetIDOpen(false);
        toast.promise(onRefresh(), {
            loading: 'Connecting to Dynamic Sheet...',
            success: 'Sheet Switched Successfully!',
            error: 'Failed to switch sheet. Check Permissions.',
        });
    };

    const handleAddRow = async () => {
        if (isMutating) return;
        setIsMutating(true);
        const emptyRow = new Array(headers.length).fill("");
        const res = await addRow(emptyRow, sheetName);
        if (res.success) {
            toast.success("New Task Created");
            await onRefresh();
        } else {
            toast.error("Failed to add row");
        }
        setIsMutating(false);
    };

    const handleDeleteRow = async (rowId) => {
        if (!window.confirm(`Are you sure you want to delete row ${rowId}?`)) return;
        if (isMutating) return;
        setIsMutating(true);
        const res = await deleteRow(rowId, sheetName);
        if (res.success) {
            toast.success("Row Deleted Successfully");
            await onRefresh();
        } else {
            toast.error("Failed to delete row");
        }
        setIsMutating(false);
    };

    const handleAddColumn = async () => {
        const colName = window.prompt("Enter New Column Name:");
        if (!colName) return;
        if (isMutating) return;
        setIsMutating(true);
        const res = await addColumn(colName, sheetName);
        if (res.success) {
            toast.success("Column Added Successfully");
            setHeaders([]);
            await onRefresh();
        } else {
            toast.error("Failed to add column");
        }
        setIsMutating(false);
    };

    const handleDeleteColumn = async (colIdx) => {
        if (!window.confirm(`Are you sure you want to delete column "${headers[colIdx]}"? This cannot be undone.`)) return;
        if (isMutating) return;
        setIsMutating(true);
        const res = await deleteColumn(colIdx, sheetName);
        if (res.success) {
            toast.success("Column Deleted Successfully");
            await onRefresh();
        } else {
            toast.error("Failed to delete column");
        }
        setIsMutating(false);
    };

    const handleCellClick = (rowId, colIdx) => {
        setSelectedCell({ rowId, colIdx });
        if (editingCell?.rowId !== rowId || editingCell?.colIdx !== colIdx) {
            setEditingCell(null);
        }
    };

    const handleCellDoubleClick = (rowId, colIdx, value) => {
        if (!isAdmin) return;
        setEditingCell({ rowId, colIdx });
        setEditValue(value);
    };

    const handleSaveCell = (rowId, colIdx, value) => {
        // Update local rows immediately for smoothness
        setRows(prevRows => {
            return prevRows.map(row => {
                if (row.rowId === rowId) {
                    const newValues = [...row.values];
                    newValues[colIdx] = value;
                    return { ...row, values: newValues };
                }
                return row;
            });
        });
        
        // Track for global save
        const key = `${rowId}-${colIdx}`;
        setPendingChanges(prev => ({
            ...prev,
            [key]: value
        }));
        
        setEditingCell(null);
    };

    const handleGlobalSave = async () => {
        if (Object.keys(pendingChanges).length === 0) return;
        setIsSaving(true);
        const saveToast = toast.loading(`Saving ${Object.keys(pendingChanges).length} pending changes...`);
        
        const updates = Object.entries(pendingChanges).map(([key, value]) => {
            const [rowId, colIdx] = key.split('-');
            return { rowId: parseInt(rowId), colIndex: parseInt(colIdx), value };
        });

        const res = await batchUpdateCells(updates, sheetName);
        if (res.success) {
            toast.success(`Pipeline Synchronized: ${updates.length} changes persisted`, { id: saveToast });
            setPendingChanges({});
            await onRefresh();
        } else {
            toast.error("Failed to save changes. Please try again.", { id: saveToast });
        }
        setIsSaving(false);
    };

    const handleKeyDown = (e) => {
        if (editingCell) {
            if (e.key === 'Enter') handleSaveCell(editingCell.rowId, editingCell.colIdx, editValue);
            if (e.key === 'Escape') setEditingCell(null);
            return;
        }

        if (!selectedCell) return;
        const { rowId, colIdx } = selectedCell;
        const rowIdx = rows.findIndex(r => r.rowId === rowId);

        if (e.key === 'ArrowRight') { e.preventDefault(); if (colIdx < headers.length - 1) setSelectedCell({ rowId, colIdx: colIdx + 1 }); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (colIdx > 0) setSelectedCell({ rowId, colIdx: colIdx - 1 }); }
        if (e.key === 'ArrowDown') { e.preventDefault(); if (rowIdx >= 0 && rowIdx < rows.length - 1) setSelectedCell({ rowId: rows[rowIdx + 1].rowId, colIdx }); }
        if (e.key === 'ArrowUp') { e.preventDefault(); if (rowIdx > 0) setSelectedCell({ rowId: rows[rowIdx - 1].rowId, colIdx }); }
        if (e.key === 'Enter' && isAdmin) { e.preventDefault(); if (rowIdx >= 0) handleCellDoubleClick(rowId, colIdx, rows[rowIdx].values[colIdx]); }
        if (e.key.length === 1 && isAdmin && !e.ctrlKey && !e.metaKey && rowIdx >= 0) {
            handleCellDoubleClick(rowId, colIdx, "");
            setEditValue(e.key);
        }
    };

    const getColumnType = (colIdx) => {
        const header = (headers[colIdx] || "").toLowerCase();
        if (header.includes("client name")) return "text";
        if (header.includes("event")) return "event";
        if (header.includes("photos update")) return "photos";
        if (header.includes("assigned to") || header.includes("by") || header.includes("editor")) return "team";
        if (header.includes("date") || header.includes("deadline")) return "date";
        return "status";
    };

    const filteredRows = rows.filter(row => {
        const matchesSearch = row.values.some(v => v.toString().toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
    });

    const getPillStyle = (val) => {
        const style = STATUS_COLORS[val];
        if (style) { return { backgroundColor: style.bg, borderColor: style.border, color: style.text }; }
        return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#64748b' };
    };

    const renderGrid = () => (
        <div className={`flex flex-col bg-white overflow-hidden transition-all duration-500 font-sans group/grid
            ${isFullScreen ? 'fixed inset-0 z-[999999] w-screen h-screen m-0 p-0 rounded-none border-0' : 'h-full rounded-3xl border border-[#e2e8f0] shadow-2xl relative shadow-emerald-500/5'}`}
            onKeyDown={handleKeyDown} tabIndex="0">

            {/* HEADER */}
            <div className={`bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-6 py-4 flex flex-col gap-2 transition-all
                ${isFullScreen ? 'rounded-0 border-t-0 p-7 shadow-xl' : 'rounded-t-3xl'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl shadow-inner border border-emerald-500/10 group/logo">
                            <TableIcon className="text-emerald-600 transition-transform group-hover/logo:scale-110" size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-4">
                                <h1 className="text-lg font-black text-slate-800 tracking-tight uppercase tracking-[0.1em]">
                                    {isFullScreen ? 'Team Alpha Task Tracker' : 'Task Tracker'}
                                    <span className="text-slate-300 ml-2 font-light">{sheetName || "..."}</span>
                                </h1>
                                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    Sync Active
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button ref={switchButtonRef} onClick={() => setIsSheetIDOpen(!isSheetIDOpen)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black transition-all border
                                    ${isSheetIDOpen ? 'bg-slate-800 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100 shadow-sm'}`}>
                                <Database size={16} className={isSheetIDOpen ? 'text-emerald-400' : 'text-slate-400'} />
                                {isSheetIDOpen ? 'CLOSE CONSOLE' : 'SWITCH SHEET'}
                            </button>
                            {isSheetIDOpen && createPortal(
                                <div className="fixed bg-slate-900 rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.6)] border border-slate-700/50 p-7 z-[99999999] animate-in zoom-in-95 duration-200"
                                    style={{ top: (switchButtonRef.current?.getBoundingClientRect().bottom || 0) + 12, right: window.innerWidth - (switchButtonRef.current?.getBoundingClientRect().right || 0), width: '480px' }}>
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3 text-white">
                                            <div className="p-2 bg-emerald-500/20 rounded-xl"><Layers className="text-emerald-400" size={20} /></div>
                                            <span className="text-[13px] font-black uppercase tracking-[0.2em]">Connection Interface</span>
                                        </div>
                                        <div onClick={() => setIsSheetIDOpen(false)} className="cursor-pointer p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} className="text-slate-500" /></div>
                                    </div>
                                    <div className="space-y-5">
                                        <div className="relative group">
                                            <div className="absolute -top-3 left-4 px-2 bg-slate-900 text-[9px] font-black text-slate-500 uppercase tracking-widest z-10">Spreadsheet ID</div>
                                            <input autoFocus type="text" className="w-full bg-slate-800/80 border-2 border-slate-700 rounded-2xl px-5 py-5 text-[13px] text-emerald-400 font-mono focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none" placeholder="Paste ID..." value={newSheetID} onChange={(e) => setNewSheetID(e.target.value)} />
                                            <Copy className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-emerald-400 cursor-pointer" size={18} />
                                        </div>
                                        <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/10">
                                            <p className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest mb-1 flex items-center gap-2"><HelpCircle size={12} /> Requirement</p>
                                            <p className="text-[11px] text-slate-300 italic leading-relaxed">Share sheet with: <span className="text-emerald-400 underline font-mono select-all block mt-1 py-1 px-2 bg-slate-800/50 rounded-lg">teamalpha@team-491805.iam.gserviceaccount.com</span></p>
                                        </div>
                                        <button onClick={handleSwitchSheet} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl py-5 flex items-center justify-center gap-4 text-[13px] font-black uppercase tracking-[0.25em] transition-all shadow-2xl active:scale-95 group"><Database size={20} /> Connect Pipeline</button>
                                    </div>
                                </div>, document.body)}
                        </div>
                        <div className="w-px h-8 bg-slate-100 mx-2"></div>
                        {isAdmin && (
                            <button onClick={() => setIsSettingsOpen(true)} className="w-11 h-11 flex items-center justify-center bg-emerald-500 text-white rounded-2xl transition-all shadow-xl active:scale-90" title="Manage Dropdowns">
                                <Settings size={22} />
                            </button>
                        )}
                        <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-11 h-11 flex items-center justify-center bg-slate-900 text-white rounded-2xl transition-all shadow-xl active:scale-90" title={isFullScreen ? "Minimize" : "Maximize"}>
                            {isFullScreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
                        </button>
                    </div>
                </div>



                {/* MONTH TABS */}
                <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
                    <button onClick={() => setMonth("All")} className={`flex items-center gap-2 px-6 h-9 rounded-2xl text-[11px] font-black transition-all shadow-sm ${activeMonth === "All" ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200/50'}`}><Layout size={14} /> LIVE PIPELINE</button>
                    <div className="h-6 w-px bg-slate-200 mx-2"></div>
                    {MONTHS.slice(1).map(m => (
                        <button key={m} onClick={() => setMonth(m)} className={`px-6 h-9 rounded-2xl text-[11px] font-black transition-all border ${activeMonth === m ? 'bg-white text-emerald-600 shadow-lg border-emerald-500 ring-2 ring-emerald-500/10' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50 hover:text-slate-600'}`}>{m}</button>
                    ))}
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="bg-[#f8fafc]/50 backdrop-blur-sm border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="relative w-96 group">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                        <input type="text" className="w-full pl-12 pr-6 py-3 bg-white border border-[#e2e8f0] rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <>
                            {Object.keys(pendingChanges).length > 0 && (
                                <button onClick={handleGlobalSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50 animate-in zoom-in-95">
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} className="text-white" />} 
                                    SAVE CHANGES ({Object.keys(pendingChanges).length})
                                </button>
                            )}
                            <button onClick={handleAddColumn} disabled={isMutating} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                                <Plus size={18} className="text-emerald-500" /> NEW COLUMN
                            </button>
                            <button onClick={handleAddRow} disabled={isMutating} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black hover:bg-slate-800 transition-all shadow-2xl active:scale-95 uppercase tracking-widest border border-slate-800 disabled:opacity-50">
                                {isMutating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} className="text-emerald-400" />} Add Task
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* GRID */}
            <div className={`flex-1 overflow-auto relative custom-scrollbar bg-white ${isFullScreen ? 'max-h-[calc(100vh-250px)]' : 'h-[600px]'}`} ref={gridRef}>
                <table className="border-collapse w-full table-fixed min-w-[2600px]">
                    <thead>
                        <tr className="bg-slate-50 h-14">
                            <th className="sticky left-0 top-0 z-30 w-14 border-r border-b border-slate-200 text-slate-300 bg-slate-50 shadow-md">#</th>
                            {headers.map((h, i) => (
                                <th key={i} className="sticky top-0 z-20 min-w-[220px] border-r border-b border-slate-200 px-5 font-black text-[11px] text-slate-500 uppercase tracking-widest bg-slate-50 shadow-sm group/header relative">
                                    <div className="flex items-center justify-center gap-2">
                                        {h}
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteColumn(i); }}
                                                className="opacity-0 group-hover/header:opacity-100 transition-opacity p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="sticky right-0 top-0 z-30 w-16 border-l border-b border-slate-200 bg-slate-50 text-[10px] font-black">DEL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRows.map((row, rIdx) => (
                            <tr key={row.rowId} className="h-[52px] group/row transition-colors">
                                <td className="sticky left-0 z-10 w-14 bg-slate-50 border-r border-b border-slate-200 text-center text-[12px] text-slate-400 font-bold shadow-sm group-hover/row:bg-emerald-50 transition-colors">
                                    {row.rowId}
                                </td>
                                {row.values.map((val, cIdx) => {
                                    const isSelected = selectedCell?.rowId === row.rowId && selectedCell?.colIdx === cIdx;
                                    const isEditing = editingCell?.rowId === row.rowId && editingCell?.colIdx === cIdx;
                                    const isDirty = pendingChanges[`${row.rowId}-${cIdx}`] !== undefined;
                                    const displayValue = isDirty ? pendingChanges[`${row.rowId}-${cIdx}`] : val;
                                    const type = getColumnType(cIdx);
                                    return (
                                        <td key={cIdx} onClick={() => handleCellClick(row.rowId, cIdx)} onDoubleClick={() => handleCellDoubleClick(row.rowId, cIdx, val)}
                                            className={`relative border-r border-b border-slate-100 px-5 transition-all text-[13px] 
                                                ${isSelected ? 'ring-2 ring-emerald-500 ring-inset z-20 bg-emerald-500/5 shadow-inner' : ''} 
                                                ${isDirty ? 'bg-amber-500/5' : ''} 
                                                ${isEditing ? 'p-1' : 'py-3 font-bold'}`}>
                                            {isDirty && !isEditing && (
                                                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm animate-pulse"></div>
                                            )}
                                            {isEditing ? (
                                                (type === "text" || type === "date") ? (
                                                    <div className="flex items-center w-full h-full p-0 animate-in fade-in duration-200">
                                                        <input
                                                            autoFocus
                                                            type={type}
                                                            className="flex-1 w-full h-[38px] border-2 border-emerald-500 rounded-xl px-3 font-bold bg-white text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={() => handleSaveCell(row.rowId, cIdx, editValue)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveCell(row.rowId, cIdx, editValue);
                                                                if (e.key === 'Escape') setEditingCell(null);
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center w-full h-full p-0 animate-in fade-in duration-200">
                                                        <select
                                                            autoFocus
                                                            className="flex-1 w-full h-[38px] border-2 border-emerald-500 rounded-xl px-3 font-bold bg-white text-slate-700 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-sm cursor-pointer"
                                                            value={editValue}
                                                            onChange={(e) => {
                                                                setEditValue(e.target.value);
                                                                handleSaveCell(row.rowId, cIdx, e.target.value);
                                                            }}
                                                            onBlur={() => setEditingCell(null)}
                                                        >
                                                            <option key="current" value={editValue} hidden>{editValue}</option>
                                                            {(options[type] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="truncate text-slate-600">{(type === "status" || type === "photos" || type === "event" || type === "team") ?
                                                    <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase border shadow-sm" style={getPillStyle(displayValue)}>{displayValue || "N/A"}</span>
                                                    : (displayValue || "-")}</div>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="sticky right-0 z-10 w-16 bg-white border-l border-b border-slate-100 flex items-center justify-center h-full group-hover/row:bg-red-50 transition-colors">
                                    <button onClick={() => handleDeleteRow(row.rowId)} className="text-slate-200 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={`bg-slate-900 border-t border-slate-800 h-8 flex items-center px-6 justify-end relative z-10 ${isFullScreen ? 'rounded-b-none' : 'rounded-b-3xl'}`}>
                <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-white/30 text-[8px] font-black uppercase tracking-[0.2em]">Live Registry</span></div>
            </div>

            <DropdownSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onUpdate={fetchOptions}
            />
            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }` }} />
        </div>
    );

    return isFullScreen ? createPortal(renderGrid(), document.body) : renderGrid();
};

export default GoogleSheetsGrid;
