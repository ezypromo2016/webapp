import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Printer, 
  Plus, 
  Search, 
  Trash2, 
  Download, 
  FileSpreadsheet,
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  History, 
  Settings, 
  LogOut,
  Menu,
  X,
  CreditCard,
  ClipboardList,
  SmartphoneNfc,
  Users,
  IdCard,
  Hash,
  Type,
  Check,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  Globe,
  TrendingUp,
  Zap,
  Briefcase,
  Lock,
  Pencil
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from "recharts";
import { useAuth } from "../lib/auth";
import { CashDrawer } from "../lib/cashDrawer";
import { API } from "../lib/api";
import { db } from "../lib/db";
import * as XLSX from "xlsx";

// ✅ COMMENTED OUT TO UNBLOCK LINUX COMPILATION ERRORS DURING RENDER BUILD
// import PrinterDiagnostics from "../components/PrinterDiagnostics";

interface PrintingEntry {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  total: number;
  created_at: string;
}

interface PrintingExpense {
  id: string;
  description: string;
  amount: number;
  created_at: string;
}

export default function Printing({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  
  const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", allowed: true },
    { icon: Clock, label: "Attendance", id: "attendance", allowed: true },
    { icon: ShoppingCart, label: "Cashier", id: "pos", allowed: true },
    { icon: ClipboardList, label: "Orders", id: "orders", allowed: true },
    { icon: SmartphoneNfc, label: "GCash Tracker", id: "gcash", allowed: true },
    { icon: Package, label: "Inventory", id: "inventory", allowed: isAdmin && !isRestrictedUser },
    { icon: History, label: "Transactions", id: "transactions", allowed: true },
    { icon: Users, label: "SUKICARD MEMBERS", id: "customers", allowed: isAdmin && !isRestrictedUser },
    { icon: IdCard, label: "SUKICARD Generator", id: "generator", allowed: isAdmin && !isRestrictedUser },
    { icon: Printer, label: "Printing Sales", id: "printing", allowed: isAdmin && !isRestrictedUser },
    { icon: CreditCard, label: "Credit Tracker", id: "credit-tracker", allowed: isAdmin && !isRestrictedUser },
    { icon: Briefcase, label: "SOS CREDIT", id: "sos-credit", allowed: isAdmin && !isRestrictedUser },
    { icon: Settings, label: "Settings", id: "settings", allowed: isAdmin && !isRestrictedUser }
  ];
  const [entries, setEntries] = useState<PrintingEntry[]>([]);
  const [expenses, setExpenses] = useState<PrintingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PrintingEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<PrintingExpense | null>(null);
  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);

  // Form state for sales
  const [formData, setFormData] = useState({
    description: "",
    category: "PRINTING", // Default category
    amount: ""
  });

  // Form state for expenses
  const [expenseData, setExpenseData] = useState({
    description: "",
    amount: ""
  });

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string, type: 'sale' | 'expense'} | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const SUGGESTIONS = ["PHOTOCOPY", "PRINTING"];

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, expRes, pending] = await Promise.all([
        API.get("/printing").catch(() => ({ data: [] })),
        API.get("/printing_expenses").catch(() => ({ data: [] })),
        db.pendingTransactions.where('path').equals('/printing').toArray()
      ]);
      
      const serverEntries = res.data || [];
      const pendingEntries = pending.map(p => p.data);
      
      const combined = [...pendingEntries, ...serverEntries].reduce((acc: any[], curr) => {
        const id = curr.id;
        if (!acc.some(e => e.id === id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setEntries(combined);
      setExpenses(expRes.data || []);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate("dashboard");
      return;
    }
    fetchData();

    const handleSyncSuccess = () => {
      fetchData();
    };

    window.addEventListener("swiftpos-sync-success", handleSyncSuccess);
    return () => window.removeEventListener("swiftpos-sync-success", handleSyncSuccess);
  }, []);

  const totalCalculated = parseFloat(formData.amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        description: formData.description || formData.category,
        category: formData.category,
        amount: totalCalculated,
        quantity: 1, 
        total: totalCalculated,
        created_at: editingEntry ? editingEntry.created_at : new Date().toISOString()
      };

      if (editingEntry) {
        await API.put(`/printing/${editingEntry.id}`, payload);
        addToast("Record updated successfully");
      } else {
        await API.post("/printing", payload);
        addToast("Record saved successfully");
        
        // Auto-open cash drawer for new printing sales
        try {
          await CashDrawer.open();
        } catch (drawerErr: any) {
          if (drawerErr.name !== 'NotFoundError' && !drawerErr.message?.includes("No port selected") && !drawerErr.message?.includes("No device selected")) {
            console.error("Failed to open cash drawer:", drawerErr);
          }
        }
      }
      
      setShowModal(false);
      setEditingEntry(null);
      setFormData({ description: "", category: "PRINTING", amount: "" });
      fetchData();
    } catch (err) {
      addToast(editingEntry ? "Failed to update record" : "Failed to save record", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        description: expenseData.description,
        amount: parseFloat(expenseData.amount) || 0,
        created_at: editingExpense ? editingExpense.created_at : new Date().toISOString()
      };

      if (editingExpense) {
        await API.put(`/printing_expenses/${editingExpense.id}`, payload);
        addToast("Expense updated successfully");
      } else {
        await API.post("/printing_expenses", payload);
        addToast("Expense saved successfully");
      }

      setShowExpenseModal(false);
      setEditingExpense(null);
      setExpenseData({ description: "", amount: "" });
      fetchData();
    } catch (err) {
      addToast(editingExpense ? "Failed to update expense" : "Failed to save expense", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (entry: PrintingEntry) => {
    setEditingEntry(entry);
    setFormData({
      category: (entry as any).category || "PRINTING",
      description: entry.description === ((entry as any).category || "PRINTING") ? "" : entry.description,
      amount: entry.amount.toString()
    });
    setShowModal(true);
  };

  const startExpenseEdit = (expense: PrintingExpense) => {
    setEditingExpense(expense);
    setExpenseData({
      description: expense.description,
      amount: expense.amount.toString()
    });
    setShowExpenseModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const path = deleteConfirm.type === 'sale' ? `/printing/${deleteConfirm.id}` : `/printing_expenses/${deleteConfirm.id}`;
      await API.delete(path);
      addToast("Record purged");
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      addToast("Delete failed", "error");
    }
  };

  const safeDate = (dateStr: any) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const handleResetAll = async () => {
    setIsSubmitting(true);
    try {
      await Promise.all([
        ...entries.map(e => API.delete(`/printing/${e.id}`)),
        ...expenses.map(e => API.delete(`/printing_expenses/${e.id}`))
      ]);
      addToast("Database purged successfully");
      setShowResetConfirm(false);
      fetchData();
    } catch (err) {
      addToast("Reset failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredEntries.length > 0 || filteredExpenses.length > 0 ? [...filteredEntries, ...filteredExpenses] : [...entries, ...expenses];
    
    if (dataToExport.length === 0) {
      addToast("No data to export", "error");
      return;
    }

    const dates = dataToExport.map(e => safeDate(e.created_at)).filter(d => d !== null) as Date[];
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    
    const summaryData = [
      { 'METRIC': 'REPORT TITLE', 'VALUE': 'PRINTING SALES & EXPENSES AUDIT' },
      { 'METRIC': 'DATE COVERED', 'VALUE': `${minDate?.toLocaleDateString() || 'N/A'} - ${maxDate?.toLocaleDateString() || 'N/A'}` },
      { 'METRIC': 'GENERATED AT', 'VALUE': new Date().toLocaleString() },
      { 'METRIC': '', 'VALUE': '' },
      { 'METRIC': 'TOTAL SALES', 'VALUE': stats.totalSales },
      { 'METRIC': 'TOTAL EXPENSES', 'VALUE': stats.totalExpenses },
      { 'METRIC': 'NET PROFIT', 'VALUE': stats.totalNet },
      { 'METRIC': '', 'VALUE': '' },
      { 'METRIC': '--- DETAILED RECORDS ---', 'VALUE': '' }
    ];

    const salesHeader = [{ 'Type': 'SALES RECORDS', 'Description': '', 'Amount': '', 'Quantity': '', 'Total': '', 'Date': '' }];
    const salesData = filteredEntries.map(e => ({
      'Type': 'SALE',
      'Description': e.description,
      'Amount': e.amount,
      'Quantity': e.quantity,
      'Total': e.total,
      'Date': safeDate(e.created_at)?.toLocaleString() || 'N/A'
    }));

    const expensesHeader = [{ 'Type': 'EXPENSE RECORDS', 'Description': '', 'Amount': '', 'Quantity': '', 'Total': '', 'Date': '' }];
    const expensesData = filteredExpenses.map(e => ({
      'Type': 'EXPENSE',
      'Description': e.description,
      'Amount': e.amount,
      'Quantity': 1,
      'Total': -e.amount,
      'Date': safeDate(e.created_at)?.toLocaleString() || 'N/A'
    }));

    const wb = XLSX.utils.book_new();
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const wsDetails = XLSX.utils.json_to_sheet([...salesHeader, ...salesData, { 'Type': '' }, ...expensesHeader, ...expensesData]);
    XLSX.utils.book_append_sheet(wb, wsDetails, "Detailed Audit");
    
    XLSX.writeFile(wb, `Printing_Audit_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast("Export complete with Summary");
  };

  const filteredEntries = entries.filter(e => {
    const matchesSearch = (e.description || "").toLowerCase().includes(search.toLowerCase());
    if (!startDate && !endDate) return matchesSearch;
    const entryDate = safeDate(e.created_at);
    if (!entryDate) return false;
    entryDate.setHours(0, 0, 0, 0);
    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(0, 0, 0, 0);
    let matchesDate = true;
    if (start && entryDate < start) matchesDate = false;
    if (end && entryDate > end) matchesDate = false;
    return matchesSearch && matchesDate;
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = (e.description || "").toLowerCase().includes(search.toLowerCase());
    if (!startDate && !endDate) return matchesSearch;
    const entryDate = safeDate(e.created_at);
    if (!entryDate) return false;
    entryDate.setHours(0, 0, 0, 0);
    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(0, 0, 0, 0);
    let matchesDate = true;
    if (start && entryDate < start) matchesDate = false;
    if (end && entryDate > end) matchesDate = false;
    return matchesSearch && matchesDate;
  });

  const stats = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const getMonthStats = (entriesList: PrintingEntry[], expensesList: PrintingExpense[], month: number, year: number) => {
      const filteredEntries = entriesList.filter(e => {
        const d = safeDate(e.created_at);
        return d && d.getMonth() === month && d.getFullYear() === year;
      });
      const filteredExpenses = expensesList.filter(e => {
        const d = safeDate(e.created_at);
        return d && d.getMonth() === month && d.getFullYear() === year;
      });

      const sales = filteredEntries.reduce((acc, curr) => acc + curr.total, 0);
      const expenses = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      
      const byCategory = filteredEntries.reduce((acc: any, curr) => {
        const cat = (curr as any).category || (curr.description?.toUpperCase() === "2X2" ? "2X2" : curr.description?.toUpperCase() === "PHOTOCOPY" ? "PHOTOCOPY" : "PRINTING");
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += curr.total;
        return acc;
      }, {});

      return { 
        sales, 
        expenses, 
        net: sales - expenses,
        categories: {
          photocopy: byCategory["PHOTOCOPY"] || 0,
          printing: byCategory["PRINTING"] || byCategory["PRINTING SALES"] || 0,
          twoByTwo: byCategory["2X2"] || 0
        }
      };
    };

    const thisMonth = getMonthStats(entries, expenses, currentMonth, currentYear);
    const prevMonth = getMonthStats(entries, expenses, lastMonth, lastYear);

    const todayStr = now.toDateString();
    
    const dailySales = entries.reduce((acc, curr) => {
      const d = safeDate(curr.created_at);
      return (d && d.toDateString() === todayStr) ? acc + curr.total : acc;
    }, 0);

    const dailyExpenses = expenses.reduce((acc, curr) => {
      const d = safeDate(curr.created_at);
      return (d && d.toDateString() === todayStr) ? acc + curr.amount : acc;
    }, 0);

    const totalSales = entries.reduce((acc, curr) => acc + curr.total, 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    const salesByCategory = entries.reduce((acc: any, curr) => {
      const cat = (curr as any).category || (curr.description?.toUpperCase() === "2X2" ? "2X2" : curr.description?.toUpperCase() === "PHOTOCOPY" ? "PHOTOCOPY" : "PRINTING");
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += curr.total;
      return acc;
    }, {});
    
    return { 
      thisMonth,
      prevMonth,
      dailySales, 
      dailyExpenses,
      dailyNet: dailySales - dailyExpenses,
      totalSales,
      totalExpenses,
      totalNet: totalSales - totalExpenses,
      total2x2: salesByCategory["2X2"] || 0,
      totalPhotocopy: salesByCategory["PHOTOCOPY"] || 0,
      totalPrinting: salesByCategory["PRINTING"] || salesByCategory["PRINTING SALES"] || 0
    };
  }, [entries, expenses]);

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP' 
    }).format(n);

  const handlePrint = (entry: PrintingEntry) => {
    const txn = {
      transactionNumber: `PRNT-${entry.id.substring(0, 8).toUpperCase()}`,
      created_at: entry.created_at,
      customer: { name: "Service Customer" },
      cashier: { name: user?.name || "Cashier" },
      paymentMethod: "CASH",
      items: [{
        name: entry.description,
        qty: entry.quantity,
        price: entry.amount
      }],
      total: entry.total
    };
    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex flex-col font-sans transition-colors duration-300">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              layout
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              key={toast.id}
               className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border pointer-events-auto backdrop-blur-md ${
                 toast.type === "success" 
                   ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/10" 
                   : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 dark:bg-rose-500/10"
               }`}
            >
              {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="text-[9px] font-black uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-1">
        {/* Sidebar Backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transition-colors duration-300 lg:translate-x-0 lg:static
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          dark:bg-[#111218] dark:border-white/5
        `}>
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 uppercase dark:text-white">SwiftPOS</span>
          </div>
          <nav className="mt-6 px-4 space-y-1.5 font-sans">
            {sidebarItems.map((item, idx) => {
              const isActive = currentPage === item.id;
              return (
                <button 
                  key={idx} 
                  onClick={() => item.allowed && navigate(item.id as any)}
                  disabled={!item.allowed}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${!item.allowed ? 'opacity-30 cursor-not-allowed filter grayscale' : ''}
                    ${isActive 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
                      : (item.allowed ? 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200' : 'text-slate-500')}
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {!item.allowed && <Lock className="w-3 h-3 ml-auto opacity-50" />}
                </button>
              );
            })}
          </nav>
          <div className="absolute bottom-8 left-0 w-full px-6">
             <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm dark:bg-white/5 dark:border-transparent dark:hover:bg-rose-600"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="p-3 md:p-4 lg:p-7 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl dark:bg-[#0a0a0f]/50 dark:border-white/5 sticky top-0 z-30">
            <div className="flex items-center gap-3 md:gap-5">
              <button className="lg:hidden p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl dark:hover:bg-white/5 dark:bg-white/5" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl md:text-3xl font-black text-slate-900 leading-none dark:text-white">Printing</h1>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 md:mt-2">Service Audit</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Date Filters */}
              <div className="flex items-center gap-2 flex-1 md:flex-none">
                <div className="relative flex-1 md:w-40">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 md:py-2.5 pl-9 pr-3 text-[9px] md:text-[10px] font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:bg-[#15161d] dark:border-white/5 dark:text-white"
                  />
                </div>
                <div className="text-slate-300 dark:text-slate-800 text-[10px] font-black">TO</div>
                <div className="relative flex-1 md:w-40">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 md:py-2.5 pl-9 pr-3 text-[9px] md:text-[10px] font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:bg-[#15161d] dark:border-white/5 dark:text-white"
                  />
                </div>
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                    title="Clear dates"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors group-focus-within:text-indigo-500" />
                <input 
                  type="text" 
                  placeholder="SEARCH..." 
                  value={search}
                  onChange={e => setSearch(e.target.value.toUpperCase())}
                  className="bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.25rem] py-2.5 md:py-3 pl-11 pr-5 text-[9px] md:text-[10px] font-black text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 w-full md:w-48 lg:w-64 transition-all dark:bg-[#15161d] dark:border-white/5 dark:text-white dark:placeholder:text-slate-800 uppercase"
                />
              </div>
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 rounded-xl md:rounded-[1.25rem] transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-rose-500 hover:text-white dark:bg-rose-500/5 dark:border-rose-500/10 group"
                title="Reset all records"
              >
                <Trash2 className="w-4 h-4 group-hover:animate-pulse" /> 
                <span className="hidden sm:inline">Reset All</span>
              </button>
              <button 
                onClick={exportToExcel}
                className="flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl md:rounded-[1.25rem] transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-600 dark:bg-white/5 dark:border-white/5 dark:text-slate-500 dark:hover:text-white"
              >
                <FileSpreadsheet className="w-4 h-4" /> 
                <span className="hidden sm:inline">Export</span>
              </button>
              <button 
                onClick={() => setShowDiagnostics(true)}
                className="flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl md:rounded-[1.25rem] transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-600 dark:bg-white/5 dark:border-white/5 dark:text-slate-500 dark:hover:text-white"
                title="Printer Diagnostics"
              >
                <Printer className="w-4 h-4" /> 
                <span className="hidden sm:inline">Diagnostics</span>
              </button>
              <button 
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center gap-2 px-5 md:px-6 py-2.5 md:py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl md:rounded-[1.25rem] transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" /> 
                <span className="hidden sm:inline">Add Sales</span>
              </button>
            </div>
          </header>

          <div className="p-6 lg:p-10 flex-1 space-y-12">
            {/* Daily Performance Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                <div className="px-5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.4em]">Today's Performance • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {[
                  { label: "Daily Sales", value: stats.dailySales, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                  { label: "Daily Expenses", value: stats.dailyExpenses, icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", iconRotate: true },
                  { label: "Daily Net", value: stats.dailyNet, icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                ].map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={stat.label} 
                    className={`relative overflow-hidden bg-white/70 dark:bg-[#111218]/80 backdrop-blur-xl border ${stat.border} p-8 rounded-[2.5rem] shadow-sm flex items-center gap-6 group hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}
                  >
                    <div className={`w-16 h-16 rounded-[1.5rem] ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ${stat.iconRotate ? 'rotate-180' : ''}`}>
                      <stat.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums leading-none">
                        {formatCurrency(stat.value)}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${stat.color.replace('text', 'bg')} animate-pulse`} />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Real-time</span>
                      </div>
                    </div>
                    <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${stat.bg} blur-3xl opacity-0 group-hover:opacity-40 transition-opacity`} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Monthly Analytics Panel */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                <div className="px-5 py-1.5 rounded-full bg-indigo-600/10 border border-indigo-500/20">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em]">Current Month • {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {[
                  { label: "Monthly Sales", value: stats.thisMonth.sales, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                  { label: "Monthly Expenses", value: stats.thisMonth.expenses, icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", iconRotate: true },
                  { label: "Monthly Net", value: stats.thisMonth.net, icon: Zap, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                ].map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={stat.label} 
                    className={`relative overflow-hidden bg-white/70 dark:bg-[#111218]/80 backdrop-blur-xl border ${stat.border} p-8 rounded-[2.5rem] shadow-sm flex items-center gap-6 group hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}
                  >
                    <div className={`w-16 h-16 rounded-[1.5rem] ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ${stat.iconRotate ? 'rotate-180' : ''}`}>
                      <stat.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums leading-none">
                        {formatCurrency(stat.value)}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${stat.color.replace('text', 'bg')} animate-pulse`} />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Audit</span>
                      </div>
                    </div>
                    <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${stat.bg} blur-3xl opacity-0 group-hover:opacity-40 transition-opacity`} />
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                <div className="px-5 py-1.5 rounded-full bg-slate-600/10 border border-slate-500/20">
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.4em]">Monthly Service Breakdown</span>
                </div>
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {[
                  { label: "2X2 Sales", value: stats.thisMonth.categories.twoByTwo, icon: IdCard, color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20" },
                  { label: "Photocopy Sales", value: stats.thisMonth.categories.photocopy, icon: ClipboardList, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
                  { label: "Printing Sales", value: stats.thisMonth.categories.printing, icon: Printer, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                ].map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (i + 3) * 0.1 }}
                    key={stat.label} 
                    className={`relative overflow-hidden bg-white/70 dark:bg-[#111218]/80 backdrop-blur-xl border ${stat.border} p-6 rounded-[2rem] shadow-sm flex items-center gap-5 group hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}
                  >
                    <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 text-center md:text-left">{stat.label}</p>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums leading-none">
                        {formatCurrency(stat.value)}
                      </h3>
                    </div>
                    <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full ${stat.bg} blur-2xl opacity-0 group-hover:opacity-30 transition-opacity`} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Performance History Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                <div className="px-5 py-1.5 rounded-full bg-slate-600/10 border border-slate-500/20">
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.4em]">Performance History</span>
                </div>
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div 
                   initial={{ opacity: 0, x: -20 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   viewport={{ once: true }}
                   className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-white/5"
                >
                  <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] group-hover:bg-indigo-500/20 transition-all duration-1000" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 h-full">
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md text-white">
                          <History className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-white text-lg font-black uppercase tracking-tight">Last Month Overview</h3>
                          <p className="text-indigo-300/60 text-[10px] font-black uppercase tracking-widest mt-0.5">May 2026 Audit Summary</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                        <div>
                          <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Sales Generated</p>
                          <p className="text-2xl font-black text-white tabular-nums">{formatCurrency(stats.prevMonth.sales)}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Total Expenses</p>
                          <p className="text-2xl font-black text-rose-400 tabular-nums">{formatCurrency(stats.prevMonth.expenses)}</p>
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-white/30 text-[8px] font-black uppercase tracking-widest mb-1">2X2</p>
                          <p className="text-sm font-black text-white/80 tabular-nums">{formatCurrency(stats.prevMonth.categories.twoByTwo)}</p>
                        </div>
                        <div>
                          <p className="text-white/30 text-[8px] font-black uppercase tracking-widest mb-1">Photocopy</p>
                          <p className="text-sm font-black text-white/80 tabular-nums">{formatCurrency(stats.prevMonth.categories.photocopy)}</p>
                        </div>
                        <div>
                          <p className="text-white/30 text-[8px] font-black uppercase tracking-widest mb-1">Printing</p>
                          <p className="text-sm font-black text-white/80 tabular-nums">{formatCurrency(stats.prevMonth.categories.printing)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-2xl rounded-[2rem] p-8 border border-white/10 flex flex-col items-center justify-center text-center min-w-[200px] group-hover:scale-105 transition-transform duration-500">
                       <Zap className="w-8 h-8 text-amber-400 mb-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                       <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Net Performance</p>
                       <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(stats.prevMonth.net)}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-white/70 dark:bg-[#111218]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-600/20">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white text-sm font-black uppercase tracking-tight">Growth Trend</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Month-over-month</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400">MAY VS JUNE</span>
                       <span className={`text-[10px] font-black ${stats.thisMonth.sales > stats.prevMonth.sales ? 'text-emerald-500' : 'text-rose-500'}`}>
                         {stats.prevMonth.sales > 0 ? (((stats.thisMonth.sales - stats.prevMonth.sales) / stats.prevMonth.sales) * 100).toFixed(1) : 0}%
                       </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: '70%' }}
                        className="h-full bg-indigo-600"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Sales Distribution Chart and Category Breakdown */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 bg-white/70 dark:bg-[#15161d]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-xl flex flex-col md:flex-row items-center gap-10">
                <div className="w-full h-[300px] relative flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '2X2', value: stats.total2x2 || 0.0001 },
                          { name: 'PHOTOCOPY', value: stats.totalPhotocopy || 0.0001 },
                          { name: 'PRINTING', value: stats.totalPrinting || 0.0001 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill="#f5d0fe" className="fill-fuchsia-500" />
                        <Cell fill="#a5f3fc" className="fill-cyan-500" />
                        <Cell fill="#bfdbfe" className="fill-blue-500" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#111218', 
                          border: 'none', 
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: '900',
                          textTransform: 'uppercase'
                        }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: any) => formatCurrency(value === 0.0001 ? 0 : value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Sales</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(stats.total2x2 + stats.totalPhotocopy + stats.totalPrinting)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-6 w-full">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Sales Distribution</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Comparing Service Verticals</p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: '2X2 Sales', value: stats.total2x2, color: 'bg-fuchsia-500', percent: (stats.total2x2 / (stats.total2x2 + stats.totalPhotocopy + stats.totalPrinting || 1)) * 100 },
                      { label: 'Photocopy', value: stats.totalPhotocopy, color: 'bg-cyan-500', percent: (stats.totalPhotocopy / (stats.total2x2 + stats.totalPhotocopy + stats.totalPrinting || 1)) * 100 },
                      { label: 'Printing', value: stats.totalPrinting, color: 'bg-blue-500', percent: (stats.totalPrinting / (stats.total2x2 + stats.totalPhotocopy + stats.totalPrinting || 1)) * 100 },
                    ].map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${item.color}`} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                          </div>
                          <span className="text-[10px] font-black text-slate-900 dark:text-white">{item.percent.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percent}%` }}
                            className={`h-full ${item.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                
                <div className="space-y-6 relative z-10">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-white text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Efficiency Score</h3>
                    <p className="text-3xl font-black text-white mt-1">High Performance</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between text-white/60 text-[10px] font-black uppercase tracking-widest">
                    <span>Target Achievement</span>
                    <span>{((stats.dailyNet / 2000) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (stats.dailyNet / 2000) * 100)}%` }}
                      className="h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                    />
                  </div>
                  <p className="text-[9px] text-white/50 font-bold uppercase italic">Based on ₱2,000 daily benchmark</p>
                </div>
              </div>
            </motion.div>

            {/* Expenses Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-[#15161d]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 md:p-8 shadow-xl"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Printing Expenses</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Deducted from printing sales</p>
                </div>
                <button 
                  onClick={() => setShowExpenseModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-xl transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/10"
                >
                  <Plus className="w-4 h-4" /> Add Expense
                </button>
              </div>

              <div className="bg-white dark:bg-[#0a0a0f]/50 border border-slate-100 dark:border-white/5 rounded-[1.5rem] overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                  <table className="w-full text-left font-sans">
                    <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredExpenses.length > 0 ? (
                        filteredExpenses.map(expense => (
                          <tr key={expense.id} className="group hover:bg-rose-500/[0.02] transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-[10px] md:text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{expense.description}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                <Calendar className="w-3 h-3" />
                                <span>{safeDate(expense.created_at)?.toLocaleDateString()}</span>
                                <span className="opacity-30">•</span>
                                <Clock className="w-3 h-3" />
                                <span>{safeDate(expense.created_at)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-[10px] md:text-xs font-black text-rose-500 tabular-nums">-{formatCurrency(expense.amount)}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => startExpenseEdit(expense)}
                                  className="p-2 opacity-0 group-hover:opacity-100 bg-indigo-500/10 text-indigo-500 rounded-lg transition-all hover:scale-110"
                                  title="Edit Expense"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirm({ id: expense.id, name: expense.description, type: 'expense' })}
                                  className="p-2 opacity-0 group-hover:opacity-100 bg-rose-500/10 text-rose-500 rounded-lg transition-all hover:scale-110"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-12 text-center">
                            <p className="text-[10px] font-black text-slate-300 dark:text-slate-800 uppercase tracking-[0.3em]">No expenses recorded</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            <div className="bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-xl dark:bg-[#15161d] dark:border-white/5">
              <div className="max-h-[600px] overflow-y-auto scrollbar-hide border-b border-slate-100 dark:border-white/5">
                <table className="w-full text-left font-sans min-w-[600px] md:min-w-0">
                  <thead className="bg-slate-50 border-b border-slate-100 dark:bg-[#1c1d26] dark:border-white/5 sticky top-0 z-20 backdrop-blur-md">
                    <tr>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Section</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Amount</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">Qty</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Amount</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">TimeStamp</th>
                      <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-32 text-center">
                          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-6" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Establishing Sync...</p>
                        </td>
                      </tr>
                    ) : filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-32 text-center">
                          <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 dark:bg-white/5 dark:border-transparent">
                            <Printer className="w-8 h-8 text-slate-200" />
                          </div>
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No Audit Records Found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((entry, index) => (
                        <tr 
                          key={entry.id} 
                          className={`
                            transition-colors group
                            ${index % 2 === 0 
                              ? "bg-transparent" 
                              : "bg-slate-50/50 dark:bg-white/[0.01]"}
                          `}
                        >
                          <td className="px-4 md:px-8 py-4 md:py-5">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight dark:text-white leading-tight">{entry.description}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                <p className="text-[8px] text-slate-400 sm:hidden">{formatCurrency(entry.amount)} x{entry.quantity}</p>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-slate-300" />
                                  <span className="text-[8px] font-black text-slate-400 uppercase">
                                    {safeDate(entry.created_at)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                {(entry as any).queued && (
                                  <span className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded text-[7px] font-black border border-amber-500/20 uppercase tracking-tighter">
                                    Offline
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-5">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${
                                (entry as any).category === '2X2' ? 'bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20' :
                                (entry as any).category === 'PHOTOCOPY' ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20' :
                                'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              }`}>
                                {(entry as any).category || 'PRINTING'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-5 hidden sm:table-cell">
                            <span className="font-mono text-[10px] md:text-xs text-slate-500 dark:text-slate-400">{formatCurrency(entry.amount)}</span>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-5 hidden md:table-cell">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] md:text-[10px] font-black dark:bg-indigo-500/10 dark:text-indigo-400">
                              x{entry.quantity}
                            </span>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-5">
                            <span className="font-black text-indigo-600 text-xs md:text-sm dark:text-indigo-400">
                              {formatCurrency(entry.total)}
                            </span>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:table-cell">
                            {safeDate(entry.created_at) ? (
                              <>
                                {safeDate(entry.created_at)!.toLocaleDateString()} • {safeDate(entry.created_at)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-5 text-right">
                            <div className="flex justify-end gap-1.5 md:gap-2">
                              <button 
                                onClick={() => handlePrint(entry)}
                                className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-600 rounded-lg md:rounded-xl transition-all dark:bg-white/5 dark:hover:text-indigo-400"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5 md:w-4 md:h-4" />
                               </button>
                              <button 
                                onClick={() => startEdit(entry)}
                                className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg md:rounded-xl transition-all dark:bg-white/5 dark:hover:text-emerald-400"
                                title="Edit Record"
                              >
                                <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirm({ id: entry.id, name: entry.description, type: 'sale' })}
                                className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg md:rounded-xl transition-all dark:bg-white/5 dark:hover:text-rose-400"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#15161d]">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${editingEntry ? 'bg-emerald-600' : 'bg-indigo-600'} flex items-center justify-center text-white`}>
                      {editingEntry ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                    <div>
                      <h2 className="text-[10px] font-black text-white uppercase tracking-widest">{editingEntry ? 'update sales' : 'enter sales'}</h2>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">printing Entry</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setShowModal(false); setEditingEntry(null); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5 bg-[#0a0a0f]">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                    <div className="relative group">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 transition-colors group-focus-within:text-indigo-500" />
                      <select 
                        required
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-black appearance-none"
                      >
                        <option value="PRINTING" className="bg-[#15161d]">PRINTING</option>
                        <option value="PHOTOCOPY" className="bg-[#15161d]">PHOTOCOPY</option>
                        <option value="2X2" className="bg-[#15161d]">2X2 PICTURE</option>
                      </select>
                      <Plus className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Optional Details</label>
                    <div className="relative group">
                      <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 transition-colors group-focus-within:text-indigo-500" />
                      <input 
                        type="text" 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                        placeholder="e.g. Typing Job (Optional)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Amount (₱)</label>
                    <div className="relative group">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 transition-colors group-focus-within:text-emerald-500" />
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-right font-black"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                   <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Amount</p>
                      <p className="text-xl font-black text-indigo-400">₱{totalCalculated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-[#15161d] border-t border-white/5 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => { setShowModal(false); setEditingEntry(null); }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmitting}
                    type="submit"
                    className={`flex-1 py-2.5 ${editingEntry ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${editingEntry ? 'shadow-emerald-600/20' : 'shadow-indigo-600/20'} flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50`}
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{isSubmitting ? (editingEntry ? "Updating..." : "Saving...") : (editingEntry ? "Update Entry" : "Save Entry")}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleExpenseSubmit}>
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#15161d]">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${editingExpense ? 'bg-emerald-600' : 'bg-rose-600'} flex items-center justify-center text-white`}>
                      {editingExpense ? <Pencil className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                    </div>
                    <div>
                      <h2 className="text-[10px] font-black text-white uppercase tracking-widest">{editingExpense ? 'Update Expense' : 'New Expense'}</h2>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{editingExpense ? 'Modify existing deduction' : 'Deduct from Printing Total'}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5 bg-[#0a0a0f]">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Expense Description</label>
                    <div className="relative group">
                      <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 transition-colors group-focus-within:text-rose-500" />
                      <input 
                        required
                        type="text" 
                        value={expenseData.description}
                        onChange={e => setExpenseData({...expenseData, description: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                        placeholder="e.g. Ink Refill, Paper Box"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount (₱)</label>
                    <div className="relative group">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 transition-colors group-focus-within:text-rose-500" />
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={expenseData.amount}
                        onChange={e => setExpenseData({...expenseData, amount: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-right font-black"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-[#15161d] border-t border-white/5 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
                  >
                    Abort
                  </button>
                  <button 
                    disabled={isSubmitting}
                    type="submit"
                    className={`flex-1 py-2.5 ${editingExpense ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'} text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${editingExpense ? 'shadow-emerald-900/20' : 'shadow-rose-900/20'} flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50`}
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{isSubmitting ? (editingExpense ? "Updating..." : "Saving...") : (editingExpense ? "Update Expense" : "Save Expense")}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0a0a0f]/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500 animate-pulse">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Destroy All Records?</h2>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">
                    This action is <span className="text-rose-500 underline uppercase tracking-widest">irreversible</span>. All printing sales and expense history will be permanently deleted from the database.
                  </p>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmitting}
                    onClick={handleResetAll}
                    className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>{isSubmitting ? "Purging..." : "Reset All"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#1c1d26] border border-white/10 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl"
            >
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Confirm Deletion</h3>
                </div>
                
                <div className="bg-black/20 rounded-xl p-3 mb-4 border border-white/5">
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1">Target Entry</p>
                  <p className="text-[11px] font-black text-white truncate">{deleteConfirm.name}</p>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-6 px-1">
                  This action is irreversible. The record will be permanently purged from the system.
                </p>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-all active:scale-95"
                  >
                    Purge
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* ✅ DEACTIVATED UNTIL THE UNTRACKED DIAGNOSTICS FILE IS PUSHED */}
      {/* <PrinterDiagnostics isOpen={showDiagnostics} onClose={() => setShowDiagnostics(false)} /> */}
    </div>
  );
}