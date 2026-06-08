import React, { useState, useEffect } from "react";
import { API } from "../lib/api";
import { db } from "../lib/db";
import { motion } from "motion/react";
import { 
  ArrowLeft,
  History,
  Search,
  Calendar,
  Filter,
  ArrowUpRight,
  ChevronRight,
  Download,
  CreditCard,
  Banknote,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  Check,
  WifiOff,
  FileSpreadsheet,
  Ban,
  X,
  Printer,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  HandCoins,
  Receipt,
  Store,
  LayoutDashboard,
  Menu,
  ShoppingCart,
  Clock,
  ClipboardList,
  SmartphoneNfc,
  Package,
  Users,
  IdCard,
  Briefcase,
  Settings,
  LogOut,
  Lock,
  CloudOff,
  RefreshCw,
  RefreshCcw,
  Eye,
  EyeOff
} from "lucide-react";
import * as XLSX from "xlsx";
import { AnimatePresence } from "motion/react";

import { useAuth } from "../lib/auth";

function SyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('swiftpos-last-sync'));

  useEffect(() => {
    const checkPending = async () => {
      const count = await db.pendingTransactions.count();
      setPendingCount(count);
      setIsSyncing(API.isSyncing());
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);

    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => {
      setIsSyncing(false);
      const now = new Date().toLocaleTimeString();
      setLastSync(now);
      localStorage.setItem('swiftpos-last-sync', now);
      checkPending();
    };

    window.addEventListener('swiftpos-sync-start', handleSyncStart);
    window.addEventListener('sync-finished', handleSyncEnd);
    window.addEventListener('swiftpos-sync-error', () => setIsSyncing(false));

    return () => {
      clearInterval(interval);
      window.removeEventListener('swiftpos-sync-start', handleSyncStart);
      window.removeEventListener('sync-finished', handleSyncEnd);
    };
  }, []);

  if (pendingCount === 0 || isSyncing) return (
    <div className="mb-4 px-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isSyncing ? (
          <RefreshCw className="w-2.5 h-2.5 text-indigo-500 animate-spin" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
        )}
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'Syncing...' : 'Synced'}</span>
      </div>
      <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tighter">{lastSync ? `At ${lastSync}` : 'Cloud Ready'}</span>
    </div>
  );

  return (
    <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between transition-all ${isSyncing ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
      <div className="flex items-center gap-3">
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
        ) : (
          <CloudOff className="w-3.5 h-3.5 text-amber-500" />
        )}
        <div>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isSyncing ? 'text-indigo-600' : 'text-amber-600'}`}>
            {isSyncing ? 'Syncing...' : 'Pending Sync'}
          </p>
          <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">{pendingCount} Transaction{pendingCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  );
}

export default function Transactions({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  
  const isGCashRestricted = user?.email === 'user@mariz.com';
  const isPadalaOnlyUser = Boolean(user?.email?.startsWith('user@') && !isAdmin && !isGCashRestricted);

  const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", allowed: !isPadalaOnlyUser },
    { icon: Clock, label: "Attendance", id: "attendance", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: ShoppingCart, label: "Cashier", id: "pos", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: ClipboardList, label: "Orders", id: "orders", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: SmartphoneNfc, label: "GCash Tracker", id: "gcash", allowed: !isPadalaOnlyUser },
    { icon: Package, label: "Inventory", id: "inventory", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: History, label: "Transactions", id: "transactions", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: Users, label: "SUKICARD MEMBERS", id: "customers", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: IdCard, label: "SUKICARD Generator", id: "generator", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: Printer, label: "Printing Sales", id: "printing", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: CreditCard, label: "Credit Tracker", id: "credit-tracker", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: Briefcase, label: "SOS CREDIT", id: "sos-credit", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: SmartphoneNfc, label: "Pera Padala", id: "send-money", allowed: !isGCashRestricted },
    { icon: Settings, label: "Settings", id: "settings", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser }
  ];
  const [txns, setTxns] = useState<any[]>([]);
  const [printingRecords, setPrintingRecords] = useState<any[]>([]);
  const [pendingTxns, setPendingTxns] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ 
    totalSales: number; 
    totalProfit: number; 
    printingSales: number;
    totalExpenses: number;
    grossIncome: number;
    netIncome: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);
  const [deleteId, setDeleteId] = useState<{id: string, no: string} | null>(null);
  const [voidId, setVoidId] = useState<{id: string, no: string} | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showMayMetrics, setShowMayMetrics] = useState(true);
  const [showTable, setShowTable] = useState(true);

  useEffect(() => {
    fetchTxns().then(() => {
      if (navigator.onLine) {
        handleManualSync();
      }
    });
    fetchBusinessInfo();

    const handleSyncEvent = () => {
      fetchTxns();
    };

    const handleOnlineEvent = () => {
      handleManualSync();
    };

    window.addEventListener("swiftpos-sync-success", handleSyncEvent);
    window.addEventListener("online", handleOnlineEvent);

    return () => {
      window.removeEventListener("swiftpos-sync-success", handleSyncEvent);
      window.removeEventListener("online", handleOnlineEvent);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      await API.syncPendingTransactions();
      await fetchTxns();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchBusinessInfo = async () => {
    try {
      const res = await API.get("/settings/business");
      setBusinessInfo(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const fetchTxns = async () => {
    setLoading(true);
    try {
      const [res, pending, printingRes, orderExpensesRes] = await Promise.all([
        API.get("/transactions").catch(() => ({ data: [] })),
        db.pendingTransactions.where('path').equals('/transactions').toArray(),
        API.get("/printing").catch(() => ({ data: [] })),
        API.get("/order_expenses").catch(() => ({ data: [] }))
      ]);
      
      const firestoreTxns = res.data || [];
      const localPending = pending.map(p => ({
        ...p.data,
        _id: p.data.id || p.data._id,
        queued: true,
        localId: p.id
      }));

      const printing = printingRes.data || [];
      const orderExpenses = orderExpensesRes.data || [];

      setTxns(firestoreTxns);
      setPendingTxns(localPending);
      setPrintingRecords(printing);

      // Calculate last month metrics (May 2026)
      const allMergedTxns = [...localPending, ...firestoreTxns];
      const lastMonth = 4; // May (0-indexed)
      const lastYear = 2026;

      const mayTxns = allMergedTxns.filter(t => {
        const d = safeDate(t.created_at || t.createdAt);
        return d && d.getMonth() === lastMonth && d.getFullYear() === lastYear && t.status !== 'voided';
      });

      const mayPrinting = printing.filter(p => {
        const d = safeDate(p.created_at || p.createdAt);
        return d && d.getMonth() === lastMonth && d.getFullYear() === lastYear && p.status !== 'voided';
      });

      const mayOrderExpenses = orderExpenses.filter((o: any) => {
        const d = safeDate(o.created_at || o.createdAt);
        return d && d.getMonth() === lastMonth && d.getFullYear() === lastYear;
      });

      const totalSales = mayTxns.reduce((sum, t) => sum + (t.total || 0), 0);
      const totalProfit = mayTxns.reduce((sum, t) => {
        const profit = calculateProfit(t);
        return sum + profit;
      }, 0);
      const printingSales = mayPrinting.reduce((sum, p) => sum + (p.total || 0), 0);
      const totalExpenses = mayOrderExpenses.reduce((sum: number, o: any) => sum + (o.total || o.amount || 0), 0);
      const grossIncome = totalSales - totalProfit;
      const netIncome = totalSales - totalExpenses;

      setMetrics({ totalSales, totalProfit, printingSales, totalExpenses, grossIncome, netIncome });

    } catch (err) {
      console.error(err);
      addToast("Failed to load records", "error");
    } finally {
      setLoading(false);
    }
  };

  const allTxns = [...pendingTxns, ...txns].reduce((acc: any[], curr) => {
    const curInfo = curr.transactionNumber || curr.id || curr._id;
    const isDuplicate = acc.some(t => 
      (t.transactionNumber && t.transactionNumber === curr.transactionNumber) ||
      (t._id && curr._id && t._id === curr._id) ||
      (t.id && curr.id && t.id === curr.id) ||
      (t.id && curr._id && t.id === curr._id) ||
      (t._id && curr.id && t._id === curr.id)
    );
    if (!isDuplicate) acc.push(curr);
    return acc;
  }, []);

  const handleDelete = (id: string, txnNo: string) => {
    setDeleteId({ id, no: txnNo });
  };

  const handleVoid = (id: string, txnNo: string) => {
    setVoidId({ id, no: txnNo });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const isPending = (deleteId.no || "").startsWith("OFFLINE-");
      if (isPending) {
        const localRecord = await db.pendingTransactions.filter(p => p.data.transactionNumber === deleteId.no).first();
        if (localRecord) {
          await db.pendingTransactions.delete(localRecord.id!);
          setPendingTxns(prev => prev.filter(t => t.transactionNumber !== deleteId.no));
          addToast(`Offline Transaction ${deleteId.no} removed`);
        }
      } else {
        await API.delete(`/transactions/${deleteId.id}`);
        setTxns(prev => prev.filter(t => t._id !== deleteId.id));
        addToast(`Transaction ${deleteId.no} deleted`);
      }
    } catch (err) {
      console.error("Delete Record Error:", err);
      addToast("Sync deletion failed", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const confirmVoid = async () => {
    if (!voidId || !voidId.id) {
      addToast("Invalid transaction ID", "error");
      setVoidId(null);
      return;
    }
    try {
      await API.put(`/transactions/${voidId.id}/void`, {});
      addToast(`Transaction ${voidId.no} voided`);
      fetchTxns();
    } catch (err) {
      console.error("Void Error:", err);
      addToast("Failed to void record", "error");
    } finally {
      setVoidId(null);
    }
  };

  const filteredTxns = allTxns.filter(t => 
    (t.transactionNumber || "").toLowerCase().includes(search.toLowerCase()) || 
    (t.cashier?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const safeDate = (dateStr: any) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(allTxns.map(t => ({
      'Transaction No': t.transactionNumber,
      'Date': safeDate(t.created_at || t.createdAt)?.toLocaleString() || 'N/A',
      'Cashier': t.cashier?.name || "N/A",
      'Payment Method': (t.paymentMethod || "").toUpperCase(),
      'Total Amount': t.total,
      'Items Count': t.items?.length || 0,
      'Status': t.queued ? 'Sync Pending' : 'Synced'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `Transactions_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast("Transaction history exported");
  };

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

  const calculateProfit = (txn: any) => {
    if (!txn.items) return 0;
    return txn.items.reduce((acc: number, item: any) => acc + (item.qty * (item.price - (item.cost || 0))), 0);
  };

  const handlePrint = (txn: any) => {
    console.log("Transactions: Dispatching swiftpos-print", txn);
    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-300 font-sans">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 z-50 transition-transform lg:translate-x-0 lg:static
        dark:bg-[#111218]/80 dark:border-white/5
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">CBK<span className="text-indigo-600">POS</span></span>
          </div>
          <button 
            className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto mt-4 px-2 scrollbar-hide">
          <div className="space-y-1 mb-8 pr-2">
            <label className="px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Navigation</label>
            {sidebarItems.map((item, idx) => {
              const isActive = currentPage === item.id;
              return (
                <motion.button 
                  key={idx}
                  whileHover={item.allowed ? { x: 4, scale: 1.01 } : {}}
                  whileTap={item.allowed ? { scale: 0.98 } : {}}
                  onClick={() => {
                    if (item.allowed) {
                      navigate(item.id as any);
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }
                  }}
                  disabled={!item.allowed}
                  className={`
                    w-full group relative flex items-center gap-3 px-4 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border
                    ${!item.allowed ? 'opacity-30 cursor-not-allowed filter grayscale' : ''}
                    ${item.allowed ? isActive 
                      ? 'bg-white dark:bg-[#1a1b23] text-indigo-600 border-indigo-500/10 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.15)] dark:shadow-none' 
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:text-slate-900 dark:hover:text-slate-100' : ''}
                  `}
                >
                  <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-600/10 group-hover:text-indigo-600 group-hover:scale-110'}`}>
                    <item.icon className="w-3.5 h-3.5" />
                  </div>
                  {item.label}
                  {!item.allowed && <Lock className="w-3 h-3 ml-auto opacity-50" />}
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator-txns"
                      className="absolute left-0 w-1 h-6 bg-indigo-600 rounded-r-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </nav>

        <div className="p-6 pb-12 flex-shrink-0 bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5">
          <SyncStatus />
          <div className="bg-white/50 backdrop-blur-md rounded-[1.5rem] p-4 border border-slate-200 dark:bg-[#1c1d26]/50 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center font-black text-slate-600 dark:text-white shadow-inner">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{user?.name || "User"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">{user?.role || "Member"}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95 border border-rose-500/10"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto max-h-screen scrollbar-hide relative z-10 min-w-0">
        {/* Sync Status Banner */}
        <AnimatePresence>
          {pendingTxns.length > 0 && navigator.onLine && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-indigo-600 text-white z-[40]"
            >
              <div className="px-6 py-2.5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 bg-white/10 rounded-lg ${isSyncing ? 'animate-spin' : ''}`}>
                    <History className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {isSyncing ? 'Syncing transactions with cloud...' : `${pendingTxns.length} Local Transaction${pendingTxns.length > 1 ? 's' : ''} Pending Cloud Sync`}
                  </p>
                </div>
                {!isSyncing && (
                  <button 
                    onClick={handleManualSync}
                    className="px-4 py-1.5 bg-white text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Sync Now
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Toasts */}
      <div className="fixed top-24 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
               className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border ${
                 toast.type === "success" 
                   ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/10" 
                   : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 dark:bg-rose-500/10"
               }`}
            >
              {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal: Delete */}
      <AnimatePresence>
        {deleteId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl dark:bg-[#1c1d26] dark:border-white/10"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight dark:text-white">Purge Record</h3>
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-200 dark:bg-black/20 dark:border-white/5">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Transaction Ref</p>
                  <p className="text-sm font-mono font-black text-indigo-600 truncate dark:text-indigo-400">{deleteId.no}</p>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-8 px-1">
                  Once deleted, this log entry is <span className="text-rose-500 font-black">lost forever</span> and cannot be recovered in audit reports.
                </p>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setDeleteId(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all active:scale-95 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-900/20 transition-all active:scale-95"
                  >
                    Confirm Deletion
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal: Void */}
      <AnimatePresence>
        {voidId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#1c1d26] border border-white/10 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Ban className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Void Transaction</h3>
                </div>
                
                <div className="bg-black/20 rounded-xl p-4 mb-5 border border-white/5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Transaction ID</p>
                  <p className="text-xs font-mono font-black text-amber-500 truncate">{voidId.no}</p>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-6 px-1">
                  Marking this as <span className="text-amber-400 font-bold">VOID</span> will keep the record but negate its impact on reports.
                </p>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setVoidId(null)}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all active:scale-95"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={confirmVoid}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-900/20 transition-all active:scale-95"
                  >
                    Void Record
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction Details Modal (The "Form") */}
      <AnimatePresence>
        {selectedTxn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] dark:bg-[#111218] dark:border-white/10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 dark:bg-[#15161d] dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${selectedTxn.status === 'voided' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    <Receipt className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight dark:text-white">{selectedTxn.transactionNumber}</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {selectedTxn.status === 'voided' ? 'Audit Exclusion Record' : 'Confirmed Settlement entry'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedTxn(null)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 dark:hover:bg-white/5"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Timestamp</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {safeDate(selectedTxn.created_at || selectedTxn.createdAt)?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lead Cashier</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedTxn.cashier?.name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Channel Selection</p>
                    <p className="text-sm font-black text-slate-800 uppercase dark:text-slate-200">{selectedTxn.paymentMethod}</p>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Status</p>
                    <div className="flex justify-end">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                        selectedTxn.status === 'voided' ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-900/20' : 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-900/20'
                      }`}>
                        {selectedTxn.status || 'Verified'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100 pb-3 dark:border-white/5">Itemized List</p>
                  <div className="space-y-3">
                    {selectedTxn.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group/item dark:bg-white/5 dark:border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shadow-md">{item.qty}</div>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight dark:text-white leading-tight">{item?.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-400 font-mono dark:text-slate-500">{formatCurrency(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4 dark:border-white/5">
                  <div className="flex justify-between items-center bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl shadow-indigo-600/30">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-80">Settlement Total</p>
                    <p className="text-3xl font-black">{formatCurrency(selectedTxn.total)}</p>
                  </div>
                  {selectedTxn.status !== 'voided' && (
                    <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-5 rounded-[2rem] dark:bg-emerald-500/5 dark:border-emerald-500/10">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] dark:text-emerald-500/50">Transaction Net</p>
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(calculateProfit(selectedTxn))}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 dark:bg-[#15161d] dark:border-white/5">
                <button 
                  onClick={() => handlePrint(selectedTxn)}
                  className="flex-1 py-4 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center justify-center gap-2 transition-all active:scale-95 dark:bg-white/5 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                >
                  <Printer className="w-4 h-4" /> Hard Copy
                </button>
                {isAdmin && selectedTxn.status !== 'voided' && !selectedTxn.queued && (
                  <button 
                    onClick={() => { setVoidId({ id: selectedTxn._id || selectedTxn.id, no: selectedTxn.transactionNumber }); setSelectedTxn(null); }}
                    className="flex-1 py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Ban className="w-4 h-4" /> Void
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#0a0a0f]/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 p-4 lg:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none dark:text-white uppercase tracking-tighter">Transactions</h1>
              <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Audit Ledger</p>
            </div>
          </div>
          <button 
            onClick={exportToExcel}
            className="hidden md:flex items-center justify-center gap-3 px-6 py-3.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
          >
             <FileSpreadsheet className="w-4 h-4" /> Global Export
          </button>
        </header>

      <div className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
        {/* Metrics Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
            <button 
              onClick={() => setShowMayMetrics(!showMayMetrics)}
              className="flex items-center gap-2 px-5 py-1.5 rounded-full bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 transition-all group"
            >
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em]">May Sales History</span>
              {showMayMetrics ? (
                <Eye className="w-3 h-3 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110" />
              ) : (
                <EyeOff className="w-3 h-3 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110" />
              )}
            </button>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
          </div>

          <AnimatePresence>
            {showMayMetrics && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: "Gross Income", value: metrics?.grossIncome, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                    { label: "Net Income", value: metrics?.netIncome, icon: HandCoins, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                    { label: "Total Sales", value: metrics?.totalSales, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                    { label: "Total Profit", value: metrics?.totalProfit, icon: TrendingUp, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                    { label: "Printing Sales", value: metrics?.printingSales, icon: Printer, color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20" },
                    { label: "Total Expenses", value: metrics?.totalExpenses, icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`relative overflow-hidden bg-white/70 dark:bg-[#111218]/80 backdrop-blur-xl border ${stat.border} p-5 rounded-[1.5rem] shadow-sm flex flex-col gap-3 group hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                          <stat.icon className="w-5 h-5" />
                        </div>
                        <div className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${stat.bg} ${stat.color}`}>
                          MAY 2026
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                          {loading ? (
                            <div className="w-20 h-5 bg-slate-200 dark:bg-white/5 animate-pulse rounded-lg mt-1" />
                          ) : (
                            formatCurrency(stat.value || 0)
                          )}
                        </h3>
                      </div>
                      <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full ${stat.bg} blur-2xl opacity-0 group-hover:opacity-40 transition-opacity`} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search TXN-ID or Cashier..." 
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-3.5 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium dark:bg-[#15161d] dark:border-white/5 dark:text-white light:bg-white light:border-slate-200 light:text-slate-900 uppercase"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-3 bg-[#15161d] border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all text-sm font-bold dark:bg-[#15161d] dark:border-white/5 light:bg-white light:border-slate-200 light:text-slate-500">
              <Calendar className="w-5 h-4" /> Filter Date
            </button>
            <button className="flex items-center gap-2 px-4 py-3 bg-[#15161d] border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all text-sm font-bold dark:bg-[#15161d] dark:border-white/5 light:bg-white light:border-slate-200 light:text-slate-500">
              <Filter className="w-5 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Audit Records</h3>
          <button 
            onClick={() => setShowTable(!showTable)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-500 hover:text-slate-900 dark:hover:text-white"
            title={showTable ? "Hide Records" : "Show Records"}
          >
            {showTable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
        </div>

        <AnimatePresence>
          {showTable && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-[#111218] rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px] md:min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#1c1d26] border-b border-slate-200 dark:border-white/5">
                <tr>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-14">Type</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Ref</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date / Time</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Cashier</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Details</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">Code</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">Asset Category</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right hidden lg:table-cell">Cost</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Amount</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center hidden sm:table-cell">Profit</th>
                  <th className="px-4 md:px-6 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredTxns.map((txn, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    key={txn._id || i}
                    onClick={() => setSelectedTxn(txn)}
                    className={`
                      group cursor-pointer transition-colors
                      ${txn.status === 'voided' 
                        ? 'bg-rose-500/[0.02] opacity-60' 
                        : 'odd:bg-white even:bg-slate-50/50 dark:odd:bg-[#111218] dark:even:bg-white/[0.01]'
                      }
                      hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5
                    `}
                  >
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                        txn.status === 'voided' 
                          ? 'bg-slate-200 text-slate-400' 
                          : txn.paymentMethod === 'cash' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-indigo-500/10 text-indigo-500'
                      }`}>
                        {txn.paymentMethod === 'cash' ? <Banknote className="w-4 h-4 md:w-5 md:h-5" /> : <CreditCard className="w-4 h-4 md:w-5 md:h-5" />}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className={`font-mono text-[10px] md:text-[11px] font-black tracking-tight ${
                          txn.status === 'voided' ? 'text-slate-400 line-through' : 'text-indigo-500 dark:text-indigo-400'
                        }`}>
                          {txn.transactionNumber}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          {txn.queued && (
                            <span className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded text-[7px] md:text-[8px] font-black border border-amber-500/20 uppercase tracking-tighter">
                              <WifiOff className="w-2.5 h-2.5" /> Offline
                            </span>
                          )}
                          {txn.status === 'voided' && (
                            <span className="bg-rose-500/10 text-rose-500 px-1 py-0.5 rounded text-[7px] md:text-[8px] font-black border border-rose-500/20 uppercase tracking-tighter">
                              Voided
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <p className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                        {safeDate(txn.created_at || txn.createdAt)?.toLocaleDateString('en-PH', { day: '2-digit', month: 'short' }) || 'N/A'}
                      </p>
                      <p className="text-[8px] md:text-[9px] text-slate-400 font-medium">
                        {safeDate(txn.created_at || txn.createdAt)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
                      </p>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                      <p className="text-[10px] md:text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-[120px]">
                        {txn.cashier?.name}
                      </p>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col gap-1.5">
                        {txn.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex flex-col">
                            <span className="text-[10px] md:text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase leading-tight">
                              {item.qty}x {item.name}
                            </span>
                            <div className="flex flex-wrap gap-2 lg:hidden">
                              <span className="text-[8px] font-black text-slate-400 uppercase">Code: {item.sku || 'N/A'}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase">Cat: {item.category || 'N/A'}</span>
                              <span className="text-[8px] font-black text-emerald-500 uppercase">Cost: {formatCurrency(item.cost || 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      <div className="flex flex-col gap-1.5">
                        {txn.items?.map((item: any, idx: number) => (
                          <span key={idx} className="text-[10px] md:text-[11px] font-mono font-black text-slate-500 uppercase h-[1.25rem] flex items-center">
                            {item.sku || '-'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      <div className="flex flex-col gap-1.5">
                        {txn.items?.map((item: any, idx: number) => (
                          <span key={idx} className="text-[9px] md:text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase h-[1.25rem] flex items-center">
                            {item.category || 'General'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right hidden lg:table-cell">
                      <div className="flex flex-col gap-1.5">
                        {txn.items?.map((item: any, idx: number) => (
                          <span key={idx} className="text-[10px] md:text-[11px] font-mono font-black text-rose-500 dark:text-rose-400 h-[1.25rem] flex items-center justify-end">
                            {formatCurrency(item.cost || 0)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                      <span className={`text-[11px] md:text-[13px] font-black font-mono tracking-tighter ${
                        txn.status === 'voided' ? 'text-slate-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        {formatCurrency(txn.total)}
                      </span>
                      <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{txn.items?.length || 0} ITEMS</p>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center hidden sm:table-cell">
                      {txn.status !== 'voided' ? (
                        <div className="inline-flex flex-col items-center px-2 md:px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                          <span className="text-[10px] md:text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter">
                            {formatCurrency(calculateProfit(txn))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 font-mono text-[10px] md:text-[11px]">---</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 md:gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePrint(txn); }}
                          className="p-2 md:p-2.5 bg-slate-100 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded-lg md:rounded-xl transition-all dark:bg-white/5 dark:hover:bg-emerald-500/10"
                          title="Print Receipt"
                        >
                          <Printer className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                        {isAdmin && txn.status !== 'voided' && !txn.queued && (
                          <button 
    onClick={(e) => { e.stopPropagation(); handleVoid(txn._id || txn.id, txn.transactionNumber); }}
    className="p-2 md:p-2.5 bg-slate-100 hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 rounded-lg md:rounded-xl transition-all dark:bg-white/5 dark:hover:bg-amber-500/10"
    title="Void Transaction"
  >
    <Ban className="w-3.5 h-3.5 md:w-4 md:h-4" />
  </button>
)}
                        {isAdmin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(txn._id, txn.transactionNumber); }}
                            className="p-2 md:p-2.5 bg-slate-100 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg md:rounded-xl transition-all dark:bg-white/5 dark:hover:bg-rose-500/10"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        )}
                        <div className="p-1 md:p-2.5 text-slate-300 group-hover:text-indigo-500 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filteredTxns.length === 0 && (
            <div className="p-32 text-center space-y-6">
              <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-slate-200 dark:border-white/5">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">No historical data</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">The audit registry is currently empty</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</main>
</div>
  );
}
