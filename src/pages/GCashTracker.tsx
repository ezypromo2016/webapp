import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../lib/auth";
import { API } from "../lib/api";
import { db } from "../lib/db";
import { 
  SmartphoneNfc, Plus, Search, Filter, ArrowLeft, 
  Menu, Sun, Moon, Loader2, X, Check, Trash2, Zap,
  TrendingUp, TrendingDown, RefreshCw, Calendar, Clock,
  MoreVertical, CheckCircle2, AlertCircle, ShoppingCart, 
  ArrowUpRight, ArrowDownRight, Smartphone, ShieldCheck,
  LayoutDashboard, Package, Briefcase, History, Users, Settings, ClipboardList, IdCard, Printer, CreditCard, Lock,
  LogOut, Cloud, CloudOff, Store
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/theme";

interface GCashAccount {
  id: string;
  name: string;
  capital?: number;
  capital_cashout?: number;
  created_at: string;
}

interface GCashTransaction {
  id: string;
  account_id: string;
  customer_name: string;
  reference_number: string;
  mode: 'cash-in' | 'cash-out' | 'load';
  amount: number;
  fee: number;
  status: 'pending' | 'complete';
  created_at: string;
}

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

export default function GCashTracker({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
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
  const { theme, toggleTheme } = useTheme();
  const [txns, setTxns] = useState<GCashTransaction[]>([]);
  const [accounts, setAccounts] = useState<GCashAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string} | null>(null);

  // Account editing state
  const [editingAccount, setEditingAccount] = useState<GCashAccount | null>(null);

  const activeAccount = useMemo(() => 
    accounts.find(a => a.id === activeAccountId), 
    [accounts, activeAccountId]
  );

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const isNew = !accounts.find(a => a.id === editingAccount.id);
      if (isNew) {
        await API.post("/gcash_accounts", editingAccount);
        addToast("New account registered");
      } else {
        await API.put(`/gcash_accounts/${editingAccount.id}`, editingAccount);
        addToast("Account updated");
      }
      setShowAccountModal(false);
      fetchData();
    } catch (err) {
      addToast("Failed to save account", "error");
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    customer_name: "",
    reference_number: "",
    mode: "cash-in" as GCashTransaction['mode'],
    amount: "",
    percentage: "",
    fee: "",
    status: "complete" as GCashTransaction['status']
  });

  // Calculate fee automatically when amount or percentage changes
  useEffect(() => {
    const amt = parseFloat(formData.amount) || 0;
    const pct = parseFloat(formData.percentage) || 0;
    if (amt > 0 && pct > 0) {
      const calculatedFee = amt * (pct / 100);
      setFormData(prev => ({ ...prev, fee: calculatedFee.toString() }));
    }
  }, [formData.amount, formData.percentage]);

  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txnRes, accRes] = await Promise.all([
        API.get("/gcash"),
        API.get("/gcash_accounts")
      ]);
      
      let fetchedAccounts = accRes.data || [];
      
      // Seed two default accounts if none exist
      if (fetchedAccounts.length === 0) {
        const defaultAccs = [
          { id: 'acc_1', name: 'GCash Account 1', created_at: new Date().toISOString() },
          { id: 'acc_2', name: 'GCash Account 2', created_at: new Date().toISOString() }
        ];
        for (const acc of defaultAccs) {
          await API.post("/gcash_accounts", acc);
        }
        fetchedAccounts = defaultAccs;
      }

      setAccounts(fetchedAccounts);
      setTxns(txnRes.data || []);
      
      if (!activeAccountId && fetchedAccounts.length > 0) {
        setActiveAccountId(fetchedAccounts[0].id);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) {
      addToast("Please select an account first", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        account_id: activeAccountId,
        customer_name: formData.customer_name,
        reference_number: formData.reference_number,
        mode: formData.mode,
        amount: parseFloat(formData.amount) || 0,
        fee: parseFloat(formData.fee) || 0,
        status: formData.status,
        created_at: new Date().toISOString()
      };
      await API.post("/gcash", payload);
      addToast("Transaction logged successfully");
      setShowModal(false);
      setFormData({ customer_name: "", reference_number: "", mode: "cash-in", amount: "", percentage: "", fee: "", status: "complete" });
      fetchData();
    } catch (err) {
      addToast("Failed to save record", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (txn: GCashTransaction) => {
    try {
      const newStatus = txn.status === 'pending' ? 'complete' : 'pending';
      await API.put(`/gcash/${txn.id}`, { ...txn, status: newStatus });
      addToast(`Status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      addToast("Update failed", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || !isAdmin) return;
    try {
      await API.delete(`/gcash/${deleteConfirm.id}`);
      addToast("Record deleted");
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      addToast("Delete failed", "error");
    }
  };

  const filteredTxns = txns.filter(t => {
    const matchesAccount = t.account_id === activeAccountId;
    const matchesSearch = t.customer_name.toLowerCase().includes(search.toLowerCase()) || 
                         t.reference_number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterMode === "all" || t.mode === filterMode;
    return matchesAccount && matchesSearch && matchesFilter;
  });

  const totals = useMemo(() => {
    const todayStr = new Date().toDateString();
    return filteredTxns.reduce((acc, curr) => {
      acc[curr.mode] += curr.amount;
      acc.total_fee += curr.fee || 0;
      
      const d = new Date(curr.created_at);
      if (d.toDateString() === todayStr) {
        acc.daily_profit += curr.fee || 0;
      }
      
      if (curr.mode === 'load') {
        acc.total_load += curr.amount;
        acc.capital_change -= curr.amount;
        acc.cashout_capital_change += curr.amount;
      }

      if (curr.mode === 'cash-in') {
        acc.capital_change -= curr.amount;
        acc.cashout_capital_change += curr.amount; // Physical cash increases
      } else if (curr.mode === 'cash-out') {
        acc.capital_change += curr.amount;
        acc.cashout_capital_change -= curr.amount; // Physical cash decreases
      }
      
      return acc;
    }, { "cash-in": 0, "cash-out": 0, "load": 0, total_fee: 0, daily_profit: 0, total_load: 0, capital_change: 0, cashout_capital_change: 0 });
  }, [filteredTxns]);

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(n);

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-500 font-sans overflow-hidden">
      {/* Modern Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 right-[5%] w-[20%] h-[20%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Sidebar - Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - consistent with dashboard */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 z-50 transition-transform lg:translate-x-0 lg:static
        dark:bg-[#111218]/80 dark:border-white/5
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <SmartphoneNfc className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">GCASH<span className="text-indigo-600">TRACK</span></span>
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
                      layoutId="active-indicator-gcash"
                      className="absolute left-0 w-1 h-6 bg-indigo-600 rounded-r-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 mb-4 flex-shrink-0">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Terminal Hub</label>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const newAcc = { id: `acc_${Date.now()}`, name: `User ${accounts.length + 1}`, created_at: new Date().toISOString() };
                  setEditingAccount(newAcc);
                  setShowAccountModal(true);
                }}
                className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-hide py-2 pb-24">
              {accounts.map(acc => (
                <motion.button
                  key={acc.id}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveAccountId(acc.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full group relative flex items-center justify-between px-4 py-3.5 rounded-[1.5rem] transition-all border ${
                    activeAccountId === acc.id
                    ? 'bg-white dark:bg-[#1a1b23] border-indigo-500/10 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.15)] dark:shadow-none'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black uppercase transition-all shadow-sm ${
                       activeAccountId === acc.id
                       ? 'bg-indigo-600 text-white'
                       : 'bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-indigo-600/10 group-hover:text-indigo-600'
                    }`}>
                      {acc.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className={`text-[10px] font-black uppercase tracking-tight leading-none ${
                        activeAccountId === acc.id ? 'text-slate-900 dark:text-white' : ''
                      }`}>{acc.name}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={`w-1 h-1 rounded-full ${activeAccountId === acc.id ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">{activeAccountId === acc.id ? 'Active Session' : 'Standby'}</p>
                      </div>
                    </div>
                  </div>

                  <motion.div 
                    whileHover={{ scale: 1.2, rotate: 180 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAccount(acc);
                      setShowAccountModal(true);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      activeAccountId === acc.id
                      ? 'text-indigo-500 bg-indigo-500/5 hover:bg-indigo-600 hover:text-white'
                      : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-600'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </motion.div>
                </motion.button>
              ))}
            </div>
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
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#0a0a0f]/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 p-4 lg:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600">GCash Ledger</h2>
          </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={toggleTheme}
                  className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
                >
                  {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setShowModal(true)}
                  className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Transaction
                </button>
              </div>
            </div>
        </header>

        <div className="p-4 lg:p-10 space-y-8">
          {/* Active Account Display */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/10 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  Terminal Identity
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10">
                  {activeAccount?.id ? 'Verified' : 'Unregistered'}
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                {activeAccount?.name || 'Identity Required'}
              </h1>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                <Calendar className="w-3 h-3 text-indigo-500" />
                Session monitoring active for this ledger profile
              </p>
            </div>
            
            <div className="lg:hidden flex items-center gap-4">
               <button 
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" /> Log Transaction
              </button>
            </div>
          </div>

          {/* Dynamic Mobile Switcher Tooltip */}
          {activeAccount && (
            <div className="lg:hidden animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="bg-white dark:bg-[#15161d] p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">
                       {activeAccount.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white leading-none">{activeAccount.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Terminal Active</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSidebarOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest text-indigo-600 transition-all border border-transparent active:scale-95"
                  >
                    Switch Account
                  </button>
               </div>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Capital Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#15161d] border border-indigo-500/20 dark:border-indigo-500/10 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group lg:col-span-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/5 px-2 py-1 rounded-lg">
                  Capital
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Capital</p>
              <div className="mt-2">
                <span className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  ₱{((activeAccount?.capital || 0) + totals.capital_change).toLocaleString() || '0'}
                </span>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Current Balance</p>
              </div>
            </motion.div>
            
            {/* Cashout Capital Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#15161d] border border-rose-500/20 dark:border-rose-500/10 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group lg:col-span-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/5 px-2 py-1 rounded-lg">
                  Cashout
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cashout Capital</p>
              <div className="mt-2">
                <span className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  ₱{((activeAccount?.capital_cashout || 0) + totals.cashout_capital_change).toLocaleString() || '0'}
                </span>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Cash Balance</p>
              </div>
            </motion.div>

            {[
              { label: 'Daily Profit', value: totals.daily_profit, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: 'Total Profit', value: totals.total_fee, icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
              { label: 'Total Load', value: totals.total_load, icon: Smartphone, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { label: 'Total Cash-In', value: totals['cash-in'], icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'Total Cash-Out', value: totals['cash-out'], icon: ArrowDownRight, color: 'text-rose-500', bg: 'bg-rose-500/10' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(stat.value)}</h4>
              </motion.div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 p-4 rounded-2xl">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder="Search Customer or Reference..."
                className="w-full bg-[#f8f9fa] dark:bg-black/20 border-none rounded-xl py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 uppercase"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              {['all', 'cash-in', 'cash-out', 'load'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    filterMode === mode 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left font-sans min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Info</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">TimeStamp</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Charge</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  <AnimatePresence>
                    {filteredTxns.map((txn) => (
                      <motion.tr 
                        key={txn.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50/50 dark:hover:bg-white/10 transition-colors group"
                      >
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{txn.customer_name}</span>
                            <span className="text-[10px] font-mono font-bold text-indigo-500 mt-1 uppercase tracking-tighter">#{txn.reference_number}</span>
                            <div className="flex items-center gap-2 mt-2 lg:hidden">
                                <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(txn.created_at).toLocaleDateString()}</span>
                                <span className="text-[8px] font-black text-slate-300">•</span>
                                <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{new Date(txn.created_at).toLocaleDateString()}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            txn.mode === 'cash-in' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' :
                            txn.mode === 'cash-out' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/10' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/10'
                          }`}>
                            {txn.mode}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(txn.amount)}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-bold text-indigo-500">+{formatCurrency(txn.fee || 0)}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-black text-emerald-500">{formatCurrency(txn.amount + (txn.fee || 0))}</span>
                        </td>
                        <td className="px-8 py-5">
                          <button 
                            onClick={() => toggleStatus(txn)}
                            className={`flex items-center gap-1.5 px-3 py-1 object-center rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              txn.status === 'complete' 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' 
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/10'
                            }`}
                          >
                            {txn.status === 'complete' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {txn.status}
                          </button>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button 
                                onClick={() => setDeleteConfirm({ id: txn.id, name: txn.customer_name })}
                                className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredTxns.length === 0 && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <SmartphoneNfc className="w-8 h-8 text-slate-200" />
                  </div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No entries found</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Try refining your search</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Action Button Mobile */}
        <button 
          onClick={() => setShowModal(true)}
          className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </main>

      {/* Entry Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#111218] border border-slate-200 dark:border-white/10 rounded-[2rem] w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:shadow-none overflow-hidden max-h-[90vh] flex flex-col"
            >
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between flex-shrink-0 bg-white/50 dark:bg-transparent backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                      <SmartphoneNfc className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Add Records</h3>
                      <p className="text-[9px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">GCASH Terminal TRANSACTION</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className="p-2 md:p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl text-slate-400 transition-colors">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-hide">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode</label>
                       <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                         {['cash-in', 'cash-out', 'load'].map(m => (
                           <button
                             key={m}
                             type="button"
                             onClick={() => setFormData({...formData, mode: m as any})}
                             className={`py-2.5 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${
                               formData.mode === m 
                               ? 'bg-white dark:bg-[#1a1b23] text-indigo-600 shadow-sm' 
                               : 'text-slate-400 hover:text-slate-600'
                             }`}
                           >
                             {m === 'cash-in' ? 'In' : m === 'cash-out' ? 'Out' : 'Load'}
                           </button>
                         ))}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                       <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                         {['pending', 'complete'].map(s => (
                           <button
                             key={s}
                             type="button"
                             onClick={() => setFormData({...formData, status: s as any})}
                             className={`py-2.5 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${
                               formData.status === s 
                               ? 'bg-white dark:bg-[#1a1b23] text-indigo-600 shadow-sm' 
                               : 'text-slate-400 hover:text-slate-600'
                             }`}
                           >
                             {s}
                           </button>
                         ))}
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2 group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-indigo-500 transition-colors">Customer Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.customer_name}
                        onChange={e => setFormData({...formData, customer_name: e.target.value})}
                        placeholder="e.g. John Dela Cruz"
                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all md:text-sm"
                      />
                    </div>

                    <div className="space-y-2 group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-indigo-500 transition-colors">Ref Number</label>
                      <input 
                        required
                        type="text" 
                        value={formData.reference_number}
                        onChange={e => setFormData({...formData, reference_number: e.target.value})}
                        placeholder="e.g. 0001 234 567890"
                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all md:text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="space-y-2 group">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-indigo-500 transition-colors">Amount (₱)</label>
                       <div className="relative">
                         <input 
                           required
                           type="number" 
                           step="0.01"
                           value={formData.amount}
                           onChange={e => setFormData({...formData, amount: e.target.value})}
                           placeholder="0.00"
                           className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-black text-right focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                         />
                         <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">₱</div>
                       </div>
                    </div>
                    <div className="space-y-2 group">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-indigo-500 transition-colors">Interest (%)</label>
                       <div className="relative">
                         <input 
                           type="number" 
                           step="0.1"
                           value={formData.percentage}
                           onChange={e => setFormData({...formData, percentage: e.target.value})}
                           placeholder="0"
                           className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-black text-right focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                         />
                         <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">%</div>
                       </div>
                    </div>
                    <div className="space-y-2 group">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-indigo-500 transition-colors">Fee (₱)</label>
                       <div className="relative">
                         <input 
                           required
                           type="number" 
                           step="0.01"
                           value={formData.fee}
                           onChange={e => setFormData({...formData, fee: e.target.value})}
                           placeholder="0.00"
                           className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-black text-right focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                         />
                         <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">₱</div>
                       </div>
                    </div>
                  </div>

                  <div className="bg-indigo-600/[0.03] dark:bg-indigo-600/[0.05] border border-indigo-600/10 p-5 rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Paid Amount</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Base + Charge</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                        {formatCurrency((parseFloat(formData.amount) || 0) + (parseFloat(formData.fee) || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex gap-3 md:gap-4 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                  <button 
                    disabled={isSubmitting}
                    type="submit"
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)] flex items-center justify-center gap-3 active:scale-95 hover:bg-indigo-500 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    SAVE RECORDS
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Registration/Editing Modal */}
      <AnimatePresence>
        {showAccountModal && editingAccount && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#111218] border border-slate-200 dark:border-white/10 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleUpdateAccount}>
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Register Username</h3>
                  <button type="button" onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-8 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Name</label>
                    <input 
                      required
                      type="text" 
                      value={editingAccount.name}
                      onChange={e => setEditingAccount({...editingAccount, name: e.target.value})}
                      placeholder="e.g. My Personal GCash"
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Starting Capital (₱)</label>
                    <input 
                      type="number" 
                      value={editingAccount.capital || ""}
                      onChange={e => setEditingAccount({...editingAccount, capital: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Starting Cashout Capital (₱)</label>
                    <input 
                      type="number" 
                      value={editingAccount.capital_cashout || ""}
                      onChange={e => setEditingAccount({...editingAccount, capital_cashout: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed text-center px-4">
                    Register a username and set its working capital to track profits accurately.
                  </p>
                </div>
                <div className="p-8 pt-0 flex gap-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
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
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Purge Record?</h3>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 px-4 leading-relaxed">
                You are about to permanently delete the transaction for <span className="text-rose-500">{deleteConfirm.name}</span>. This action is irreversible.
              </p>
              
              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-all active:scale-95"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] space-y-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div 
              key={t.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
                t.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/20 text-white' : 'bg-rose-500/90 border-rose-400/20 text-white'
              }`}
            >
              {t.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
