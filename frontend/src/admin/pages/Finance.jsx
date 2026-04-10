import { useState, useEffect } from "react";
import axios from "axios";
import { IndianRupee, TrendingUp, TrendingDown, Clock, Wallet, Filter, Download, Plus, X, ChevronRight, User, AlertCircle, CheckCircle2, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, 
    BarChart, Bar, AreaChart, Area
} from 'recharts';

const AnimatedNumber = ({ value, prefix = "₹" }) => {
    return (
        <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        >
            {prefix}{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0)}
        </motion.span>
    );
};

export default function Finance() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || '';
    const [stats, setStats] = useState({ annualSales: 0, annualProfit: 0, expenses: 0, pendingRevenue: 0 });
    const [transactions, setTransactions] = useState([]);
    const [allocation, setAllocation] = useState([]);
    const [pendingPayments, setPendingPayments] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [newExpense, setNewExpense] = useState({ title: "", amount: "", category: "Operational" });
    const [editExpense, setEditExpense] = useState(null);
    const [filterCategory, setFilterCategory] = useState("All");
    const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("Trend");
    const [expandedChart, setExpandedChart] = useState(null);
    const [sortByPending, setSortByPending] = useState("Pending (High)");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [overviewRes, txRes, allocRes, pendingRes, monthlyRes] = await Promise.all([
                axios.get(`${API}/api/finance/overview`, authHeader),
                axios.get(`${API}/api/finance/transactions`, authHeader),
                axios.get(`${API}/api/finance/allocation`, authHeader),
                axios.get(`${API}/api/finance/pending-payments`, authHeader),
                axios.get(`${API}/api/finance/monthly-performance`, authHeader)
            ]);
            setStats(overviewRes.data);
            setTransactions(txRes.data || []);
            setAllocation(allocRes.data || []);
            setPendingPayments(pendingRes.data || []);
            setMonthlyData(monthlyRes.data || []);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch finance data", err);
            setLoading(false);
        }
    };

    const handleEditClick = (tx) => {
        setEditExpense({
            id: tx.id,
            title: tx.name,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            status: tx.status,
            date: tx.date
        });
        setShowExpenseModal(true);
    };

    const handleDeleteClick = async (tx) => {
        if (!window.confirm("Delete this transaction?")) return;
        const { id, type, incomeType } = tx;

        try {
            if (type === 'income') {
                if (incomeType === 'Lead') {
                    // Safe reset for Lead payments
                    await axios.delete(`${API}/api/finance/income/Lead/${id}`, authHeader);
                    toast.success("Lead payment reset to unpaid");
                } else {
                    await axios.delete(`${API}/api/invoices/${id}`, authHeader);
                    toast.success("Invoice deleted");
                }
            } else {
                await axios.delete(`${API}/api/finance/expense/${id}`, authHeader);
                toast.success("Expense deleted");
            }
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Failed to delete transaction");
        }
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editExpense) {
                if (editExpense.type === 'income') {
                    await axios.put(`${API}/api/invoices/${editExpense.id}`, {
                        clientName: editExpense.title,
                        total: editExpense.amount,
                        invoiceDate: editExpense.date,
                        status: editExpense.status
                    }, authHeader);
                    toast.success("Transaction updated");
                } else {
                    await axios.put(`${API}/api/finance/expense/${editExpense.id}`, editExpense, authHeader);
                    toast.success("Expense updated");
                }
            } else {
                await axios.post(`${API}/api/finance/expense`, newExpense, authHeader);
                toast.success("Expense logged successfully");
            }
            setShowExpenseModal(false);
            setEditExpense(null);
            setNewExpense({ title: "", amount: "", category: "Operational" });
            fetchData();
        } catch (err) {
            toast.error("Failed to save expense");
        }
    };

    const handleExport = () => {
        const headers = ["Name", "Category", "Amount", "Type", "Status", "Date"];
        const rows = transactions.map(tx => [
            tx.name,
            tx.category,
            tx.amount,
            tx.type,
            tx.status,
            new Date(tx.date).toLocaleDateString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "finance_ledger.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTransactions = transactions.filter(tx => {
        if (filterCategory === "All") return true;
        if (filterCategory === "Income") return tx.type === 'income';
        if (filterCategory === "Expense") return tx.type === 'expense';
        return true;
    });

    const sortedPendingPayments = [...pendingPayments].sort((a, b) => {
        if (sortByPending === "Pending (High)") return b.pending - a.pending;
        if (sortByPending === "Pending (Low)") return a.pending - b.pending;
        if (sortByPending === "Name (A-Z)") return a.name.localeCompare(b.name);
        if (sortByPending === "Total (High)") return b.total - a.total;
        return 0;
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }
    };

    const renderExpandedChart = () => {
        if (!expandedChart) return null;
        
        let dataKey = "revenue";
        let color = "#10b981";
        let isArea = true;

        if (expandedChart === 'Annual Sales') { dataKey = "revenue"; color = "#10b981"; }
        if (expandedChart === 'Pending Revenue') { dataKey = "revenue"; color = "#3b82f6"; isArea = false; }
        if (expandedChart === 'Total Expenses') { dataKey = "expenses"; color = "#f43f5e"; }
        if (expandedChart === 'Studio Profit') { dataKey = "cashFlow"; color = "#d4af37"; }

        return isArea ? (
            <AreaChart data={monthlyData} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="expandedColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }} tickFormatter={(val) => `₹${val >= 1000 ? val/1000 + 'k' : val}`} dx={-10} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#expandedColor)" animationDuration={1000} />
            </AreaChart>
        ) : (
            <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }} tickFormatter={(val) => `₹${val >= 1000 ? val/1000 + 'k' : val}`} dx={-10} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} animationDuration={1000} />
            </BarChart>
        );
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-xl border border-black/5 p-4 rounded-2xl shadow-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 py-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-xs font-bold text-[#1a1a1a]">{entry.name}:</span>
                            <span className="text-xs font-bold text-[#1a1a1a] ml-auto">{formatCurrency(entry.value)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-8 md:space-y-12 text-[#1a1a1a] px-4 md:px-0 min-h-screen pb-20"
        >
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
                <div>
                    <h1 className="font-serif text-4xl md:text-6xl tracking-tight text-[#1a1a1a]">Financial Ledger</h1>
                    <p className="text-[10px] md:text-xs text-[#555] mt-4 font-bold uppercase tracking-[0.4em] opacity-90">
                        <span className="text-gold">●</span> Tracking luxury growth and studio metrics
                    </p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => {
                            setEditExpense(null);
                            setShowExpenseModal(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-900 px-10 py-5 rounded-2xl text-[10px] font-extrabold uppercase tracking-[0.3em] hover:shadow-[0_15px_30px_rgba(16,185,129,0.2)] transition-all active:scale-95 border border-emerald-500/10 group shadow-md"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500 text-emerald-700" /> Log Expense
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-900 px-10 py-5 rounded-2xl text-[10px] font-extrabold uppercase tracking-[0.3em] hover:shadow-[0_15px_30px_rgba(59,130,246,0.15)] transition-all shadow-md active:scale-95 border border-blue-500/10"
                    >
                        <Download size={18} className="text-blue-600" /> Export
                    </button>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-100 p-8 rounded-[2rem] shadow-md relative overflow-hidden group hover:-translate-y-2 transition-all duration-500 border border-black/5">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-900 group-hover:scale-110 transition-transform duration-700">
                        <TrendingUp size={100} />
                    </div>
                    <p className="text-[10px] text-[#1a1a1a] uppercase tracking-[0.2em] font-bold mb-4 opacity-70">Annual Sales</p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-3xl md:text-4xl font-serif text-[#1a1a1a]">
                            <AnimatedNumber value={stats.annualSales} />
                        </h3>
                        <div 
                            onClick={() => setExpandedChart('Annual Sales')}
                            className="w-24 h-12 opacity-50 group-hover:opacity-100 transition-all cursor-pointer hover:scale-105"
                            title="Click to expand chart"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyData}>
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} style={{ pointerEvents: 'none' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 backdrop-blur-md flex items-center justify-center text-emerald-700">
                           <TrendingUp size={16} />
                        </div>
                        <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Live Revenue</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8 rounded-[2rem] shadow-md relative overflow-hidden group hover:-translate-y-2 transition-all duration-500 border border-black/5">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-blue-900 group-hover:scale-110 transition-transform duration-700">
                        <Clock size={100} />
                    </div>
                    <p className="text-[10px] text-[#1a1a1a] uppercase tracking-[0.2em] font-bold mb-4 opacity-70">Pending Revenue</p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-3xl md:text-4xl font-serif text-[#1a1a1a]">
                            <AnimatedNumber value={stats.pendingRevenue || 0} />
                        </h3>
                        <div 
                            onClick={() => setExpandedChart('Pending Revenue')}
                            className="w-24 h-12 opacity-30 group-hover:opacity-60 transition-all cursor-pointer hover:scale-105"
                            title="Click to expand chart"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} style={{ pointerEvents: 'none' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 backdrop-blur-md flex items-center justify-center text-blue-700">
                           <Clock size={16} />
                        </div>
                        <span className="text-[10px] text-blue-800 font-bold uppercase tracking-widest">Awaiting</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-orange-100 p-8 rounded-[2rem] shadow-md relative overflow-hidden group hover:-translate-y-2 transition-all duration-500 border border-black/5">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-rose-900 group-hover:scale-110 transition-transform duration-700">
                        <TrendingDown size={100} />
                    </div>
                    <p className="text-[10px] text-[#1a1a1a] uppercase tracking-[0.2em] font-bold mb-4 opacity-70">Total Expenses</p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-3xl md:text-4xl font-serif text-[#1a1a1a]">
                            <AnimatedNumber value={stats.expenses} />
                        </h3>
                        <div 
                            onClick={() => setExpandedChart('Total Expenses')}
                            className="w-24 h-12 opacity-50 group-hover:opacity-100 transition-all cursor-pointer hover:scale-105"
                            title="Click to expand chart"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyData}>
                                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} strokeWidth={2} style={{ pointerEvents: 'none' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 backdrop-blur-md flex items-center justify-center text-rose-700">
                           <TrendingDown size={16} />
                        </div>
                        <span className="text-[10px] text-rose-800 font-bold uppercase tracking-widest">Operational</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-[#faf7f2] to-stone-100 p-8 rounded-[2rem] shadow-md relative overflow-hidden group hover:-translate-y-2 transition-all duration-500 border border-black/5">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-stone-900 group-hover:scale-110 transition-transform duration-700">
                        <Wallet size={100} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-[10px] text-[#1a1a1a] uppercase tracking-[0.2em] font-bold mb-4 opacity-70">Studio Profit</p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-3xl md:text-4xl font-serif text-[#1a1a1a]">
                            <AnimatedNumber value={stats.annualProfit} />
                        </h3>
                        <div 
                            onClick={() => setExpandedChart('Studio Profit')}
                            className="w-24 h-12 opacity-50 group-hover:opacity-100 transition-all cursor-pointer hover:scale-105"
                            title="Click to expand chart"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyData}>
                                    <Area type="monotone" dataKey="cashFlow" stroke="#d4af37" fill="#d4af37" fillOpacity={0.2} strokeWidth={2} style={{ pointerEvents: 'none' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gold/5 backdrop-blur-md flex items-center justify-center text-gold">
                           <Wallet size={16} />
                        </div>
                        <span className="text-[10px] text-stone-600 font-bold uppercase tracking-[0.3em] font-serif italic">Precision</span>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 pb-12">
                <motion.div variants={itemVariants} className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8 md:p-12 overflow-hidden group/panel">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-[#1a1a1a] rounded-full"></div>
                            <h4 className="font-serif text-3xl text-[#1a1a1a] flex items-center gap-3">
                                {activeAnalyticsTab === 'Trend' ? <LineChartIcon size={24} className="text-emerald-600" /> : <BarChart3 size={24} className="text-blue-600" />}
                                Recent Transactions
                            </h4>
                        </div>
                        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-[1.25rem] border border-black/5">
                            {['Trend', 'CashFlow'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveAnalyticsTab(tab)}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                                        activeAnalyticsTab === tab 
                                        ? 'bg-white text-[#1a1a1a] shadow-sm' 
                                        : 'text-[#555] hover:text-[#1a1a1a]'
                                    }`}
                                >
                                    {tab === 'Trend' ? 'Revenue Trend' : 'Cash Flow'}
                                </button>
                            ))}
                        </div>
                        <div className="relative group/select">
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="appearance-none bg-white border border-black/5 p-3 pr-10 rounded-xl transition-all text-[#555] group-hover/select:bg-stone-50 text-[10px] font-bold uppercase tracking-widest focus:outline-none"
                            >
                                <option value="All">All</option>
                                <option value="Income">Income</option>
                                <option value="Expense">Expenses</option>
                            </select>
                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#555] pointer-events-none" />
                        </div>
                    </div>

                    <div className="mb-12 h-[220px] w-full bg-stone-50/50 rounded-[2rem] border border-black/5 p-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>
                        <ResponsiveContainer width="100%" height="100%">
                            {activeAnalyticsTab === 'Trend' ? (
                                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#888', fontSize: 9, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis axisLine={false} tickLine={false} hide={true} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1 }} />
                                    <Area 
                                        type="monotone" 
                                        dataKey="revenue" 
                                        name="Revenue"
                                        stroke="#10b981" 
                                        strokeWidth={2.5}
                                        fillOpacity={1} 
                                        fill="url(#colorRevenue)" 
                                        animationDuration={1000}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="expenses" 
                                        name="Expenses"
                                        stroke="#f43f5e" 
                                        strokeWidth={2.5}
                                        fillOpacity={1} 
                                        fill="url(#colorExpenses)" 
                                        animationDuration={1200}
                                    />
                                </AreaChart>
                            ) : (
                                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#888', fontSize: 9, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis axisLine={false} tickLine={false} hide={true} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                                    <Bar 
                                        dataKey="cashFlow" 
                                        name="Net Cash Flow"
                                        radius={[8, 8, 8, 8]}
                                        animationDuration={1200}
                                    >
                                        {monthlyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.cashFlow >= 0 ? '#3b82f6' : '#f97316'} fillOpacity={0.8} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                        {filteredTransactions.length > 0 ? filteredTransactions.map((tx, i) => (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: 0.05 * i }}
                                key={i} 
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl hover:bg-stone-50 transition-all duration-300 group/row border-b border-black/5 last:border-0 gap-4 sm:gap-0"
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                        <IndianRupee size={22} strokeWidth={2} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-[#1a1a1a]">{tx.name}</h5>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'}`}>
                                                {tx.category}
                                            </span>
                                            <span className="text-[9px] text-[#555] font-bold uppercase tracking-tight">{new Date(tx.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 border-t sm:border-0 border-black/5 pt-4 sm:pt-0">
                                    <div className="text-right">
                                        <div className={`text-lg font-bold ${tx.type === 'expense' ? 'text-rose-700' : 'text-emerald-700'}`}>
                                            {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover/row:opacity-100 transition-all flex gap-1">
                                        <button onClick={() => handleEditClick(tx)} className="p-2.5 hover:bg-[#1a1a1a] hover:text-white rounded-xl transition-all"><Filter size={14} className="rotate-90" /></button>
                                        <button onClick={() => handleDeleteClick(tx)} className="p-2.5 hover:bg-rose-600 hover:text-white rounded-xl transition-all"><X size={14} /></button>
                                    </div>
                                </div>
                            </motion.div>
                        )) : (
                            <p className="text-center text-[#555] text-sm italic py-10">No recent transactions.</p>
                        )}
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8 md:p-12 hover:shadow-xl transition-all duration-500">
                    <div className="flex justify-between items-center mb-12">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-gold rounded-full"></div>
                            <h4 className="font-serif text-3xl text-[#1a1a1a] flex items-center gap-3">
                                <PieChartIcon size={24} className="text-gold" />
                                Treasury Allocation
                            </h4>
                        </div>
                        <button className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a] bg-stone-100 border border-black/5 px-5 py-2.5 rounded-full">FY 2025-26</button>
                    </div>

                    <div className="h-[260px] w-full mb-10 relative group">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocation}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={95}
                                    paddingAngle={8}
                                    dataKey="value"
                                    nameKey="label"
                                    animationDuration={1200}
                                    stroke="none"
                                >
                                    {allocation.map((entry, index) => {
                                        const getColor = (cat) => {
                                            const map = {
                                                'Equipment': '#10b981',
                                                'Travel': '#3b82f6',
                                                'Marketing': '#f97316',
                                                'Operational': '#64748b',
                                                'Salary': '#f43f5e',
                                                'Invoice Payment': '#8b5cf6'
                                            };
                                            return map[cat] || '#94a3b8';
                                        };
                                        return <Cell key={`cell-${index}`} fill={getColor(entry.label)} />;
                                    })}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#555]">Total</p>
                            <p className="text-xl font-serif text-[#1a1a1a] mt-1">{formatCurrency(allocation.reduce((s, a) => s + a.value, 0))}</p>
                        </div>
                    </div>

                    <div className="space-y-10">
                        {allocation.length > 0 ? allocation.map((exp, idx) => {
                            const getCategoryStyle = (category) => {
                                const map = {
                                    'Equipment': 'from-emerald-500 to-emerald-700 shadow-emerald-500/10',
                                    'Travel': 'from-blue-500 to-blue-700 shadow-blue-500/10',
                                    'Marketing': 'from-orange-500 to-orange-700 shadow-orange-500/10',
                                    'Operational': 'from-slate-500 to-slate-700 shadow-slate-500/10',
                                    'Salary': 'from-rose-500 to-rose-700 shadow-rose-500/10',
                                    'Invoice Payment': 'from-purple-500 to-purple-700 shadow-purple-500/10'
                                };
                                return map[category] || 'from-gray-500 to-gray-700';
                            };

                            return (
                                <div key={idx} className="group/exp relative">
                                    <div className="flex justify-between text-[10px] mb-4 font-bold uppercase tracking-[0.1em]">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${getCategoryStyle(exp.label).split(' ')[0].replace('from-', 'bg-')}`}></div>
                                            <span className="text-[#555] group-hover/exp:text-[#1a1a1a] transition-colors tracking-[0.2em]">{exp.label}</span>
                                        </div>
                                        <div className="text-[#1a1a1a] tabular-nums font-bold">
                                            {formatCurrency(exp.value)} 
                                            <span className="text-[#555] ml-2 text-[9px] opacity-60">{exp.progress}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-black/[0.06] h-3 rounded-full overflow-hidden p-0.5 border border-black/[0.03]">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${exp.progress}%` }}
                                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 + idx * 0.05 }}
                                            className={`bg-gradient-to-r ${getCategoryStyle(exp.label)} h-full rounded-full shadow-md relative`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
                                        </motion.div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-[#555] text-sm italic py-10">No expense data available.</p>
                        )}
                    </div>

                    <div className="mt-16 p-8 bg-gradient-to-r from-stone-50 to-[#faf7f2] rounded-[2rem] border border-black/5 font-serif italic text-sm text-center text-[#555] shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                        "Precision Over Volume • FY25 Financial Review"
                    </div>
                </motion.div>
            </div>

            <motion.div variants={itemVariants} className="bg-white rounded-[3rem] border border-black/5 shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-8 md:p-12 hover:shadow-2xl transition-all duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-10 bg-rose-600 rounded-full"></div>
                        <h4 className="font-serif text-3xl md:text-4xl text-[#1a1a1a]">Pending Client Receivables</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <div className="relative group/select min-w-[180px]">
                            <select
                                value={sortByPending}
                                onChange={(e) => setSortByPending(e.target.value)}
                                className="appearance-none w-full bg-white border border-black/5 p-3.5 pr-10 rounded-2xl transition-all text-[#555] group-hover/select:bg-stone-50 text-[10px] font-bold uppercase tracking-widest focus:outline-none shadow-sm"
                            >
                                <option value="Pending (High)">Highest Pending</option>
                                <option value="Pending (Low)">Lowest Pending</option>
                                <option value="Name (A-Z)">Name A-Z</option>
                                <option value="Total (High)">Total Value</option>
                            </select>
                            <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[#555] pointer-events-none" />
                        </div>
                        <div className="flex items-center gap-3 bg-rose-500/10 text-rose-700 px-6 py-3.5 rounded-2xl border border-rose-500/20">
                            <AlertCircle size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-widest pt-0.5">Critical Follow-ups</span>
                        </div>
                    </div>
                </div>
                
                {pendingPayments.length > 0 ? (
                    <div className="space-y-4">
                        <div className="hidden lg:grid grid-cols-12 gap-4 px-8 mb-4 text-[10px] font-bold uppercase tracking-widest text-[#555]">
                            <div className="col-span-4">Client / Project</div>
                            <div className="col-span-2">Total Value</div>
                            <div className="col-span-2">Deposited</div>
                            <div className="col-span-2 text-rose-600">Pending</div>
                            <div className="col-span-2 text-right">Status</div>
                        </div>

                        {sortedPendingPayments.map((p, idx) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.05 * idx }}
                                key={idx} 
                                className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-stone-50/50 border border-black/5 p-6 lg:p-8 rounded-[2rem] hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="col-span-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-200 flex items-center justify-center text-[#1a1a1a] transition-all duration-300">
                                        <User size={20} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h5 className="text-base font-bold text-[#1a1a1a]">{p.name}</h5>
                                            <span className="text-[8px] bg-white border border-black/5 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest text-[#555]">{p.type}</span>
                                        </div>
                                        <p className="text-[10px] text-[#555] mt-1 font-bold uppercase tracking-tight opacity-60">Contract ID: #PA-{idx + 100}</p>
                                    </div>
                                </div>
                                <div className="col-span-2 flex flex-col lg:block font-bold text-[#000]">
                                    <span className="lg:hidden text-[8px] font-bold uppercase text-[#555] mb-1 opacity-50">Total Value</span>
                                    <span className="text-sm">{formatCurrency(p.total)}</span>
                                </div>
                                <div className="col-span-2 flex flex-col lg:block">
                                    <span className="lg:hidden text-[8px] font-bold uppercase text-[#555] mb-1 opacity-50">Deposited</span>
                                    <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {formatCurrency(p.paid)}</span>
                                </div>
                                <div className="col-span-2 flex flex-col lg:block">
                                    <span className="lg:hidden text-[8px] font-bold uppercase text-[#555] mb-1 opacity-50">Pending</span>
                                    <span className="text-sm font-bold text-rose-600 flex items-center gap-1.5"><IndianRupee size={12} /> {formatCurrency(p.pending)}</span>
                                </div>
                                <div className="col-span-2 text-right">
                                    <span className={`inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border ${
                                        p.status === 'Deposit Paid' 
                                        ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' 
                                        : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'Deposit Paid' ? 'bg-amber-500' : 'bg-rose-600 animate-pulse'}`}></div>
                                        {p.status}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-ivory/20 rounded-[2rem] border border-dashed border-ivory">
                        <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-6 opacity-30" />
                        <p className="text-warmgray text-sm font-serif italic">All clients are fully paid up. Portfolio is healthy.</p>
                    </div>
                )}
            </motion.div>

            <AnimatePresence>
                {showExpenseModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setShowExpenseModal(false);
                                setEditExpense(null);
                            }}
                            className="absolute inset-0 bg-stone-900/20 backdrop-blur-xl"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className={`bg-white/80 backdrop-blur-3xl rounded-[3rem] w-full max-w-lg shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] p-10 md:p-14 relative z-[110] border-2 transition-colors duration-500 ${
                                editExpense?.type === 'income' 
                                ? 'bg-gradient-to-br from-emerald-50/40 to-teal-100/40 border-emerald-500/10' 
                                : 'bg-gradient-to-br from-rose-50/40 to-orange-100/40 border-rose-500/10'
                            }`}
                        >
                            <button
                                onClick={() => {
                                    setShowExpenseModal(false);
                                    setEditExpense(null);
                                    setNewExpense({ title: "", amount: "", category: "Operational" });
                                }}
                                className="absolute top-8 right-8 p-3 hover:bg-white/50 rounded-2xl transition-all group border border-transparent hover:border-black/5 shadow-sm"
                            >
                                <X size={20} className="text-stone-400 group-hover:text-stone-900 transition-colors" />
                            </button>
                            
                            <div className="mb-12">
                                <h2 className="font-serif text-4xl text-[#1a1a1a] tracking-tight">{editExpense ? (editExpense.type === 'income' ? 'Edit Invoice' : 'Edit Expense') : 'Log Expense'}</h2>
                                <p className={`text-[10px] uppercase tracking-[0.3em] font-bold mt-3 opacity-60 ${editExpense?.type === 'income' ? 'text-emerald-800' : 'text-rose-800'}`}>
                                    {editExpense?.type === 'income' ? 'Revenue Modification • Studio Asset' : 'Precision Asset Logging • Operational'}
                                </p>
                            </div>
 
                            <form onSubmit={handleExpenseSubmit} className="space-y-8">
                                <div className="space-y-4">
                                    <label className="text-[9px] uppercase font-bold tracking-[0.4em] text-[#555] ml-1 block">Transaction Description</label>
                                    <div className="relative group">
                                        <input
                                            required
                                            value={editExpense ? editExpense.title : newExpense.title}
                                            onChange={e => editExpense ? setEditExpense({ ...editExpense, title: e.target.value }) : setNewExpense({ ...newExpense, title: e.target.value })}
                                            className="w-full bg-white/40 border border-black/[0.05] rounded-2xl px-6 py-5 text-sm focus:outline-none focus:bg-white focus:ring-8 focus:ring-black/[0.01] focus:border-black/10 transition-all duration-500 placeholder:text-stone-300 shadow-sm"
                                            placeholder="e.g. Lens Calibration / Studio Rent"
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <label className="text-[9px] uppercase font-bold tracking-[0.4em] text-[#555] ml-1 block">Amount (₹)</label>
                                        <input
                                            required
                                            type="number"
                                            value={editExpense ? editExpense.amount : newExpense.amount}
                                            onChange={e => editExpense ? setEditExpense({ ...editExpense, amount: e.target.value }) : setNewExpense({ ...newExpense, amount: e.target.value })}
                                            className="w-full bg-white/40 border border-black/[0.05] rounded-2xl px-6 py-5 text-sm focus:outline-none focus:bg-white focus:ring-8 focus:ring-black/[0.01] focus:border-black/10 transition-all duration-500 shadow-sm"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[9px] uppercase font-bold tracking-[0.4em] text-[#555] ml-1 block">Category</label>
                                        <div className="relative group">
                                            <select
                                                value={editExpense ? editExpense.category : newExpense.category}
                                                onChange={e => editExpense ? setEditExpense({ ...editExpense, category: e.target.value }) : setNewExpense({ ...newExpense, category: e.target.value })}
                                                disabled={editExpense?.type === 'income'}
                                                className="w-full bg-white/40 border border-black/[0.05] rounded-2xl px-6 py-5 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:bg-white focus:border-black/10 transition-all appearance-none text-[#1a1a1a] cursor-pointer shadow-sm"
                                            >
                                                <option>Operational</option>
                                                <option>Equipment</option>
                                                <option>Travel</option>
                                                <option>Marketing</option>
                                                <option>Salary</option>
                                                <option>Invoice Payment</option>
                                            </select>
                                            <ChevronRight size={14} className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 text-stone-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                                <button className={`w-full text-white py-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.4em] transition-all active:scale-[0.98] mt-8 flex items-center justify-center gap-3 shadow-xl ${
                                    editExpense?.type === 'income'
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:shadow-emerald-500/20'
                                    : 'bg-gradient-to-r from-rose-600 to-rose-800 hover:shadow-rose-500/20 shadow-rose-900/10'
                                }`}>
                                    {editExpense ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                                    {editExpense ? 'Update Transaction' : 'Confirm Entry'}
                                </button>
                                <p className="text-[8px] text-center text-stone-400 uppercase tracking-widest mt-4">Authorized Financial Entry • studio pipeline</p>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Expanded Chart Modal */}
            <AnimatePresence>
                {expandedChart && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setExpandedChart(null)}
                            className="absolute inset-0 bg-stone-900/40 backdrop-blur-xl"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className="bg-white/95 backdrop-blur-3xl rounded-[3rem] w-full max-w-4xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] p-8 md:p-14 relative z-[130] border border-white/20"
                        >
                            <button
                                onClick={() => setExpandedChart(null)}
                                className="absolute top-8 right-8 p-3 hover:bg-stone-100 rounded-2xl transition-all group border border-transparent hover:border-black/5 shadow-sm"
                            >
                                <X size={20} className="text-stone-400 group-hover:text-stone-900 transition-colors" />
                            </button>
                            
                            <div className="mb-10">
                                <h2 className="font-serif text-3xl md:text-4xl text-[#1a1a1a] tracking-tight">{expandedChart} Trend</h2>
                                <p className="text-[10px] uppercase tracking-[0.3em] font-bold mt-3 opacity-60 text-stone-500">
                                    6-Month Historical Data view
                                </p>
                            </div>
                            
                            <div className="h-[300px] md:h-[400px] w-full bg-stone-50/50 rounded-[2rem] border border-black/5 p-4 md:p-8 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>
                                <ResponsiveContainer width="100%" height="100%">
                                    {renderExpandedChart()}
                                </ResponsiveContainer>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
