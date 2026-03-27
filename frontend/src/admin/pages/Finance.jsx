import { useState, useEffect } from "react";
import axios from "axios";
import { IndianRupee, TrendingUp, TrendingDown, ArrowUpRight, Filter, Download, Plus, X } from "lucide-react";
import toast from "react-hot-toast";

export default function Finance() {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const [stats, setStats] = useState({ annualSales: 0, annualProfit: 0, expenses: 0, pendingRevenue: 0 });
    const [transactions, setTransactions] = useState([]);
    const [allocation, setAllocation] = useState([]);
    const [pendingPayments, setPendingPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [newExpense, setNewExpense] = useState({ title: "", amount: "", category: "Operational" });
    const [editExpense, setEditExpense] = useState(null);
    const [filterCategory, setFilterCategory] = useState("All");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [overviewRes, txRes, allocRes, pendingRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL || ""}/api/finance/overview`, authHeader),
                axios.get(`${import.meta.env.VITE_API_URL || ""}/api/finance/transactions`, authHeader),
                axios.get(`${import.meta.env.VITE_API_URL || ""}/api/finance/allocation`, authHeader),
                axios.get(`${import.meta.env.VITE_API_URL || ""}/api/finance/pending-payments`, authHeader)
            ]);
            setStats(overviewRes.data);
            setTransactions(txRes.data);
            setAllocation(allocRes.data);
            setPendingPayments(pendingRes.data);
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

    const handleDeleteClick = async (id, type) => {
        if (!window.confirm("Delete this transaction?")) return;

        try {
            if (type === 'income') {
                await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/invoices/${id}`, authHeader);
                toast.success("Invoice deleted");
            } else {
                await axios.delete(`${import.meta.env.VITE_API_URL || ""}/api/finance/expense/${id}`, authHeader);
                toast.success("Expense deleted");
            }
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete transaction");
        }
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editExpense) {
                if (editExpense.type === 'income') {
                    await axios.put(`${import.meta.env.VITE_API_URL || ""}/api/invoices/${editExpense.id}`, {
                        clientName: editExpense.title,
                        total: editExpense.amount,
                        invoiceDate: editExpense.date,
                        status: editExpense.status
                    });
                    toast.success("Transaction updated");
                } else {
                    await axios.put(`${import.meta.env.VITE_API_URL || ""}/api/finance/expense/${editExpense.id}`, editExpense, authHeader);
                    toast.success("Expense updated");
                }
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/finance/expense`, newExpense, authHeader);
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

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="space-y-8 md:space-y-12 text-charcoal px-4 md:px-0 animate-in fade-in duration-1500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in slide-in-from-top-8 duration-1000 fill-mode-forwards">
                <div>
                    <h1 className="font-serif text-3xl md:text-5xl animate-gentle-fade">Financial Ledger</h1>
                    <p className="text-[10px] md:text-xs text-warmgray mt-3 font-bold uppercase tracking-[0.4em]">Tracking luxury growth and studio metrics.</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => {
                            setEditExpense(null);
                            setShowExpenseModal(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-charcoal text-white px-6 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all shadow-xl"
                    >
                        <Plus size={18} /> Log Expense
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 border border-ivory bg-white px-6 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-ivory transition-all shadow-sm">
                        <Download size={18} /> Export
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 fill-mode-backwards">
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-ivory shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-700">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-charcoal group-hover:scale-110 transition-transform duration-700">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] text-warmgray uppercase tracking-[0.2em] font-bold mb-4">Annual Sales</p>
                    <h3 className="text-2xl md:text-4xl font-serif text-charcoal">{formatCurrency(stats.annualSales)}</h3>
                    <div className="mt-8 flex items-center gap-2 text-[10px] text-green-600 font-bold uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Live Revenue
                    </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-ivory shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-700">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-charcoal group-hover:scale-110 transition-transform duration-700">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] text-warmgray uppercase tracking-[0.2em] font-bold mb-4">Pending Revenue</p>
                    <h3 className="text-2xl md:text-4xl font-serif text-charcoal">{formatCurrency(stats.pendingRevenue || 0)}</h3>
                    <div className="mt-8 flex items-center gap-2 text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Awaiting Payments
                    </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-ivory shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-700">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-charcoal group-hover:scale-110 transition-transform duration-700">
                        <TrendingDown size={120} />
                    </div>
                    <p className="text-[10px] text-warmgray uppercase tracking-[0.2em] font-bold mb-4">Total Expenses</p>
                    <h3 className="text-2xl md:text-4xl font-serif text-charcoal">{formatCurrency(stats.expenses)}</h3>
                    <div className="mt-8 flex items-center gap-2 text-[10px] text-amber-600 font-bold uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        Operational Costs
                    </div>
                </div>

                <div className="bg-charcoal p-6 md:p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-700">
                    <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none"></div>
                    <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-bold mb-4">Studio Profit</p>
                    <h3 className="text-2xl md:text-4xl font-serif text-ivory">{formatCurrency(stats.annualProfit)}</h3>
                    <div className="mt-8 flex items-center gap-2 text-[10px] text-gold font-bold uppercase tracking-[0.2em] italic truncate">
                        "Precision Over Volume"
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1500 delay-300 fill-mode-backwards">
                <div className="bg-white rounded-[2.5rem] border border-ivory shadow-sm p-8 md:p-12 overflow-hidden hover:shadow-xl transition-shadow duration-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                        <h4 className="font-serif text-2xl md:text-3xl">Recent Transactions</h4>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="flex-1 sm:flex-none p-3 border border-ivory rounded-xl hover:bg-ivory transition-all text-warmgray bg-transparent focus:outline-mutedbrown text-[10px] font-bold uppercase tracking-widest appearance-none"
                            >
                                <option value="All">All</option>
                                <option value="Income">Income</option>
                                <option value="Expense">Expenses</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-8">
                        {filteredTransactions.length > 0 ? filteredTransactions.map((tx, i) => (
                            <div key={i} className="flex items-center justify-between pb-8 border-b border-ivory/60 last:border-0 last:pb-0 group/row relative">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        <IndianRupee size={18} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-charcoal">{tx.name}</h5>
                                        <p className="text-[10px] text-warmgray mt-1 font-bold uppercase tracking-tight">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-base font-bold text-charcoal">{tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}</div>
                                        {tx.pendingAmount > 0 && (
                                            <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5 text-blue-600">
                                                Awaiting: {formatCurrency(tx.pendingAmount)}
                                            </div>
                                        )}
                                        <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${tx.status === 'Success' || tx.status === 'Paid' ? 'text-green-600' : 'text-amber-600'
                                            }`}>{tx.status}</div>
                                    </div>
                                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => handleEditClick(tx)} className="p-2 hover:bg-ivory rounded-lg text-warmgray hover:text-charcoal"><Filter size={14} className="rotate-90" /></button>
                                        <button onClick={() => handleDeleteClick(tx.id, tx.type)} className="p-2 hover:bg-red-50 rounded-lg text-warmgray hover:text-red-600"><X size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-warmgray text-sm italic py-10 animate-gentle-fade">No recent transactions.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-ivory shadow-sm p-8 md:p-12 hover:shadow-xl transition-shadow duration-700">
                    <div className="flex justify-between items-center mb-10">
                        <h4 className="font-serif text-2xl md:text-3xl">Treasury Allocation</h4>
                        <button className="text-[10px] font-bold uppercase tracking-widest text-mutedbrown bg-ivory/50 px-4 py-2 rounded-full">FY 2025-26</button>
                    </div>
                    <div className="space-y-10">
                        {allocation.length > 0 ? allocation.map((exp, idx) => {
                            const getCategoryColor = (category) => {
                                const map = {
                                    'Equipment': 'bg-emerald-600',
                                    'Travel': 'bg-blue-600',
                                    'Marketing': 'bg-amber-500',
                                    'Operational': 'bg-slate-500',
                                    'Salary': 'bg-rose-500',
                                    'Invoice Payment': 'bg-purple-600'
                                };
                                return map[category] || 'bg-gray-400';
                            };

                            return (
                                <div key={idx} className="group/exp">
                                    <div className="flex justify-between text-[11px] mb-3 font-bold uppercase tracking-widest">
                                        <span className="text-warmgray group-hover/exp:text-charcoal transition-colors">{exp.label}</span>
                                        <span className="text-charcoal">{formatCurrency(exp.value)} <span className="text-warmgray ml-1 opacity-70">({exp.progress}%)</span></span>
                                    </div>
                                    <div className="w-full bg-ivory h-2.5 rounded-full overflow-hidden shadow-inner p-0.5">
                                        <div className={`${getCategoryColor(exp.label)} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${exp.progress}%` }} />
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-warmgray text-sm italic py-10">No expense data available.</p>
                        )}
                    </div>

                    <div className="mt-12 p-6 bg-ivory/40 rounded-3xl border border-ivory font-serif italic text-sm text-center text-warmgray">
                        "Wealth is the ability to fully experience life."
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-ivory shadow-sm p-8 md:p-12 hover:shadow-xl transition-shadow duration-700 animate-in fade-in slide-in-from-bottom-12 delay-500 fill-mode-backwards mt-12">
                <div className="flex justify-between items-center mb-10">
                    <h4 className="font-serif text-2xl md:text-3xl">Pending Client Receivables</h4>
                    <button className="text-[10px] font-bold uppercase tracking-widest text-[#1aa0a0] bg-[#1aa0a0]/10 px-4 py-2 rounded-full">Follow-ups</button>
                </div>
                {pendingPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-ivory text-[10px] uppercase tracking-widest text-warmgray">
                                    <th className="py-4 font-bold">Client / Inquiry</th>
                                    <th className="py-4 font-bold">Total Value</th>
                                    <th className="py-4 font-bold">Deposited / Paid</th>
                                    <th className="py-4 font-bold text-red-600">Pending Amount</th>
                                    <th className="py-4 font-bold text-right hidden sm:table-cell">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingPayments.map((p, idx) => (
                                    <tr key={idx} className="border-b border-ivory/50 last:border-0 hover:bg-ivory/20 transition-colors">
                                        <td className="py-4 font-bold text-sm text-charcoal">{p.name} <span className="text-[9px] text-warmgray ml-2">{p.type}</span></td>
                                        <td className="py-4 text-sm font-medium">{formatCurrency(p.total)}</td>
                                        <td className="py-4 text-sm font-medium text-green-700">{formatCurrency(p.paid)}</td>
                                        <td className="py-4 text-sm font-bold text-amber-600">{formatCurrency(p.pending)}</td>
                                        <td className="py-4 text-right hidden sm:table-cell">
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded ${p.status === 'Deposit Paid' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-warmgray text-sm italic py-10 animate-gentle-fade">All clients are fully paid up.</p>
                )}
            </div>

            {showExpenseModal && (
                <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-2xl z-100 flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-[0_0_60px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500 p-8 relative">
                        <button
                            onClick={() => {
                                setShowExpenseModal(false);
                                setEditExpense(null);
                                setNewExpense({ title: "", amount: "", category: "Operational" });
                            }}
                            className="absolute top-4 right-4 p-2 hover:bg-ivory rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                        <h2 className="font-serif text-2xl mb-1">{editExpense ? (editExpense.type === 'income' ? 'Edit Invoice' : 'Edit Expense') : 'Log Expense'}</h2>
                        <p className="text-[10px] uppercase tracking-widest text-warmgray font-bold mb-6">Record operational costs</p>

                        <form onSubmit={handleExpenseSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">{editExpense?.type === 'income' ? 'Client Name' : 'Title'}</label>
                                <input
                                    required
                                    value={editExpense ? editExpense.title : newExpense.title}
                                    onChange={e => editExpense ? setEditExpense({ ...editExpense, title: e.target.value }) : setNewExpense({ ...newExpense, title: e.target.value })}
                                    className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors"
                                    placeholder="e.g. Camera Lens Rental"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Amount (₹)</label>
                                <input
                                    required
                                    type="number"
                                    value={editExpense ? editExpense.amount : newExpense.amount}
                                    onChange={e => editExpense ? setEditExpense({ ...editExpense, amount: e.target.value }) : setNewExpense({ ...newExpense, amount: e.target.value })}
                                    className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors"
                                    placeholder="0.00"
                                />
                            </div>
                            {editExpense && (
                                <div>
                                    <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Status</label>
                                    <select
                                        value={editExpense.status || (editExpense.type === 'income' ? 'Pending' : 'Paid')}
                                        onChange={e => setEditExpense({ ...editExpense, status: e.target.value })}
                                        className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors appearance-none"
                                    >
                                        <option value="Pending">Pending / Unpaid</option>
                                        <option value="Paid">Paid / Received</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Category</label>
                                <select
                                    value={editExpense ? editExpense.category : newExpense.category}
                                    onChange={e => editExpense ? setEditExpense({ ...editExpense, category: e.target.value }) : setNewExpense({ ...newExpense, category: e.target.value })}
                                    disabled={editExpense?.type === 'income'}
                                    className="w-full bg-ivory/50 border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mutedbrown transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option>Operational</option>
                                    <option>Equipment</option>
                                    <option>Travel</option>
                                    <option>Marketing</option>
                                    <option>Salary</option>
                                    <option>Invoice Payment</option>
                                </select>
                            </div>
                            <button className="w-full bg-charcoal text-white py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-mutedbrown transition-all shadow-lg active:scale-95 mt-4">
                                {editExpense ? (editExpense.type === 'income' ? 'Update Invoice' : 'Update Expense') : 'Confirm Expense'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
