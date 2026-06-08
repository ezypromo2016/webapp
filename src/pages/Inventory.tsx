import React, { useState, useEffect } from "react";
import { API } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { db } from "../lib/db";
import { motion, AnimatePresence } from "motion/react";
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  AlertTriangle, 
  ArrowLeft,
  Filter,
  Download,
  Upload,
  Loader2,
  X,
  Check,
  Trash2,
  Box,
  Tag,
  Zap,
  FileSpreadsheet,
  LayoutDashboard,
  ShoppingCart,
  History,
  Users,
  IdCard,
  Printer,
  Store,
  Briefcase,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  ClipboardList,
  Clock,
  SmartphoneNfc,
  Lock,
  CloudOff
} from "lucide-react";
import * as XLSX from "xlsx";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  sku: string;
}

export default function Inventory({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, isAdmin, logout } = useAuth();
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "alerts">("all");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string, type: "product" | "category"} | null>(null);
  
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    category: "",
    price: "",
    cost: "",
    stock: ""
  });

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, pendingProds] = await Promise.all([
        API.get("/products").catch(() => ({ data: [] })),
        API.get("/categories").catch(() => ({ data: [] })),
        db.pendingTransactions.where('path').equals('/products').toArray()
      ]);
      
      const serverProducts = prodRes.data || [];
      const pendingProducts = pendingProds.map(p => p.data);
      
      const combined = [...pendingProducts, ...serverProducts].reduce((acc: any[], curr) => {
        const id = curr.id;
        if (!acc.some(p => p.id === id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setProducts(combined);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error("Fetch Data Error:", err);
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

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ 
      name: "", 
      description: "",
      sku: "", 
      category: categories[0] || "", 
      price: "", 
      cost: "",
      stock: "" 
    });
    setShowModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      description: product.description || "",
      sku: product.sku,
      category: product.category,
      price: product.price.toString(),
      cost: (product.cost || 0).toString(),
      stock: product.stock.toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleteConfirm({ id, name, type: "product" });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, name, type } = deleteConfirm;
    
    try {
      if (type === "product") {
        await API.delete(`/products/${id}`);
        setProducts(prev => prev.filter(p => p.id !== id));
        addToast(`Deleted ${name}`);
      } else {
        await API.delete(`/categories/${name}`);
        setCategories(prev => prev.filter(c => c !== name));
        if (formData.category === name) setFormData(prev => ({ ...prev, category: "" }));
        addToast("Category removed");
      }
    } catch (err) {
      console.error("Delete Error:", err);
      addToast(`Failed to delete ${type}`, "error");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      addToast("Category is required", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        stock: parseInt(formData.stock) || 0
      };

      if (editingId) {
        await API.put(`/products/${editingId}`, payload);
        addToast("Record updated");
      } else {
        await API.post("/products", payload);
        addToast("Products created");
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Submit Error:", err);
      addToast("Sync failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    
    try {
      const res = await API.post("/categories", { name });
      setCategories(res.data);
      setNewCatName("");
      setFormData(prev => ({ ...prev, category: name }));
      addToast(`Category "${name}" added`);
    } catch (err) {
      addToast("Add category failed", "error");
    }
  };

  const handleDeleteCategory = async (name: string) => {
    setDeleteConfirm({ id: name, name, type: "category" });
  };

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = (p.name || "").toLowerCase().includes(search.toLowerCase()) || 
        (p.description || "").toLowerCase().includes(search.toLowerCase()) || 
        (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(search.toLowerCase());
      
      if (filterType === "alerts") {
        return matchesSearch && p.stock <= 5;
      }
      
      return matchesSearch;
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(products.map(p => ({
      ID: p.id,
      Name: p.name,
      Description: p.description || "",
      SKU: p.sku,
      Category: p.category,
      Cost: p.cost,
      Price: p.price,
      Stock: p.stock
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast("Inventory exported successfully");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        setLoading(true);
        let importedCount = 0;
        
        for (const row of data) {
          const name = row.Name || row.name || row.Product || row.product;
          const description = row.Description || row.description || "";
          const sku = row.SKU || row.sku || row.Code || row.code || "";
          const price = parseFloat(row.Price || row.price || 0);
          const cost = parseFloat(row.Cost || row.cost || 0);
          const stock = parseInt(row.Stock || row.stock || row.Qty || row.qty || 0);
          const category = row.Category || row.category || categories[0] || "General";

          if (name) {
            await API.post("/products", { name, description, sku, price, cost, stock, category });
            importedCount++;
          }
        }

        addToast(`Successfully imported ${importedCount} products`);
        fetchData();
      } catch (err) {
        console.error("Import Error:", err);
        addToast("Import failed - invalid file format", "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-500 font-sans overflow-hidden">
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
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">MARIZ<span className="text-indigo-600">POS</span></span>
          </div>
          <button 
            className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto mt-4 px-2 scrollbar-hide">
          <div className="space-y-1 mb-8 pr-2">
            <label className="px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block text-center">Navigation</label>
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
                      if (window.innerWidth < 1024) setSidebarOpen(false);
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
                      layoutId="active-indicator-inventory"
                      className="absolute left-0 w-1 h-6 bg-indigo-600 rounded-r-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-slate-50 dark:bg-white/5 rounded-3xl p-4 border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-600/20">
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
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
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight dark:text-white">Delete item</h3>
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200 dark:bg-black/20 dark:border-white/5">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">Target Item</p>
                  <p className="text-sm font-black text-slate-900 truncate dark:text-white">{deleteConfirm.name}</p>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-6 px-1">
                  This procedure is <span className="text-rose-400 font-bold">permanent</span>. The record will be remove from the central database immediately.
                </p>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all active:scale-95 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    back
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-900/20 transition-all active:scale-95"
                  >
                    delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 md:p-6 md:px-10 dark:bg-[#111218]/80 dark:border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button 
              onClick={() => navigate("dashboard")}
              className="hidden lg:flex p-2 md:p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-500 transition-all active:scale-95 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight dark:text-white leading-none">Inventory</h1>
              <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 md:mt-2">Active Inventory</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button 
                onClick={() => setShowCatModal(true)}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl md:rounded-2xl transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-400 dark:border-white/10"
              >
                <Tag className="w-4 h-4" /> 
                <span className="hidden sm:inline">Categories</span>
              </button>
              <div className="relative group/import flex-1 lg:flex-none">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleImportExcel}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <button className="w-full flex items-center justify-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl md:rounded-2xl transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-600 dark:bg-white/5 dark:text-slate-400 dark:border-white/10">
                  <Upload className="w-4 h-4" /> 
                  <span className="hidden sm:inline">Import</span>
                </button>
              </div>
              <button 
                onClick={exportToExcel}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl md:rounded-2xl transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-600 dark:bg-white/5 dark:text-slate-400 dark:border-white/10"
              >
                <Download className="w-4 h-4" /> 
                <span className="hidden sm:inline">Export</span>
              </button>
            <button 
              onClick={handleOpenAdd}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20 transition-all font-black text-xs uppercase tracking-widest active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> New Products
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full overflow-y-auto">
        {/* Analytics Mini Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-16">
          {[
            { id: 'all', label: 'Total Assets', value: products.length, icon: Box, color: 'text-indigo-500', accent: 'bg-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', shadow: 'shadow-indigo-500/10', isCount: true },
            { id: 'value', label: 'Inventory Value', value: products.reduce((a, b) => a + (b.price * b.stock), 0), icon: Zap, color: 'text-emerald-500', accent: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', shadow: 'shadow-emerald-500/10' },
            { id: 'alerts', label: 'Stock Alerts', value: products.filter(p => p.stock <= 5).length, icon: AlertTriangle, color: 'text-rose-500', accent: 'bg-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', shadow: 'shadow-rose-500/10', isCount: true },
          ].map((stat, i) => {
            const isActive = filterType === stat.id;
            return (
              <motion.button 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ delay: i * 0.1, type: "spring", damping: 20 }}
                key={stat.label} 
                onClick={() => {
                  if (stat.id === 'alerts' || stat.id === 'all') {
                    setFilterType(stat.id as any);
                  }
                }}
                className={`group relative overflow-hidden bg-white/70 dark:bg-[#15161d]/80 backdrop-blur-xl border ${isActive ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-50 dark:ring-offset-[#0a0a0f]' : stat.border} p-8 rounded-[2.5rem] shadow-xl ${stat.shadow} text-center flex flex-col items-center justify-center transition-all duration-500 hover:shadow-2xl hover:bg-white dark:hover:bg-[#15161d] w-full`}
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 inset-x-0 h-1 ${stat.accent} opacity-40 group-hover:opacity-100 transition-opacity`} />
                <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full ${stat.bg} blur-3xl opacity-20 group-hover:opacity-60 transition-opacity`} />
                
                <div className={`${stat.bg} ${stat.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner relative`}>
                  <stat.icon className="w-8 h-8" />
                  <div className={`absolute inset-0 rounded-2xl ${stat.accent} opacity-0 group-hover:opacity-10 animate-pulse`} />
                </div>
                
                <div className="space-y-1 relative z-10">
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-2 leading-none">{stat.label}</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight font-sans">
                    {stat.isCount ? stat.value : formatCurrency(stat.value)}
                  </h3>
                  <div className={`flex items-center justify-center gap-2 mt-4 p-1.5 px-3 rounded-full ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : stat.accent} animate-pulse`} />
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isActive ? 'Active filter' : 'Inventory Status'}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Instant Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              className="w-full bg-white border border-slate-200 rounded-[1.2rem] md:rounded-[1.5rem] py-3.5 md:py-5 pl-12 md:pl-14 pr-6 md:pr-8 text-xs md:text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-900 placeholder:text-slate-400 shadow-sm dark:bg-[#15161d] dark:border-white/5 dark:text-white uppercase"
            />
          </div>
          <button className="flex items-center justify-center gap-3 px-6 md:px-8 py-3.5 md:py-5 bg-white border border-slate-200 rounded-[1.2rem] md:rounded-[1.5rem] text-slate-500 hover:text-slate-900 hover:border-indigo-500/30 transition-all shadow-sm active:scale-95 dark:bg-[#15161d] dark:border-white/5 dark:text-slate-400">
            <Filter className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-black uppercase tracking-widest">Filters</span>
          </button>
        </div>

        {/* Filter Indicator Banner */}
        <AnimatePresence>
          {filterType === 'alerts' && (
            <motion.div 
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-8 flex flex-col sm:flex-row items-center justify-between p-4 md:p-6 bg-rose-500/5 border border-rose-500/20 rounded-[2rem] px-8 md:px-12 backdrop-blur-sm gap-4"
            >
              <div className="flex items-center gap-4 md:gap-6">
                <div className="p-3 bg-rose-500 rounded-2xl text-white shadow-lg shadow-rose-500/30">
                  <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter">Inventory under Alert</p>
                  <p className="text-[10px] text-rose-500/60 font-bold uppercase tracking-widest mt-1">Showing products with low or zero stock levels</p>
                </div>
              </div>
              <button 
                onClick={() => setFilterType('all')}
                className="w-full sm:w-auto px-8 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-rose-900/20 border border-rose-400/20"
              >
                Clear Filter
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table/List */}
        <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-xl dark:bg-[#15161d] dark:border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] border-b border-slate-100 dark:bg-[#1c1d26] dark:border-white/5">
                  <th className="px-10 py-6 min-w-[250px]">Product Details</th>
                  <th className="px-10 py-6 hidden xl:table-cell">Description</th>
                  <th className="px-10 py-6 hidden md:table-cell">Code</th>
                  <th className="px-10 py-6 hidden lg:table-cell">Asset Category</th>
                  <th className="px-10 py-6 text-center whitespace-nowrap">Inventory</th>
                  <th className="px-10 py-6">Cost</th>
                  <th className="px-10 py-6">SRP</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product, i) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                      transition={{ delay: i * 0.03 }}
                      key={product.id}
                      className={`hover:bg-white/[0.02] transition-colors group ${product.stock <= 5 ? 'bg-rose-500/[0.03] dark:bg-rose-500/[0.02]' : ''}`}
                    >
                    <td className="px-6 md:px-10 py-6 min-w-[250px]">
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-2xl border flex items-center justify-center transition-all duration-300 flex-shrink-0
                          ${product.stock <= 5 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 rotate-3' 
                            : 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-100 dark:border-white/5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 group-hover:rotate-3'}
                        `}>
                          {product.stock <= 5 ? <AlertTriangle className="w-5 h-5 md:w-7 md:h-7" /> : <Package className="w-5 h-5 md:w-7 md:h-7" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 dark:text-white text-sm md:text-base leading-tight truncate">{product.name}</p>
                            {product.stock <= 5 && (
                              <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0" title="Urgent: Low Stock" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase hidden sm:block">ID: {product.id}</p>
                            {(product as any).queued && (
                              <span className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded text-[7px] font-black border border-amber-500/20 uppercase tracking-tighter">
                                Offline
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black uppercase mt-1 md:hidden tracking-wider">{product.sku} • {product.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 hidden xl:table-cell max-w-[450px]">
                      <div className="max-h-[60px] overflow-y-auto scrollbar-hide text-[11px] font-medium text-slate-500 leading-relaxed break-words pr-2">
                        {product.description || <span className="opacity-30 italic">No description</span>}
                      </div>
                    </td>
                    <td className="px-10 py-6 hidden md:table-cell">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 font-bold dark:bg-white/5 dark:text-slate-400 dark:border-white/5">{product.sku}</span>
                    </td>
                    <td className="px-10 py-6 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black text-indigo-400 bg-indigo-400/5 border border-indigo-400/10 uppercase tracking-widest">
                        <Tag className="w-3 h-3" />
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 md:px-10 py-6 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className={`px-3 md:px-4 py-1 md:py-1.5 rounded-xl md:rounded-2xl font-black text-xs md:text-sm border ${
                          product.stock === 0 ? 'bg-rose-500 text-white border-rose-500/30' :
                          product.stock <= 5 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                          product.stock < 20 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                          {product.stock}
                        </div>
                        {product.stock <= 5 && product.stock > 0 && (
                          <span className="text-[8px] font-black uppercase text-rose-500 mt-2 tracking-tighter animate-pulse hidden md:block">Low Supply</span>
                        )}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <p className="font-bold text-slate-500 text-xs md:text-sm">₱{product.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-10 py-6">
                      <p className="font-black text-slate-900 dark:text-white text-sm md:text-base">₱{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-6 md:px-10 py-6">
                      <div className="flex items-center justify-end gap-2 md:gap-3">
                        <button 
                          onClick={() => handleOpenEdit(product)}
                          className="p-2 md:p-3 bg-slate-100 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-500/30 rounded-xl md:rounded-2xl transition-all dark:bg-white/5 dark:text-slate-500 dark:hover:text-emerald-400 dark:border-transparent dark:hover:border-emerald-500/30"
                          title="Edit Product"
                        >
                          <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id, product.name)}
                          className="p-2 md:p-3 bg-slate-100 hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-500/30 rounded-xl md:rounded-2xl transition-all dark:bg-white/5 dark:text-slate-500 dark:hover:text-rose-400 dark:border-transparent dark:hover:border-rose-500/30"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          {loading && (
            <div className="p-32 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-6 h-6 text-indigo-400/50" />
                </div>
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Synchronizing Inventory...</p>
            </div>
          )}
          
          {!loading && filteredProducts.length === 0 && (
            <div className="p-32 text-center">
              <div className="w-24 h-24 bg-slate-50 border border-slate-200 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 dark:bg-white/[0.02] dark:border-white/[0.05]">
                <Box className="w-10 h-10 text-slate-300 dark:text-slate-800" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 dark:text-white">Empty Catalog</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">No assets identified. Registry is currently empty or mismatching filters.</p>
              <button 
                onClick={handleOpenAdd}
                className="mt-8 px-8 py-4 bg-indigo-600 text-white hover:bg-indigo-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
              >
                Register My First Asset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden dark:bg-[#111218] dark:border-white/10"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 dark:bg-[#15161d] dark:border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                      {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                    <div>
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white">{editingId ? "Revise Asset" : "ADD PRODUCT"}</h2>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">{editingId ? "Update existing record" : "Add to catalog"}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors dark:hover:bg-white/5">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-[#0a0a0f]">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Designation</label>
                    <div className="relative">
                      <Package className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-6 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-black text-xs dark:bg-[#15161d] dark:border-white/5 dark:text-white dark:placeholder:text-slate-700"
                        placeholder="e.g. Premium Tech Case"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contextual Description</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-xs dark:bg-[#15161d] dark:border-white/5 dark:text-white dark:placeholder:text-slate-700 min-h-[100px] resize-none"
                      placeholder="Add detailed specifications or notes about this product..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Inventory SKU</label>
                    <input 
                      required
                      type="text" 
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                      className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 px-4 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-mono text-[10px] font-bold"
                      placeholder="SKU-0000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Classification</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700 z-10" />
                      <select 
                        required
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-10 pr-7 text-white font-bold text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer relative"
                      >
                        <option value="">Choose Category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Cost Price (₱)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-700">₱</span>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={formData.cost}
                        onChange={e => setFormData({...formData, cost: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-white font-black text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-right"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Selling Price (₱)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-700">₱</span>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-white font-black text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-right"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Stock</label>
                    <div className="relative">
                      <Box className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700" />
                      <input 
                        required
                        type="number" 
                        value={formData.stock}
                        onChange={e => setFormData({...formData, stock: e.target.value})}
                        className="w-full bg-[#15161d] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-white font-black text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-right"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-[#15161d] border-t border-white/5 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] transition-all text-slate-500 hover:text-white active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmitting}
                    type="submit"
                    className="flex-2 px-8 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[8px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{isSubmitting ? "Processing..." : editingId ? "Update Product" : "Create Product"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {showCatModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0f]/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden dark:bg-[#111218] dark:border-white/10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 dark:bg-[#15161d] dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white">Classifications</h2>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Asset grouping rules</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowCatModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors dark:hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white dark:bg-[#0a0a0f]">
                <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                  <input 
                    required
                    type="text" 
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold text-xs dark:bg-[#15161d] dark:border-white/5 dark:text-white dark:placeholder:text-slate-800"
                    placeholder="New category name..."
                  />
                  <button 
                    type="submit"
                    className="px-6 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                  >
                    Register
                  </button>
                </form>

                <div className="space-y-2 max-h-[240px] overflow-y-auto no-scrollbar pr-1">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 border border-slate-100 rounded-xl group hover:border-slate-200 transition-all dark:bg-[#15161d] dark:border-white/5">
                      <span className="font-bold text-slate-700 text-xs tracking-tight dark:text-white">{cat}</span>
                      <button 
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 bg-slate-200 text-slate-400 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-all dark:bg-white/5 dark:text-slate-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 dark:bg-[#15161d] dark:border-white/5">
                <button 
                  onClick={() => setShowCatModal(false)}
                  className="w-full py-3 bg-white border border-slate-200 shadow-sm rounded-xl text-[9px] font-black uppercase tracking-[0.3em] transition-all text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:border-white/5 dark:text-slate-500 dark:hover:text-white"
                >
                  Dismiss Manager
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
