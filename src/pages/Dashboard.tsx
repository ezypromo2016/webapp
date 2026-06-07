import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { API } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, LayoutDashboard, ShoppingCart, Package, History, Wallet,
  Settings, LogOut, DollarSign, Calendar, TrendingUp, 
  AlertTriangle, Menu, X, Bell, ChevronRight, ChevronDown, 
  Printer, Sun, Moon, RotateCcw, Filter, ArrowUpRight,
  TrendingDown, Briefcase, Tag, RefreshCw, Cloud, CloudOff, CheckCircle2,
  CreditCard, Lock, Users, Clock, IdCard, ClipboardList, SmartphoneNfc
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { db } from "../lib/db";
import axios from "axios";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, 
  ResponsiveContainer, BarChart, Bar, Cell, Legend as ReLegend, 
  PieChart, Pie
} from 'recharts';

interface DashboardData {
  today: { totalSales: number; totalTransactions: number; totalProfit: number; printingSales: number };
  monthly: { totalSales: number; totalTransactions: number; totalProfit: number; printingSales: number };
  allTime: { totalTransactions: number; totalProfit: number; printingSales: number };
  inventory: { lowStockCount: number; outOfStockCount: number };
  recentTransactions: any[];
  topProducts: any[];
  orderExpenses: any[];
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
      {isSyncing && (
        <div className="flex gap-0.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-1 h-3 bg-indigo-500/30 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartRange, setChartRange] = useState(30);
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseLabel, setNewExpenseLabel] = useState("");
  const [deductionType, setDeductionType] = useState<"gross" | "profit">("gross");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [paymongoBalance, setPaymongoBalance] = useState<number | null>(null);
  const [paymongoPendingBalance, setPaymongoPendingBalance] = useState<number>(0);
  const [paymongoError, setPaymongoError] = useState<string | null>(null);
  const [nextPayout, setNextPayout] = useState<{ amount: number; date: string } | null>(null);
  const [loadingPaymongo, setLoadingPaymongo] = useState(false);

  const fetchPayMongoBalance = async () => {
    if (!isAdmin) return;
    setLoadingPaymongo(true);
    setPaymongoError(null);
    try {
      const response = await API.getPayMongoBalance();
      if (response.error) throw new Error(response.error);
      
      setPaymongoBalance(response.data?.balance || 0);
      setPaymongoPendingBalance(0);
    } catch (error: any) {
      console.error("Dashboard: PayMongo Balance Error", error);
      setPaymongoBalance(null);
      setPaymongoError(error.message || "Failed to load balance");
    } finally {
      setLoadingPaymongo(false);
    }
  };

  const fetchData = async () => {
    try {
      const query = { days: chartRange };
      const [summary, chart, payment, category, expenses] = await Promise.all([
        API.get("/dashboard/summary", {}),
        API.get("/dashboard/chart", query),
        API.get("/dashboard/payment-breakdown", {}),
        API.get("/dashboard/category-sales", {}),
        API.get("/order_expenses")
      ]);
      
      const summaryData = summary.data;
      summaryData.orderExpenses = expenses.data || [];
      
      setData(summaryData);
      setTimelineData(chart.data);
      setPaymentData(payment.data.map((d: any) => ({ name: d._id.toUpperCase(), value: d.total })));
      setCategorySales(category.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
      if (isAdmin) fetchPayMongoBalance();
    }, 300);
    return () => clearTimeout(timer);
  }, [chartRange, isAdmin]);

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);

  const currentMonthExpenses = (data?.orderExpenses || []).filter((e: any) => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  
  const totalGrossExpenses = currentMonthExpenses
    .filter((e: any) => e.deductionType === 'gross' || !e.deductionType)
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    
  const totalProfitExpenses = currentMonthExpenses
    .filter((e: any) => e.deductionType === 'profit')
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  const handleAddExpense = async () => {
    if (!newExpenseAmount || !newExpenseLabel) return;
    setIsSubmittingExpense(true);
    try {
      await API.post("/order_expenses", {
        label: newExpenseLabel.toUpperCase(),
        amount: parseFloat(newExpenseAmount),
        deductionType,
        created_at: new Date().toISOString()
      });
      setNewExpenseAmount("");
      setNewExpenseLabel("");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await API.delete(`/order_expenses/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1c1d26] p-4 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl backdrop-blur-md bg-opacity-90">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-white/5 pb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8 mb-1 last:mb-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[11px] font-bold text-slate-400 uppercase">{entry.name}</span>
              </div>
              <span className="font-black text-slate-900 dark:text-white">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    if (isRestrictedUser) {
      navigate('gcash' as any);
    }
  }, [isRestrictedUser]);

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
    { icon: SmartphoneNfc, label: "Pera Padala", id: "send-money", allowed: true },
    { icon: Settings, label: "Settings", id: "settings", allowed: isAdmin && !isRestrictedUser }
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-500 font-sans overflow-hidden">
      {/* Modern Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sidebar - Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 z-50 transition-transform lg:translate-x-0 lg:static
        dark:bg-[#111218]/80 dark:border-white/5
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="p-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <LayoutDashboard className="w-5 h-5 text-white" />
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

        <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-1 scrollbar-hide py-2">
          <div className="px-4 mb-4">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block">Navigation</label>
          </div>
          {sidebarItems.map((item, idx) => {
            const isActive = currentPage === item.id;
            return (
              <motion.button 
                key={idx} 
                whileHover={item.allowed ? { x: 4, scale: 1.01 } : {}}
                whileTap={item.allowed ? { scale: 0.98 } : {}}
                onClick={() => {
                  if(item.allowed) {
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
                    layoutId="active-indicator-dash"
                    className="absolute left-0 w-1 h-6 bg-indigo-600 rounded-r-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
              </motion.button>
            );
          })}
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto max-h-screen relative z-10 scrollbar-hide min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#0a0a0f]/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 p-4 lg:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">SALES DASHBOARD</h2>
          </div>

          <div className="flex items-center gap-3">
             <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 border ${data?.today ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                {data?.today ? (
                  <>
                    <Cloud className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Resilient Link Active</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Bridging Static Data</span>
                  </>
                )}
             </div>
             <button 
              onClick={toggleTheme}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

          </div>
        </header>

        <div className={`p-4 lg:p-10 max-w-[1600px] mx-auto space-y-10 ${isRestrictedUser ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
          
          {/* Modern Balance Hero for Admins */}
          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-violet-600/10 dark:from-indigo-600/5 dark:to-violet-600/5 blur-3xl opacity-50" />
              <div className="relative bg-white/70 dark:bg-[#111218]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 transition-all hover:border-indigo-500/30">
                <div className="space-y-4 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl">
                      <Wallet className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">PayMongo Network</h4>
                      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">REAL-TIME WALLET AUDIT</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                      <span className="text-2xl font-black text-indigo-500 tracking-tighter">₱</span>
                      <h2 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums leading-none">
                        {loadingPaymongo ? (
                          <div className="w-48 h-14 bg-slate-200 dark:bg-white/5 animate-pulse rounded-2xl" />
                        ) : paymongoError ? (
                           <div className="flex flex-col">
                             <span className="text-xl font-black text-red-500 uppercase tracking-wider">ERROR</span>
                             <span className="text-[10px] text-red-400 font-bold max-w-[200px] truncate">{paymongoError}</span>
                           </div>
                        ) : paymongoBalance === null ? (
                          <span className="text-slate-300 dark:text-slate-700">--.---</span>
                        ) : paymongoBalance === 0 ? (
                          "0.00"
                        ) : (
                          paymongoBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        )}
                      </h2>
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${paymongoBalance !== null ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {paymongoBalance !== null ? 'Active Connection' : 'Sync Pending'}
                      </span>
                      {paymongoBalance !== null && (
                         <div className="flex items-center gap-1.5 ml-4 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                           <TrendingUp className="w-3 h-3 text-emerald-500" />
                           <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Secure</span>
                         </div>
                      )}
                      {paymongoPendingBalance > 0 && (
                        <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                           <Clock className="w-3 h-3 text-indigo-500" />
                           <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Pending: ₱{paymongoPendingBalance.toFixed(2)}</span>
                        </div>
                      )}
                      {nextPayout && (
                        <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                           <Calendar className="w-3 h-3 text-amber-500" />
                           <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Next Payout: ₱{nextPayout.amount.toFixed(2)} on {nextPayout.date}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <button 
                    onClick={fetchPayMongoBalance}
                    disabled={loadingPaymongo}
                    className="group/refresh p-6 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 hover:border-indigo-500/30 rounded-[2.5rem] transition-all active:scale-95 disabled:opacity-50 relative overflow-hidden"
                  >
                    <RefreshCw className={`w-8 h-8 text-indigo-500 group-hover/refresh:rotate-180 transition-transform duration-700 ${loadingPaymongo ? 'animate-spin' : ''}`} />
                  </button>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sync Balance</span>
                </div>
              </div>
            </motion.div>
          )}
          
          {isRestrictedUser && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem] text-center mb-10">
              <Lock className="w-8 h-8 text-amber-500 mx-auto mb-4" />
              <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest">Restricted Preview</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Full dashboard audit is locked for this terminal profile</p>
            </div>
          )}

          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {[
              { label: "Today's Sales", value: data?.today.totalSales, icon: DollarSign, color: "text-emerald-500", accent: "bg-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", shadow: "shadow-emerald-500/10" },
              { label: "Monthly Sales", value: data?.monthly.totalSales, icon: Calendar, color: "text-blue-500", accent: "bg-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", shadow: "shadow-blue-500/10" },
              { label: "Daily Profit", value: data?.today.totalProfit, icon: TrendingUp, color: "text-indigo-500", accent: "bg-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", shadow: "shadow-indigo-500/10" },
              { label: "Total Transactions", value: data?.allTime.totalTransactions, icon: History, color: "text-slate-500", accent: "bg-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20", shadow: "shadow-slate-500/10", isCount: true },
              { label: "Total Profit", value: (data?.allTime.totalProfit || 0) - totalProfitExpenses, icon: Briefcase, color: "text-violet-500", accent: "bg-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20", shadow: "shadow-violet-500/10" },
              { label: "Daily Printing Sales", value: data?.today.printingSales, icon: Printer, color: "text-fuchsia-500", accent: "bg-fuchsia-500", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", shadow: "shadow-fuchsia-500/10" },
              { label: "Inventory Health", value: (data?.inventory.lowStockCount || 0) + (data?.inventory.outOfStockCount || 0), icon: Package, color: "text-rose-500", accent: "bg-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", shadow: "shadow-rose-500/10", isCount: true },
              { label: "GROSS INCOME", value: (data?.monthly.totalSales || 0) - (data?.monthly.totalProfit || 0) - totalGrossExpenses, icon: TrendingDown, color: "text-amber-500", accent: "bg-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", shadow: "shadow-amber-500/10" },
            ].sort((a, b) => a.label.localeCompare(b.label)).map((stat: any, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: "spring", damping: 20 }}
                className={`group relative overflow-hidden bg-white/70 dark:bg-[#15161d]/80 backdrop-blur-xl border ${stat.border} p-8 rounded-[2.5rem] shadow-xl ${stat.shadow} text-center flex flex-col items-center justify-center transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:bg-white dark:hover:bg-[#15161d]`}
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 inset-x-0 h-1 ${stat.accent} opacity-40 group-hover:opacity-100 transition-opacity`} />
                <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full ${stat.bg} blur-3xl opacity-20 group-hover:opacity-60 transition-opacity`} />
                
                <div className={`${stat.bg} ${stat.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner relative`}>
                  <stat.icon className="w-8 h-8" />
                  <div className={`absolute inset-0 rounded-2xl ${stat.accent} opacity-0 group-hover:opacity-10 animate-pulse`} />
                </div>
                
                <div className="space-y-1 relative z-10">
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-1 leading-none">
                    {stat.label}
                  </p>
                  <h3 className="text-3xl font-black tracking-tighter leading-tight font-sans text-slate-900 dark:text-white">
                    {stat.isCount ? stat.value : formatCurrency(stat.value || 0)}
                  </h3>
                  <div className="flex items-center justify-center gap-2 mt-3 p-1 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${stat.accent} animate-pulse`} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Live Metric
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Charts Section */}
          <div className="grid grid-cols-1 gap-8 min-w-0">
            {/* Store vs Printing Performance */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm flex flex-col"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Revenue Dynamics</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Cross-vertical performance comparison</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
                  {[7, 30, 90].map(r => (
                    <button 
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${chartRange === r ? 'bg-white dark:bg-[#1c1d26] text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      {r}D
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-[400px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorStore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPrinting" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                      tickFormatter={(val) => `₱${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                      dx={-10}
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <ReLegend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, paddingBottom: 20 }}
                    />
                    <Area 
                      name="Store Sales"
                      type="monotone" 
                      dataKey="total" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorStore)" 
                    />
                    <Area 
                      name="Printing Sales"
                      type="monotone" 
                      dataKey="printing" 
                      stroke="#ec4899" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPrinting)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Order Expenses Section */}
          <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Order Expenses</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Operational overhead registry</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text"
                  placeholder="EXPENSE DESCRIPTION"
                  value={newExpenseLabel}
                  onChange={e => setNewExpenseLabel(e.target.value)}
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-48"
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">₱</span>
                  <input 
                    type="number"
                    placeholder="AMOUNT"
                    value={newExpenseAmount}
                    onChange={e => setNewExpenseAmount(e.target.value)}
                    className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-7 pr-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-32"
                  />
                </div>
                <div className="relative w-full sm:w-44 group">
                  <select
                    value={deductionType}
                    onChange={e => setDeductionType(e.target.value as "gross" | "profit")}
                    className="appearance-none w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-500/30 transition-all cursor-pointer"
                  >
                    <option value="gross" className="bg-white dark:bg-[#15161d] py-2">Deduct from Gross</option>
                    <option value="profit" className="bg-white dark:bg-[#15161d] py-2">Deduct from Profit</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
                <button 
                  onClick={handleAddExpense}
                  disabled={isSubmittingExpense || !newExpenseAmount || !newExpenseLabel}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                >
                  {isSubmittingExpense ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentMonthExpenses.length === 0 ? (
                <div className="col-span-full py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2rem]">
                  <TrendingDown className="w-8 h-8 text-slate-200 dark:text-white/10 mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No expenses recorded for this interval</p>
                </div>
              ) : (
                currentMonthExpenses.map((expense: any) => (
                  <div key={expense.id} className="group bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between hover:border-indigo-500/20 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">{expense.label}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter ${
                          expense.deductionType === 'profit' 
                            ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30' 
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          {expense.deductionType || 'gross'}
                        </span>
                      </div>
                      <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{formatCurrency(expense.amount)}</p>
                      <div className="flex items-center gap-1.5 mt-2 opacity-80">
                        <Clock className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                        <p className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">
                          {new Date(expense.created_at).toLocaleDateString()} • {new Date(expense.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-lg text-rose-500 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {currentMonthExpenses.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-4">
                <div className="bg-amber-500/5 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-500/10">
                  <p className="text-[9px] font-black text-amber-600/80 dark:text-amber-400/80 uppercase tracking-[0.2em] mb-1">Gross Deductions</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400 drop-shadow-sm">{formatCurrency(totalGrossExpenses)}</p>
                </div>
                <div className="bg-violet-500/5 dark:bg-violet-500/10 p-4 rounded-2xl border border-violet-500/10 text-right">
                  <p className="text-[9px] font-black text-violet-600/80 dark:text-violet-400/80 uppercase tracking-[0.2em] mb-1">Profit Deductions</p>
                  <p className="text-xl font-black text-violet-600 dark:text-violet-400 drop-shadow-sm">{formatCurrency(totalProfitExpenses)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pb-20" />
        </div>
      </main>
    </div>
  );
}
