import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../lib/db";
import { API } from "../lib/api";
import { 
  ClipboardList, Plus, Trash2, ArrowLeft, Save, 
  Search, Clock, Calendar, ChevronRight, Menu, Sun, Moon,
  Edit2, X, Check, Loader2, Camera, Image as ImageIcon, Paperclip,
  LayoutDashboard, Store, ShoppingCart, Package, Briefcase, History, Users, IdCard, Printer, CreditCard,
  Settings, LogOut, Lock, RefreshCw, SmartphoneNfc, CloudOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/theme";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

export default function Orders({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
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
  const { theme, toggleTheme } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, content: string} | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error'}[]>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const resp = await API.get("/orders");
      setOrders(resp.data);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (orderId: string): Promise<string | null> => {
    if (!selectedImage || !storage) return null;
    try {
      const storageRef = ref(storage, `orders/${orderId}_${selectedImage.name}`);
      const snapshot = await uploadBytes(storageRef, selectedImage);
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (err) {
      console.error("Image upload failed:", err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);

    const orderId = `ORD-${Date.now()}`;
    const imageUrl = await uploadImage(orderId);

    const newOrder = {
      id: orderId,
      content: content.trim(),
      image_url: imageUrl,
      created_at: new Date().toISOString()
    };

    try {
      await API.post("/orders", newOrder);
      addToast("Order logged successfully");
      setContent("");
      setSelectedImage(null);
      setImagePreview(null);
      loadOrders();
    } catch (err) {
      console.error("Save failed:", err);
      addToast("Failed to save order", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    setIsSubmitting(true);

    const updatedOrder = orders.find(o => o.id === id);
    if (!updatedOrder) return;

    try {
      await API.put(`/orders/${id}`, { ...updatedOrder, content: editContent.trim(), updated_at: new Date().toISOString() });
      addToast("Order updated");
      setEditingId(null);
      setEditContent("");
      loadOrders();
    } catch (err) {
      console.error("Update failed:", err);
      addToast("Failed to update", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await API.delete(`/orders/${deleteConfirm.id}`);
      addToast("Order deleted");
      setDeleteConfirm(null);
      loadOrders();
    } catch (err) {
      console.error("Delete failed:", err);
      addToast("Delete failed", "error");
    }
  };

  const filteredOrders = orders.filter(o => 
    o.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                      layoutId="active-indicator-orders"
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

      <main className="flex-1 overflow-y-auto max-h-screen scrollbar-hide relative z-10 min-w-0 font-sans">
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#0a0a0f]/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 p-4 lg:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600">Quick Orders</h2>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="hidden md:flex items-center h-10 bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-xl px-4">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="Search notes..." 
                className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase tracking-widest w-48 text-slate-900 dark:text-white placeholder-slate-400 uppercase" 
              />
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">New Order Note</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Capture items or reminders instantly</p>
              </div>
            </div>

                <div className="space-y-4">
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your order items here... (e.g. 2x T-Shirt XL, 1x Coffee)"
                className="w-full min-h-[150px] p-6 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl outline-none focus:border-indigo-500/50 transition-all text-slate-800 dark:text-slate-200 font-medium placeholder-slate-400"
              />
              
              {imagePreview && (
                <div className="relative w-full max-w-[200px] aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {storage && (
                    <>
                      <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer text-[9px] font-black uppercase tracking-widest group">
                        <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Attach Photo
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                      <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer text-[9px] font-black uppercase tracking-widest group">
                        <Paperclip className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        File
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                    </>
                  )}
                </div>
                
                <button 
                  onClick={handleSave}
                  disabled={!content.trim() || isSubmitting}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 flex items-center gap-3 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                  Save to QuickLog
                </button>
              </div>
            </div>
          </motion.div>

          {/* List Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-4">Saved Orders ({filteredOrders.length})</h4>
            <div className="grid grid-cols-1 gap-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className="text-[9px] font-black text-slate-500 uppercase">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-[9px] font-black text-slate-500 uppercase">
                              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {editingId === order.id ? (
                          <textarea 
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full min-h-[100px] p-4 bg-slate-50 dark:bg-black/20 border-2 border-indigo-500/30 rounded-2xl outline-none text-slate-800 dark:text-slate-200 font-medium"
                            placeholder="Edit your order..."
                          />
                        ) : (
                          <div className="flex flex-col gap-4">
                            <p className="text-slate-700 dark:text-slate-300 font-bold whitespace-pre-wrap leading-relaxed">
                              {order.content}
                            </p>
                            {order.image_url && (
                              <div className="w-full max-w-sm rounded-[1.5rem] overflow-hidden border border-slate-200 dark:border-white/10 group-hover:border-indigo-500/30 transition-colors">
                                <img src={order.image_url} alt="Order Attachment" className="w-full h-auto object-cover max-h-64" referrerPolicy="no-referrer" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-end gap-2">
                        {editingId === order.id ? (
                          <>
                            <button 
                              onClick={() => handleUpdate(order.id)}
                              disabled={isSubmitting}
                              className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all outline-none"
                              title="Save Changes"
                            >
                              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => { setEditingId(null); setEditContent(""); }}
                              className="p-3 bg-slate-500/10 text-slate-500 rounded-xl hover:bg-slate-500 hover:text-white transition-all outline-none"
                              title="Cancel Edit"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => { setEditingId(order.id); setEditContent(order.content); }}
                              className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500 hover:text-white transition-all outline-none"
                              title="Edit Note"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm({ id: order.id, content: order.content })}
                              className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all outline-none"
                              title="Delete Note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {!isLoading && filteredOrders.length === 0 && (
                <div className="text-center py-20 bg-slate-50/50 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-white/10">
                  <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-white/5">
                    <ClipboardList className="w-8 h-8 text-slate-300" />
                  </div>
                  <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest">No orders logged</h5>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Start by typing something above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Delete Order?</h3>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 px-4 leading-relaxed line-clamp-3">
                “{deleteConfirm.content}”
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
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
                toast.type === 'success' 
                  ? 'bg-emerald-500/90 border-emerald-400/20 text-white' 
                  : 'bg-rose-500/90 border-rose-400/20 text-white'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                {toast.type === 'success' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
              toast.type === 'success' 
                ? 'bg-emerald-500/90 border-emerald-400/20 text-white' 
                : 'bg-rose-500/90 border-rose-400/20 text-white'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              {toast.type === 'success' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
