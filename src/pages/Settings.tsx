import React, { useState, useEffect } from "react";
import { API } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { useRegisterSW } from 'virtual:pwa-register/react';
import { 
  CreditCard,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Printer,
  Settings as SettingsIcon,
  ShoppingCart,
  SmartphoneNfc,
  Users,
  Briefcase,
  Zap,
  ClipboardList,
  Clock,
  ArrowLeft,
  Save,
  Check,
  AlertTriangle,
  Building2,
  MapPin,
  Phone,
  FileText,
  Percent,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Mail,
  Image as ImageIcon,
  Upload,
  Download,
  Database,
  Cloud,
  RefreshCw,
  X as CloseIcon,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { db } from "../lib/db";
import SerialTerminal from "../components/SerialTerminal";

export default function Settings({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { icon: SettingsIcon, label: "Settings", id: "settings", allowed: isAdmin && !isRestrictedUser }
  ];
  
  const [businessData, setBusinessData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    tin: "",
    vat: "",
    logo: ""
  });
  const [syncing, setSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{connected: boolean, error?: string} | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const checkCloudStatus = async () => {
    try {
      // Connect directly to the health check doc in Firestore
      const snap = await API.get("/settings/db/status");
      setCloudStatus({ connected: true });
    } catch (err: any) {
      setCloudStatus({ connected: false, error: "Firestore connection offline" });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        addToast("Logo size must be less than 1MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBusinessData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate("dashboard");
      return;
    }
    fetchSettings();
    checkCloudStatus();
  }, [isAdmin]);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await API.get("/settings/business");
      if (res && res.data) {
        setBusinessData(prev => ({ 
          ...prev, 
          ...res.data,
          logo: res.data.logo || "" // Ensure logo is never undefined
        }));
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.post("/settings/business", businessData);
      addToast("Settings saved successfully");
    } catch (err) {
      console.error(err);
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex flex-col font-sans transition-colors duration-300">
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
                toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transition-colors duration-300 lg:translate-x-0 lg:static
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          dark:bg-[#111218] dark:border-white/5
          flex flex-col
        `}>
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 uppercase dark:text-white leading-none">SwiftPOS</span>
          </div>
          
          <nav className="mt-6 px-4 space-y-1.5 font-sans flex-1 overflow-y-auto scrollbar-hide">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block px-4">Navigation</label>
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

          <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
             <button 
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm dark:bg-white/5 dark:border-transparent dark:hover:bg-rose-600"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 md:p-6 md:px-10 dark:bg-[#111218]/80 dark:border-white/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
              <div className="flex items-center gap-3 md:gap-4">
                <button 
                  className="lg:hidden p-2 md:p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-500 transition-all active:scale-95 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight dark:text-white leading-none">Settings</h1>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 md:mt-2">Terminal Registry</p>
                </div>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={saving || loading}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20 transition-all font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 lg:p-10">
            <div className="max-w-4xl mx-auto w-full">
              {loading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accessing records...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* FORM CONTENT */}

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-[#15161d] border border-white/5 rounded-2xl overflow-hidden shadow-xl dark:bg-[#15161d] dark:border-white/5 light:bg-white light:border-slate-200"
            >
              <div className="p-4 md:p-5 border-b border-white/5 bg-[#1c1d26]/50 flex items-center gap-3 dark:bg-[#1c1d26]/50 dark:border-white/5 light:bg-slate-50 light:border-slate-200">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Sun className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
                <div>
                  <h2 className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-widest dark:text-white light:text-slate-900">System Appearance</h2>
                  <p className="text-[7.5px] md:text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 md:mt-1">Interface Theme & Visual Mode</p>
                </div>
              </div>

              <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all ${
                        theme === "dark" 
                          ? "bg-slate-900 border-indigo-500 text-indigo-400 shadow-xl shadow-indigo-500/10" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-black/20 dark:border-white/5"
                      }`}
                    >
                      <div className={`p-1.5 md:p-2 rounded-lg ${theme === "dark" ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                        <Moon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Dark Mode</p>
                        <p className="text-[7px] md:text-[8px] font-bold opacity-60">High contrast for low light</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all ${
                        theme === "light" 
                          ? "bg-white border-indigo-600 text-indigo-600 shadow-xl shadow-indigo-600/10" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-black/20 dark:border-white/5"
                      }`}
                    >
                      <div className={`p-1.5 md:p-2 rounded-lg ${theme === "light" ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                        <Sun className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Light Mode</p>
                        <p className="text-[7px] md:text-[8px] font-bold opacity-60">Clean & crisp daily view</p>
                      </div>
                    </button>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#15161d] border border-white/5 rounded-2xl overflow-hidden shadow-xl dark:bg-[#15161d] dark:border-white/5 light:bg-white light:border-slate-200"
            >
              <div className="p-5 border-b border-white/5 bg-[#1c1d26]/50 flex items-center gap-3 dark:bg-[#1c1d26]/50 dark:border-white/5 light:bg-slate-50 light:border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Business Configuration</h2>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Identity & Compliance Metadata</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Logo Upload */}
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Brand Identity (Logo)</label>
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden dark:bg-black/20 dark:border-white/5">
                        {businessData.logo ? (
                          <img src={businessData.logo} alt="Business Logo" className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      {businessData.logo && (
                        <button 
                          type="button"
                          onClick={() => setBusinessData(prev => ({ ...prev, logo: "" }))}
                          className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <CloseIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 text-indigo-500 rounded-xl cursor-pointer hover:bg-indigo-600 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">
                        <Upload className="w-3 h-3" />
                        Upload Vision
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-2">Recommended: Square PNG/JPG • Max 1MB</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Business Name */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Corporate Title</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                      <input 
                        required
                        type="text" 
                        value={businessData.name}
                        onChange={e => setBusinessData({...businessData, name: e.target.value})}
                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl py-2.5 pl-11 pr-5 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-xs font-bold dark:bg-[#0a0a0f] dark:border-white/5 light:bg-slate-50 light:border-slate-200 light:text-slate-900"
                        placeholder="Organization Name"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Communications Portal (Phone)</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                      <input 
                        required
                        type="text" 
                        value={businessData.phone}
                        onChange={e => setBusinessData({...businessData, phone: e.target.value})}
                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl py-2.5 pl-11 pr-5 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-xs font-bold dark:bg-[#0a0a0f] dark:border-white/5 light:bg-slate-50 light:border-slate-200 light:text-slate-900"
                        placeholder="Contact number"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Official Inbox (Email)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                      <input 
                        required
                        type="email" 
                        value={businessData.email}
                        onChange={e => setBusinessData({...businessData, email: e.target.value})}
                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl py-2.5 pl-11 pr-5 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-xs font-bold dark:bg-[#0a0a0f] dark:border-white/5 light:bg-slate-50 light:border-slate-200 light:text-slate-900"
                        placeholder="business@example.com"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Geospatial Origin (Address)</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-3 w-4 h-4 text-slate-700" />
                      <textarea 
                        required
                        rows={2}
                        value={businessData.address}
                        onChange={e => setBusinessData({...businessData, address: e.target.value})}
                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl pt-2.5 pb-2.5 pl-11 pr-5 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-xs font-bold resize-none dark:bg-[#0a0a0f] dark:border-white/5 light:bg-slate-50 light:border-slate-200 light:text-slate-900"
                        placeholder="Official location details..."
                      />
                    </div>
                  </div>

                  {/* TIN */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Taxation ID (TIN Scan)</label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                      <input 
                        required
                        type="text" 
                        value={businessData.tin}
                        onChange={e => setBusinessData({...businessData, tin: e.target.value})}
                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl py-2.5 pl-11 pr-5 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-mono text-xs dark:bg-[#0a0a0f] dark:border-white/5 light:bg-slate-50 light:border-slate-200 light:text-slate-900"
                        placeholder="Registration No."
                      />
                    </div>
                  </div>

                  {/* VAT */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">VAT Coefficient (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                      <input 
                        required
                        type="text" 
                        value={businessData.vat}
                        onChange={e => setBusinessData({...businessData, vat: e.target.value})}
                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl py-2.5 pl-11 pr-5 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-xs font-bold dark:bg-[#0a0a0f] dark:border-white/5 light:bg-slate-50 light:border-slate-200 light:text-slate-900"
                        placeholder="Default VAT rate"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#15161d] border border-white/5 rounded-2xl overflow-hidden shadow-xl dark:bg-[#15161d] dark:border-white/5 light:bg-white light:border-slate-200"
            >
              <div className="p-4 md:p-5 border-b border-white/5 bg-[#1c1d26]/50 flex items-center gap-3 dark:bg-[#1c1d26]/50 dark:border-white/5 light:bg-slate-50 light:border-slate-200">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
                <div>
                  <h2 className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-widest">System Stability</h2>
                  <p className="text-[7.5px] md:text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Version Control & Updates</p>
                </div>

                {needRefresh && (
                  <div className="ml-auto px-2 py-0.5 bg-indigo-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse">
                    Update Ready
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6">
                <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 mb-6">
                  <div className="flex items-start gap-3">
                    <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-indigo-400/80 font-bold leading-relaxed uppercase tracking-widest">
                       {needRefresh 
                        ? "A strategic update is pending optimization. Finalize the deployment to ensure peak system performance and security."
                        : "Your system is currently synchronized with the latest global protocol. No manual intervention is required."}
                    </p>
                  </div>
                </div>

                {needRefresh ? (
                  <button 
                    type="button"
                    onClick={() => updateServiceWorker(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Finalize Deployment
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={async () => {
                      addToast("Checking for updates...");
                      try {
                        const registration = await navigator.serviceWorker.getRegistration();
                        if (registration) {
                          await registration.update();
                          // PWA plugin handles this automatically in the background, 
                          // but we show the toast to confirm action
                          setTimeout(() => addToast("System is up to date"), 1500);
                        } else {
                          addToast("PWA not ready", "error");
                        }
                      } catch (err) {
                        addToast("Check failed", "error");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5 active:scale-95"
                  >
                    Check for Updates
                  </button>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <SerialTerminal />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex gap-4 items-start dark:bg-indigo-500/5 dark:border-indigo-500/10"
            >
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest dark:text-indigo-300">Synchronized Global Protocol</p>
                <p className="text-[11px] text-indigo-600/70 leading-relaxed font-bold dark:text-indigo-400/80 uppercase tracking-tight">
                  Modifying financial coefficients here will instantly override all receipt generation protocols across the system. Ensure all data corresponds to verified legal documentation.
                </p>
              </div>
            </motion.div>
          </form>
          )}
          </div>
        </main>
      </div>
    </div>
  </div>
  );
}
