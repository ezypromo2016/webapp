import React, { useState, useEffect, useMemo } from "react";
import { API } from "../lib/api";
import { db } from "../lib/db";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  CreditCard, 
  Banknote, 
  ChevronRight, 
  ChevronDown,
  Filter,
  X, 
  Plus, 
  Minus,
  CheckCircle2,
  Printer,
  PackageX,
  LayoutDashboard,
  Key,
  Loader2,
  Users,
  Clock,
  IdCard,
  WifiOff,
  Store,
  Menu,
  ClipboardList,
  SmartphoneNfc,
  Package,
  History,
  Settings,
  Briefcase,
  LogOut,
  Lock,
  CloudOff,
  RefreshCw,
  RefreshCcw,
  Sun,
  Moon
} from "lucide-react";
import { CashDrawer } from "../lib/cashDrawer";

import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";

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

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  stock: number;
  category: string;
  sku: string;
}

interface CartItem extends Product {
  qty: number;
}

export default function POS({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const { theme, toggleTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sukiNumber, setSukiNumber] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastTxn, setLastTxn] = useState<any>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashTendered, setCashTendered] = useState<string>("");
  const [lessAmount, setLessAmount] = useState<string>("");
  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);
  const [catMenuOpen, setCatMenuOpen] = useState(false);

  const sukiOwner = useMemo(() => {
    if (!sukiNumber) return null;
    const searchVal = sukiNumber.trim().toLowerCase();
    return customers.find((c: any) => {
      const sNum = (c.suki_number || "").toString().toLowerCase();
      const sId = (c.id || "").toString().toLowerCase();
      
      const exactMatch = sNum === searchVal || sId === searchVal;
      const last5Match = searchVal.length >= 5 && (sNum.endsWith(searchVal) || sId.endsWith(searchVal));
      
      return exactMatch || last5Match;
    });
  }, [sukiNumber, customers]);

  useEffect(() => {
    const checkSyncStatus = () => {
      if (API.isSyncing()) {
        setIsSyncing(true);
      }
    };

    checkSyncStatus();

    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => setIsSyncing(false);
    
    window.addEventListener('swiftpos-sync-start', handleSyncStart);
    window.addEventListener('sync-finished', handleSyncEnd);
    window.addEventListener('swiftpos-sync-error', handleSyncEnd);

    return () => {
      window.removeEventListener('swiftpos-sync-start', handleSyncStart);
      window.removeEventListener('sync-finished', handleSyncEnd);
      window.removeEventListener('swiftpos-sync-error', handleSyncEnd);
    };
  }, []);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const [showCart, setShowCart] = useState(false);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart]);
  
  const vatRate = useMemo(() => {
    if (!businessInfo?.vat) return 0;
    const rateStr = businessInfo.vat.replace(/[^0-9.]/g, '');
    return (parseFloat(rateStr) || 0) / 100;
  }, [businessInfo]);

  const taxAmount = useMemo(() => subtotal * vatRate, [subtotal, vatRate]);
  const discountVal = useMemo(() => parseFloat(lessAmount) || 0, [lessAmount]);
  const total = useMemo(() => subtotal + taxAmount - discountVal, [subtotal, taxAmount, discountVal]);

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, catRes, bizRes, custRes] = await Promise.all([
        API.get("/products"),
        API.get("/categories"),
        API.get("/settings/business"),
        API.get("/customers")
      ]);
      setProducts(prodRes.data);
      setCategories(["All", ...catRes.data]);
      setBusinessInfo(bizRes.data);
      setCustomers(custRes.data);
    } catch (err) {
      console.error("Failed to fetch terminal data:", err);
      // Even if API fail, we still want to load what we have locally
      const localCustomers = await db.customers.toArray();
      setCustomers(localCustomers);
    }
  };

  const change = useMemo(() => {
    const rendered = parseFloat(cashTendered) || 0;
    return Math.max(0, rendered - total);
  }, [cashTendered, total]);

  const handleOpenDrawer = async () => {
    try {
      const triggered = await CashDrawer.open();
      if (triggered) {
        addToast("Drawer triggered");
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message.includes("No port selected") || err.message.includes("No device selected")) {
        return; 
      }
      addToast(err.message, "error");
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      (p.name || "").toLowerCase().includes(search.toLowerCase()) || 
      (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || p.category === category;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

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

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, Math.min(item.qty + delta, item.stock));
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handlePrint = (txn: any) => {
    console.log("POS: Dispatching swiftpos-print", txn);
    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  const calculatePoints = (amount: number) => {
    if (amount >= 1001) return 10;
    if (amount >= 501) return 5;
    if (amount >= 100) return 2;
    return 0;
  };

  const handleSOSCredit = () => {
    if (cart.length === 0) return;
    localStorage.setItem('sos_pending_cart', JSON.stringify(cart));
    navigate('sos-credit');
  };

  const handleCheckout = async (paymentMethod: string) => {
    if (cart.length === 0) return;
    
    if (paymentMethod === "cash" && !showCashModal) {
      setShowCashModal(true);
      setCashTendered(total.toString());
      return;
    }

    setIsProcessing(true);
    try {
      const awardedPoints = sukiNumber ? calculatePoints(total) : 0;
      
      const txnRef = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const res = await API.post("/transactions", {
        id: txnRef,
        transactionNumber: txnRef,
        items: cart.map(i => ({ 
          productId: i.id, 
          name: i.name, 
          qty: i.qty, 
          price: i.price, 
          cost: i.cost,
          sku: i.sku,
          category: i.category
        })),
        subtotal,
        tax: taxAmount,
        taxRate: vatRate,
        discount: discountVal,
        total,
        paymentMethod,
        cashTendered: paymentMethod === "cash" ? parseFloat(cashTendered) : total,
        change: paymentMethod === "cash" ? change : 0,
        sukiNumber,
        pointsAwarded: awardedPoints,
        cashier: user ? { id: user.id, name: user.name } : { id: "unknown", name: "System" }
      });

      // Update customer points if suki number was used
      if (sukiNumber && awardedPoints > 0) {
        try {
          const searchVal = sukiNumber.trim().toLowerCase();
          // Use Dexie to search local DB first as it's the offline-first source of truth
          const allLocalCustomers = await db.customers.toArray();
          const customer = allLocalCustomers.find((c: any) => {
            const sNum = (c.suki_number || "").toString().toLowerCase();
            const sId = (c.id || "").toString().toLowerCase();
            
            const exactMatch = sNum === searchVal || sId === searchVal;
            const last5Match = searchVal.length >= 5 && (sNum.endsWith(searchVal) || sId.endsWith(searchVal));
            
            return exactMatch || last5Match;
          });

            if (customer) {
            const updatedPoints = (customer.points || 0) + awardedPoints;
            const updatedCustomer = { ...customer, points: updatedPoints };
            await db.customers.put(updatedCustomer); // Update local
            await API.post("/customers", updatedCustomer); // Sync to firebase
            addToast(`+${awardedPoints} Points added to ${customer.name || "Customer"}`);
          } else {
            addToast("Suki card not found", "error");
          }
        } catch (err) {
          console.error("Failed to update points:", err);
        }
      }
      
      // Auto-open drawer if cash
      if (paymentMethod === "cash") {
        try {
          await CashDrawer.open();
        } catch (e: any) {
          if (e.name !== 'NotFoundError' && !e.message.includes("No port selected") && !e.message.includes("No device selected")) {
            addToast("Drawer failed: " + e.message, "error");
          }
        }
      }

      setLastTxn(res.data);
      // Automatically trigger receipt print processing
      handlePrint(res.data);
      setCart([]);
      setSukiNumber("");
      setLessAmount("");
      setShowCashModal(false);
      setCashTendered("");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 z-50 transition-transform lg:translate-x-0 lg:static
        dark:bg-[#111218]/80 dark:border-white/5
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col flex-shrink-0
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
                      layoutId="active-indicator-pos"
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
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
              className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border pointer-events-auto backdrop-blur-md ${
                toast.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/10" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 dark:bg-rose-500/10"
              }`}
            >
              {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <PackageX className="w-5 h-5" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Left: Product Selection */}
      <div className={`flex-1 flex flex-col min-w-0 border-r border-white/5 transition-all duration-300 dark:border-white/5 light:border-slate-200 ${showCart ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <header className="p-3 md:p-4 lg:p-5 bg-white/70 dark:bg-[#111218]/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors dark:hover:bg-white/5 dark:text-slate-400"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg md:text-xl font-black text-slate-900 hidden sm:block uppercase tracking-tight dark:text-white">Product LIST</h1>
            <div className="hidden min-[400px]:block lg:hidden">
               <span className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">CBK<span className="text-indigo-600">POS</span></span>
            </div>
          </div>
          
          <div className="flex-1 min-w-[120px] max-w-sm lg:max-w-md relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search Items..." 
              value={search || ""}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 md:py-3 pl-10 pr-4 text-sm md:text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-bold text-slate-900 placeholder:text-slate-400 dark:bg-black/20 dark:border-white/5 dark:text-white uppercase"
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 md:p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            
            <button 
              onClick={handleOpenDrawer}
              className="flex items-center gap-2 p-2 md:px-3 md:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[10px] font-black text-amber-600 transition-all border border-slate-200 active:scale-95 dark:bg-white/5 dark:text-amber-500 dark:border-amber-500/20"
              title="Open Cash Drawer"
            >
              <Key className="w-4 h-4" />
              <span className="hidden xl:inline uppercase tracking-widest text-[10px]">Drawer</span>
            </button>

            <button 
              onClick={() => setShowCart(true)}
              className="lg:hidden relative p-2 md:p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#111218] dark:border-[#111218] light:border-white text-[8px] font-black flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
            
            <div className="hidden md:flex relative items-center">
              <div className="w-px h-6 bg-slate-200 mx-3 self-center dark:bg-white/5" />
              <div className="relative">
                <button 
                  onClick={() => setCatMenuOpen(!catMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[10px] font-black text-slate-600 transition-all border border-slate-200 active:scale-95 dark:bg-white/5 dark:text-slate-400 dark:border-white/5 group"
                >
                  <Filter className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="uppercase tracking-widest">{category}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${catMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {catMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setCatMenuOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5"
                      >
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-1.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Category</p>
                        </div>
                        {categories.map(cat => (
                          <button 
                            key={cat}
                            onClick={() => {
                              setCategory(cat);
                              setCatMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                              category === cat 
                                ? 'bg-indigo-600 text-white' 
                                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                            }`}
                          >
                            {cat}
                            {category === cat && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Category Dropdown */}
        <div className="md:hidden px-4 py-3 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md">
          <div className="relative">
            <button 
              onClick={() => setCatMenuOpen(!catMenuOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm transition-all active:scale-[0.99] dark:bg-white/5 dark:border-white/5"
            >
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">{category}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${catMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {catMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCatMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5"
                  >
                    {categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => {
                          setCategory(cat);
                          setCatMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                          category === cat 
                            ? 'bg-indigo-600 text-white' 
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                        }`}
                      >
                        {cat}
                        {category === cat && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-grid">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {filteredProducts.map((product, idx) => (
              <motion.button 
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`group relative p-4 rounded-2xl text-left border transition-all disabled:opacity-50 hover:border-indigo-500/50 hover:-translate-y-1 ${
                  idx % 2 === 0 
                    ? 'bg-white border-slate-200 dark:bg-[#15161d] dark:border-white/5' 
                    : 'bg-slate-50 border-slate-200 dark:bg-[#1c1d26] dark:border-white/5'
                }`}
              >
                <div className="mb-3 flex justify-between items-start">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{product.sku}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${product.stock < 10 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    Stock: {product.stock}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1 line-clamp-1 dark:text-white leading-tight">{product.name}</h3>
                <div className="h-10 overflow-y-auto scrollbar-hide mb-2">
                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed break-words">
                    {product.description || <span className="opacity-30 italic">No description</span>}
                  </p>
                </div>
                <p className="text-lg font-bold text-indigo-400">₱{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                
                {product.stock <= 0 && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded rotate-[-12deg]">SOLD OUT</span>
                  </div>
                )}
                
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                    <Plus className="w-4 h-4" />
                   </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className={`
        ${showCart ? 'fixed inset-0 z-[60] flex' : 'hidden'} md:static md:flex md:w-[320px] lg:w-[380px] xl:w-[420px] flex-col bg-white/95 backdrop-blur-xl border-l border-slate-200 dark:bg-[#111218]/95 dark:border-white/5
      `}>
        <header className="p-4 lg:p-6 border-b border-slate-100 flex items-center justify-between dark:border-white/5 sticky top-0 bg-white dark:bg-[#111218] z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCart(false)} className="md:hidden p-2 hover:bg-slate-100 rounded-xl dark:hover:bg-white/5">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 uppercase tracking-tight dark:text-white leading-none text-sm md:text-base">Add Products</h2>
                <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Order Items</p>
              </div>
            </div>
          </div>
          <span className="bg-indigo-600/10 text-indigo-600 px-2 py-0.5 md:px-3 md:py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest dark:bg-indigo-600/20 dark:text-indigo-400">{cart.length} ITEMS</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {cart.map(item => (
              <motion.div 
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key={item.id}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group dark:bg-white/5 dark:border-white/5"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 uppercase tracking-tight text-sm truncate dark:text-white leading-none">{item.name}</p>
                  <div className="max-h-8 overflow-y-auto scrollbar-hide my-1">
                    <p className="text-[9px] text-slate-400 font-medium leading-tight">
                      {item.description || <span className="opacity-30 italic">No description</span>}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">₱{item.price.toLocaleString()} / UNIT</p>
                </div>
                <div className="flex items-center bg-slate-50 rounded-xl p-1 dark:bg-black/20">
                  <button onClick={() => updateQty(item.id, -1)} className="p-1 px-2 hover:bg-white/50 rounded-lg text-slate-400 transition-colors dark:hover:bg-white/10"><Minus className="w-3 h-3"/></button>
                  <span className="w-10 text-center font-black text-sm text-indigo-600 dark:text-indigo-400">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="p-1 px-2 hover:bg-white/50 rounded-lg text-slate-400 transition-colors dark:hover:bg-white/10"><Plus className="w-3 h-3"/></button>
                </div>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 py-20 text-center space-y-6">
              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 dark:bg-white/[0.02] dark:border-white/[0.05]">
                <PackageX className="w-16 h-16 opacity-20" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cart is empty</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ready to add products...</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 md:p-6 bg-slate-50 border-t border-slate-200 dark:bg-[#15161d] dark:border-white/5 flex-shrink-0 overflow-y-auto max-h-[50vh] md:max-h-none">
          <div className="space-y-2 mb-4 md:mb-6">
            <div className="flex justify-between text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em]">
              <span className="text-slate-400">Net total</span>
              <span className="text-slate-900 dark:text-white">₱{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em]">
              <span className="text-slate-400">Tax ({ (vatRate * 100).toFixed(0) }%)</span>
              <span className="text-slate-900 dark:text-white">₱{taxAmount.toLocaleString()}</span>
            </div>

            {discountVal > 0 && (
              <div className="flex justify-between text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-rose-500">
                <span>Less Amount</span>
                <span>-₱{discountVal.toLocaleString()}</span>
              </div>
            )}

            {/* Less Amount / Discount Field */}
            <div className="pt-2">
              <label className="block text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Less Amount (Discount)</label>
              <div className="relative group">
                <Minus className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-focus-within:text-rose-400 transition-colors" />
                <input 
                  type="number"
                  placeholder="0.00"
                  value={lessAmount}
                  onChange={(e) => setLessAmount(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all text-slate-900 placeholder:text-slate-400 dark:bg-black/20 dark:border-white/5 dark:text-white"
                />
              </div>
            </div>

            {/* Suki Number Field */}
            <div className="pt-2">
              <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Suki Card Number</label>
              <div className="relative group">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="text"
                  placeholder="ENTER SUKI NO..."
                  value={sukiNumber}
                  onChange={(e) => setSukiNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-slate-900 placeholder:text-slate-400 dark:bg-black/20 dark:border-white/5 dark:text-white uppercase"
                />
              </div>
              {sukiOwner && (
                <div className="mt-1 flex flex-col gap-1 px-2 py-1.5 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Customer:</span>
                    <span className="text-[9px] font-black text-slate-900 dark:text-white">{sukiOwner.name || "Customer"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Current Points:</span>
                    <span className="text-[9px] font-black text-indigo-500">{sukiOwner.points || 0} PTS</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-indigo-500/10 pt-1 mt-1">
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Earning:</span>
                    <span className="text-[9px] font-black text-emerald-500">+{calculatePoints(total)} PTS</span>
                  </div>
                </div>
              )}
              {sukiNumber && !sukiOwner && (
                <div className="mt-1 px-2 py-1 bg-rose-500/5 rounded-lg border border-rose-500/10">
                  <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Suki card not found</span>
                </div>
              )}
            </div>

            <div className="pt-3 md:pt-4 border-t border-slate-200 dark:border-white/5">
              <div className="flex justify-between items-end">
                <span className="text-slate-500 font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em]">Total Amount</span>
                <span className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-white">₱{total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <button 
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handleCheckout("cash")}
              className="flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 transition-all font-bold text-white group"
            >
              <Banknote className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] md:text-xs uppercase font-black">CASH</span>
            </button>
            <button 
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handleCheckout("card")}
              className="flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 transition-all font-bold text-white group"
            >
              <CreditCard className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] md:text-xs uppercase font-black">CARD / GCASH</span>
            </button>
            <button 
              disabled={cart.length === 0 || isProcessing}
              onClick={handleSOSCredit}
              className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-20 transition-all font-bold group mt-1"
            >
              <Briefcase className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">SOS Credit Registry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {lastTxn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#15161d] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Order Confirmed!</h2>
              <p className="text-slate-400 text-sm mb-2">Transaction #{lastTxn.transactionNumber}</p>
              
              {lastTxn.queued && !isSyncing && (
                <div className="bg-amber-500/10 text-amber-500 text-[10px] py-1 px-4 rounded-full font-bold mb-6 inline-flex items-center gap-2 uppercase tracking-widest border border-amber-500/20">
                  <WifiOff className="w-3 h-3" />
                  Saved Offline - Pending Sync
                </div>
              )}
              
              <div className="bg-black/20 rounded-2xl p-4 mb-6 space-y-2 text-left">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Subtotal</span>
                  <span className="text-slate-300">₱{(lastTxn.subtotal || lastTxn.total - (lastTxn.tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">VAT ({ ((lastTxn.taxRate || 0) * 100).toFixed(0) }%)</span>
                  <span className="text-slate-300">₱{(lastTxn.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs font-mono pt-2 border-t border-white/5">
                  <span className="text-slate-500 uppercase">Amount Paid</span>
                  <span className="text-emerald-400 font-bold">₱{lastTxn.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {lastTxn.paymentMethod === "cash" && (
                  <div className="flex justify-between text-xs font-mono mt-1 pt-1 border-t border-white/5">
                    <span className="text-slate-500 uppercase">Change Given</span>
                    <span className="text-amber-500 font-bold">₱{(lastTxn.change || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500 uppercase">Payment</span>
                  <span className="text-white uppercase">{lastTxn.paymentMethod}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setLastTxn(null)} className="flex-1 bg-white/5 hover:bg-white/10 py-4 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest">Close</button>
                <button 
                  onClick={() => handlePrint(lastTxn)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest text-white"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cash Payment Modal */}
      <AnimatePresence>
        {showCashModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: 20, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden mx-4"
            >
              <div className="p-5 md:p-6 border-b border-white/5 flex items-center justify-between bg-[#15161d]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-white uppercase tracking-widest">Enter Payment</h2>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Payment Validation</p>
                  </div>
                </div>
                <button onClick={() => setShowCashModal(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-6 md:p-8 space-y-6 md:space-y-8 bg-[#0a0a0f]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 md:p-6 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Amount</p>
                      <p className="text-2xl md:text-3xl font-black text-white leading-none">₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4 md:p-6 bg-black/20 rounded-2xl border border-white/5 space-y-2 text-right">
                      <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Change Due</p>
                      <p className={`text-2xl md:text-3xl font-black leading-none transition-colors ${change > 0 ? 'text-yellow-400' : 'text-slate-700'}`}>₱{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Cash Tendered (₱)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-700">₱</span>
                      <input 
                        autoFocus
                        type="number" 
                        value={cashTendered || ""}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-full bg-[#15161d] border-2 border-white/5 rounded-xl py-6 md:py-8 pl-14 pr-6 text-3xl md:text-5xl font-black text-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 transition-all text-right shadow-inner tabular-nums"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[20, 50, 100, 200, 500, 1000].map(amt => (
                        <button 
                          key={amt}
                          onClick={() => setCashTendered(amt.toString())}
                          className="py-3 px-2 bg-white/5 hover:bg-emerald-500 hover:text-white border border-white/5 rounded-lg font-black text-[9px] text-slate-500 transition-all uppercase tracking-widest active:scale-95 shadow-sm"
                        >
                          +₱{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button 
                      disabled={parseFloat(cashTendered) < total || isProcessing}
                      onClick={() => handleCheckout("cash")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 py-5 rounded-2xl font-black text-xs text-white uppercase tracking-[0.2em] shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      <span>{isProcessing ? "Processing..." : "Complete Checkout"}</span>
                    </button>
                  </div>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
