import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, LayoutDashboard, ShoppingCart, Package, History, 
  Settings, LogOut, Search, Menu, X, Plus, UserPlus,
  User, MapPin, Phone, Calendar, Printer, RefreshCw, 
  CheckCircle2, AlertCircle, Users, IdCard, Trash2, ClipboardList,
  Download, Filter, ChevronRight, Lock, CreditCard, Image as ImageIcon,
  Sparkles, Hash,
  Briefcase,
  Clock,
  SmartphoneNfc,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import JsBarcode from "jsbarcode";
import { toJpeg } from "html-to-image";

export default function SukiGenerator({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const { theme, toggleTheme } = useTheme();

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
  const [formData, setFormData] = useState({
    name: "SUKI MEMBER",
    id: `SUKI-${Date.now()}`
  });
  
  const barcodeRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("dashboard");
      return;
    }
  }, [isAdmin]);

  useEffect(() => {
    if (formData.id && barcodeRef.current) {
      JsBarcode(barcodeRef.current, formData.id, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontOptions: "bold",
        fontSize: 14,
        margin: 10
      });
    }
  }, [formData.id]);

  const generateNewId = () => {
    setFormData(prev => ({ ...prev, id: `SUKI-${Date.now()}` }));
  };

  const handleDownload = async () => {
    if (cardRef.current === null) return;
    setIsGenerating(true);
    
    try {
      // Small delay to ensure rendering matches
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toJpeg(cardRef.current, { 
        quality: 0.95, 
        backgroundColor: '#fff',
        pixelRatio: 2 // Higher resolution
      });
      
      const link = document.createElement('a');
      link.download = `SUKI_CARD_${formData.name.replace(/\s+/g, '_').toUpperCase()}.jpeg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download card:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-300 font-sans">
      {/* Sidebar - Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transition-transform lg:translate-x-0 lg:static dark:bg-[#111218] dark:border-white/5 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">CBK<span className="text-indigo-600">POS</span></span>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          {sidebarItems.map((item, idx) => {
            const isActive = currentPage === item.id;
            return (
              <button 
                key={idx} 
                onClick={() => item.allowed && navigate(item.id as any)} 
                disabled={!item.allowed} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all 
                  ${!item.allowed ? 'opacity-30 cursor-not-allowed filter grayscale' : ''} 
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : (item.allowed ? 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100' : 'text-slate-400')}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {!item.allowed && <Lock className="w-3 h-3 ml-auto opacity-50" />}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 dark:bg-[#1c1d26] dark:border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center font-black text-slate-600 dark:text-white">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{user?.name || "User"}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{user?.role || "Member"}</p>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto max-h-screen">
        <header className="sticky top-0 z-30 bg-[#f8f9fa]/80 dark:bg-[#0a0a0f]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 p-4 lg:p-6">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Suki Card Generator</h2>
          </div>
        </header>

        <div className="p-4 lg:p-12 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 items-start">
            
            {/* Left Side: Setup */}
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight">Card Customizer</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Adjust details for the suki membership card</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Customer Display Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                      placeholder="ENTER NAME..."
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Unique Identifier (ID)</label>
                      <button onClick={generateNewId} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> New ID
                      </button>
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={formData.id}
                        onChange={(e) => setFormData({...formData, id: e.target.value.toUpperCase()})}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-6 grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleDownload}
                      disabled={isGenerating}
                      className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" /> Download image
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 dark:bg-white/5"
                    >
                      <Printer className="w-4 h-4" /> Print Card
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">Printing Advice</h4>
                  <p className="text-[10px] text-amber-600 font-bold leading-relaxed">
                    For best results, use standard PVC card printers or 250gsm cardstock. Ensure the barcode is clear and has high contrast for scanner readability.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Preview */}
            <div className="flex flex-col items-center gap-8 sticky top-28">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Real-time Live Preview</p>
              
              <div 
                ref={cardRef}
                className="w-[450px] h-[280px] bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-900 rounded-[2.5rem] p-10 text-left relative flex flex-col justify-between shadow-2xl overflow-hidden shadow-indigo-500/30"
              >
                {/* Patterns */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xl border border-white/20">
                      <Store className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="block text-sm font-black text-white tracking-[0.2em] uppercase leading-none">CBK STORE</span>
                      <span className="text-[8px] font-black text-white/50 tracking-[0.3em] uppercase mt-1 block">OFFICIAL PARTNER</span>
                    </div>
                  </div>
                  <div className="bg-emerald-500/20 backdrop-blur-md px-3 py-1 rounded-lg border border-emerald-500/20">
                     <span className="text-[8px] font-black text-emerald-400 tracking-widest uppercase italic">SUKI SUPREME</span>
                  </div>
                </div>

                <div className="relative z-10">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.4em] mb-2">GOLD MEMBERSHIP</p>
                  <h4 className="text-2xl font-black text-white uppercase tracking-tighter truncate leading-none mb-1">
                    {formData.name || "SUKI MEMBER"}
                  </h4>
                  <div className="h-0.5 w-12 bg-white/20 rounded-full" />
                </div>

                <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center relative z-10 shadow-xl overflow-hidden">
                  <svg ref={barcodeRef} className="w-full max-h-[70px]" />
                </div>
                
                {/* Decorative lines at the bottom */}
                <div className="absolute bottom-4 right-10 flex gap-1 items-end opacity-20">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-8 w-[2px] bg-white rounded-full" style={{ height: `${i * 4 + 4}px` }} />)}
                </div>
              </div>

              <div className="text-center space-y-2 opacity-50">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
                  <IdCard className="w-3.5 h-3.5" /> High-Resolution Graphics Enabled
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Standard Credit Card Size (ID-1 Format)
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
