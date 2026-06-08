import React, { useState, useEffect, useRef } from "react";
import { API } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc 
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { 
  Package, 
  Search, 
  LayoutDashboard, 
  ShoppingCart, 
  History, 
  Users, 
  IdCard, 
  Printer, 
  Store, 
  CreditCard, 
  Settings, 
  LogOut, 
  Menu, 
  ClipboardList, 
  Clock, 
  SmartphoneNfc, 
  Lock,
  User,
  MapPin,
  Phone,
  Facebook,
  Minus,
  Image as ImageIcon,
  Upload,
  Check,
  AlertTriangle,
  X,
  Plus,
  Filter,
  Loader2,
  Box,
  Tag,
  Briefcase,
  Save,
  GripVertical,
  CloudOff,
  Download,
  FileDown,
  Trash2
} from "lucide-react";
import { toPng } from "html-to-image";

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

export default function SOSCredit({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, isAdmin, logout } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [lessAmount, setLessAmount] = useState<string>("");
  const [toasts, setToasts] = useState<{id: string, message: string, type: "success" | "error"}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDraft, setShowDraft] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [voidRecordId, setVoidRecordId] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const deleteRecord = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteRecordId(id);
  };

  const confirmDelete = async () => {
    if (!deleteRecordId) return;
    
    const id = deleteRecordId;
    const path = `sos_credits/${id}`;
    
    // Explicit check for permission
    if (!isAdmin) {
      addToast("Error: Admin access required.", "error");
      setDeleteRecordId(null);
      return;
    }

    try {
      await deleteDoc(doc(db, "sos_credits", id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
      setDeleteRecordId(null);
      addToast("Success: Record purged from registry", "success");
    } catch (err: any) {
      console.error("SOS_CREDIT_DELETE_FAILURE:", err);
      let errorMsg = "Permission Denied: Contact system owner.";
      if (err.code === 'permission-denied') {
        errorMsg = "Database Lock: Permission Denied.";
      }
      addToast(errorMsg, "error");
      setDeleteRecordId(null);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (e) {}
    }
  };

  const voidRecord = async () => {
    if (!voidRecordId) return;
    
    const id = voidRecordId;
    
    if (!isAdmin) {
      addToast("Error: Admin access required.", "error");
      setVoidRecordId(null);
      return;
    }

    try {
      addToast("Voiding record and restoring stock...", "success");
      await API.put(`/sos_credits/${id}/void`, {});
      
      if (selectedRecord?.id === id) {
        setSelectedRecord((prev: any) => ({ ...prev, status: 'voided' }));
      }
      
      setVoidRecordId(null);
      addToast("Record voided successfully", "success");
    } catch (err: any) {
      console.error("SOS_CREDIT_VOID_FAILURE:", err);
      addToast("Failed to void record. System error.", "error");
      setVoidRecordId(null);
    }
  };

  const [paymentAmount, setPaymentAmount] = useState<string>("");

  const updatePaymentStatus = async (id: string, newStatus: string, amount: number = 0) => {
    try {
      addToast(`Updating records...`, "success");
      await API.put(`/sos_credits/${id}`, { 
        paymentStatus: newStatus,
        amountPaid: amount,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      // If completed, add to transactions for audit visibility
      if (newStatus === 'completed') {
        const record = allRecords.find(r => r.id === id) || (selectedRecord?.id === id ? selectedRecord : null);
        if (record) {
          try {
            await API.post("/transactions", {
              id: `SETTLE-${record.id}`, // Constant ID to prevent duplicate transactions
              transactionNumber: `SETTLE-${record.id}`,
              total: record.total,
              paymentMethod: "SOS_SETTLEMENT",
              items: record.items.map((item: any) => ({
                name: item.name,
                qty: item.quantity || item.qty,
                price: item.price,
                cost: item.cost || 0
                // No productId here to avoid double deduction of stock (already deducted during SOS creation)
              })),
              cashier: { name: user?.name || "Admin" },
              customer: {
                name: record.fullName,
                address: record.address,
                contact: record.contactNumber
              },
              status: 'completed',
              created_at: new Date().toISOString()
            });
            addToast("Transaction record synchronized", "success");
          } catch (tErr) {
            console.error("SOS_SETTLE_TXN_FAILURE:", tErr);
            addToast("Registry updated but transaction log failed", "error");
          }
        }
      }

      addToast("Registry updated successfully", "success");
      if (selectedRecord && selectedRecord.id === id) {
        setSelectedRecord((prev: any) => ({ ...prev, paymentStatus: newStatus, amountPaid: amount }));
      }
    } catch (err: any) {
      console.error("SOS_CREDIT_UPDATE_PAYMENT_FAILURE:", err);
      addToast("Failed to update payment records", "error");
    }
  };

  const handleSavePayment = () => {
    if (!selectedRecord) return;
    const amount = parseFloat(paymentAmount) || 0;
    const isFullyPaid = amount >= selectedRecord.total;
    updatePaymentStatus(selectedRecord.id, isFullyPaid ? 'completed' : 'pending', amount);
  };

  const printRecord = () => {
    if (!selectedRecord) return;
    
    // Transform SOS record to generic receipt format
    const txn = {
      title: "SOS CREDIT RECEIPT",
      transactionNumber: selectedRecord.id,
      createdAt: selectedRecord.timestamp,
      customer: {
        name: selectedRecord.fullName,
        address: selectedRecord.address,
        contact: selectedRecord.contactNumber
      },
      cashier: { name: user?.name || "Admin" },
      paymentMethod: selectedRecord.paymentStatus === 'completed' ? "SOS CREDIT (PAID)" : "SOS CREDIT (PENDING)",
      items: selectedRecord.items.map((item: any) => ({
        id: item.id || Math.random().toString(36).substr(2, 9),
        name: item.name,
        qty: item.quantity,
        price: item.price
      })),
      total: selectedRecord.total
    };

    console.log("SOSCredit: Dispatching swiftpos-print", txn);
    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current || !selectedRecord) return;
    try {
      addToast("Rendering Receipt for Download...", "success");
      // Use toPng with options to ensure visibility of the hidden capture ref
      const dataUrl = await toPng(receiptRef.current, { 
        backgroundColor: "#ffffff",
        style: {
          opacity: "1",
          visibility: "visible",
          display: "block"
        }
      });
      const link = document.createElement('a');
      link.download = `SOS-RECEIPT-${selectedRecord.id}.png`;
      link.href = dataUrl;
      link.click();
      addToast("Receipt Image Downloaded");
    } catch (err) {
      console.error("Download Error:", err);
      addToast("Failed to generate download. Ensure browser allows downloads.", "error");
    }
  };

  const [formData, setFormData] = useState({
    fullName: "",
    address: "",
    contactNumber: "",
    facebook: "",
    sketchImage: null as string | null,
    coMakerName: "",
    coMakerAddress: "",
    coMakerContact: "",
    coMakerFacebook: ""
  });

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      addToast("Item out of stock", "error");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    addToast(`${product.name} added to draft`);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const discount = parseFloat(lessAmount) || 0;
    return Math.max(0, subtotal - discount);
  };

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

  const saveCreditRecord = async () => {
    if (!formData.fullName || cart.length === 0) {
      addToast("Full Name and Products are required", "error");
      return;
    }

    const uniqueId = `SOS-CRT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newRecord = {
      id: uniqueId,
      ...formData,
      items: cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        cost: item.product.cost,
        quantity: item.quantity
      })),
      discount: parseFloat(lessAmount) || 0,
      total: calculateTotal(),
      status: 'active',
      paymentStatus: 'pending',
      timestamp: new Date().toISOString()
    };

    const path = "/sos_credits";
    try {
      await API.post(path, newRecord);
      
      // Reset after save
      setCart([]);
      setLessAmount("");
      setFormData({
        fullName: "", address: "", contactNumber: "", facebook: "", sketchImage: null,
        coMakerName: "", coMakerAddress: "", coMakerContact: "", coMakerFacebook: ""
      });
      addToast("Credit Record Saved Successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      addToast("Failed to save record", "error");
    }
  };

  useEffect(() => {
    const pendingData = localStorage.getItem('sos_pending_cart');
    if (pendingData) {
      try {
        const items = JSON.parse(pendingData);
        if (Array.isArray(items) && items.length > 0) {
          const sosItems = items.map((i: any) => ({
            product: {
              id: i.id,
              name: i.name,
              price: i.price,
              cost: i.cost || 0,
              stock: i.stock || 0,
              category: i.category || "General",
              sku: i.sku || ""
            },
            quantity: i.qty
          }));
          setCart(sosItems);
          setShowDraft(true);
          setShowHistory(false);
          addToast("Cart imported from Cashier", "success");
        }
        localStorage.removeItem('sos_pending_cart');
      } catch (e) {
        console.error("Failed to parse pending SOS cart", e);
      }
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, bizRes] = await Promise.all([
        API.get("/products"),
        API.get("/settings/business")
      ]);
      setProducts(prodRes.data || []);
      setBusinessInfo(bizRes.data);
    } catch (err) {
      console.error("Fetch Products/Biz Error:", err);
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

    // Set up real-time listener for SOS records
    const qRecords = query(collection(db, "sos_credits"), orderBy("timestamp", "desc"));
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setAllRecords(records);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "sos_credits");
    });

    // Set up real-time listener for Products to keep inventory table in sync
    const qProducts = query(collection(db, "products"));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const prodList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Product[];
      setProducts(prodList);
    }, (err) => {
      console.error("Products snapshot error:", err);
    });

    return () => {
      unsubscribeRecords();
      unsubscribeProducts();
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, sketchImage: reader.result as string }));
        addToast("Sketch uploaded successfully");
      };
      reader.readAsDataURL(file);
    }
  };

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);

  const filteredProducts = products.filter(p => 
    (p.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-500 font-sans overflow-hidden">
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
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">SOS<span className="text-indigo-600">CREDIT</span></span>
          </div>
          <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400" onClick={() => setSidebarOpen(false)}>
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

        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 md:p-6 md:px-10 dark:bg-[#111218]/80 dark:border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight dark:text-white leading-none">SOS CREDIT APPLICATION</h1>
                <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 md:mt-2">Credit Registry & Inventory Audit</p>
              </div>
            </div>
            
            <div className="flex w-full md:w-auto bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/5">
              <button 
                onClick={() => setShowHistory(false)}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showHistory ? 'bg-white dark:bg-[#1a1b23] text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Application
              </button>
              <button 
                onClick={() => setShowHistory(true)}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showHistory ? 'bg-white dark:bg-[#1a1b23] text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Registry History
              </button>
            </div>
          </div>
        </header>

        <div ref={constraintsRef} className="flex-1 p-4 lg:p-10 max-w-[1600px] mx-auto w-full overflow-y-auto space-y-8 scrollbar-hide relative">
          {!showHistory ? (
            <div className="space-y-10">
              {/* Floating Draggable Application Form */}
              <AnimatePresence>
                {showDraft && (
                  <motion.div 
                    drag 
                    dragControls={dragControls}
                    dragListener={false}
                    dragConstraints={constraintsRef}
                    dragElastic={0.05}
                    dragMomentum={false}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-40 w-full max-w-5xl mx-auto touch-none"
                  >
                    <div className="bg-white dark:bg-[#15161d] border border-indigo-500/20 rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-full max-h-[90vh] md:max-h-[85vh]">
                      
                      {/* Drag Handle */}
                      <div 
                        onPointerDown={(e) => dragControls.start(e)}
                        className="absolute left-1/2 -translate-x-1/2 top-2 p-2 md:p-3 cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-white/5 rounded-full z-10 transition-colors"
                      >
                        <div className="w-12 md:w-16 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full" />
                      </div>

                      {/* Left: Input Areas */}
                      <div className="flex-1 overflow-y-auto p-5 md:p-8 border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 space-y-6 md:space-y-8 scrollbar-hide">
                        <div className="flex items-center justify-between pointer-events-none mt-2 md:mt-0">
                          <div className="flex items-center gap-3 md:gap-4">
                            <div className="p-2 md:p-3 bg-indigo-600 rounded-xl md:rounded-2xl text-white">
                              <ClipboardList className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">New Credit Entry</h3>
                              <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Registry Form</p>
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Draggable Active</span>
                          </div>
                        </div>

                        <div className="space-y-8 md:space-y-10">
                          {/* Personal Info Section */}
                          <section className="space-y-4 md:space-y-6">
                            <div className="flex items-center gap-3">
                              <User className="w-4 h-4 text-indigo-500" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Client Data</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <input 
                                  value={formData.fullName}
                                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                  placeholder="CLIENT FULL NAME"
                                />
                              </div>
                              <input 
                                value={formData.contactNumber}
                                onChange={e => setFormData({...formData, contactNumber: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                placeholder="CONTACT NUMBER"
                              />
                            </div>
                            <input 
                              value={formData.address}
                              onChange={e => setFormData({...formData, address: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                              placeholder="COMPLETE HOME ADDRESS"
                            />
                            <div className="flex flex-col sm:flex-row gap-4">
                              <input 
                                value={formData.facebook}
                                onChange={e => setFormData({...formData, facebook: e.target.value})}
                                className="flex-1 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                placeholder="FACEBOOK URL / USERNAME"
                              />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-xl md:rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
                              >
                                <ImageIcon className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Sketch Image</span>
                              </button>
                            </div>
                          </section>

                          {/* Co-Maker Section */}
                          <section className="space-y-4 md:space-y-6 pt-6 border-t border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                              <Users className="w-4 h-4 text-amber-500" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Co-Maker Authenticity</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input 
                                value={formData.coMakerName}
                                onChange={e => setFormData({...formData, coMakerName: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                placeholder="CO-MAKER FULL NAME"
                              />
                              <input 
                                value={formData.coMakerContact}
                                onChange={e => setFormData({...formData, coMakerContact: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                placeholder="CO-MAKER CONTACT"
                              />
                            </div>
                            <input 
                              value={formData.coMakerAddress}
                              onChange={e => setFormData({...formData, coMakerAddress: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                              placeholder="GUARANTOR RESIDENCE ADDRESS"
                            />
                          </section>
                        </div>
                      </div>

                      {/* Right: Cart/Cashier Section */}
                      <div className="w-full md:w-[320px] lg:w-[380px] bg-slate-50 dark:bg-black/30 p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-6 md:mb-8">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Output Registry</h4>
                          <button onClick={() => setShowDraft(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all">
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 scrollbar-hide space-y-3 mb-6 md:mb-8 max-h-[300px] md:max-h-none">
                          {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 grayscale scale-75">
                              <Box className="w-12 h-12 text-slate-300 dark:text-white/20 mb-4" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Empty</p>
                            </div>
                          ) : (
                            cart.map(item => (
                              <motion.div 
                                layout
                                key={item.product.id}
                                className="p-4 bg-white dark:bg-[#1a1b23] rounded-2xl border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm"
                              >
                                <div className="overflow-hidden">
                                  <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate">{item.product.name}</p>
                                  <p className="text-[9px] font-bold text-indigo-500">{formatCurrency(item.product.price)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 text-slate-500">-</button>
                                  <span className="text-[10px] font-bold w-4 text-center">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 text-slate-500">+</button>
                                  <button onClick={() => removeFromCart(item.product.id)} className="ml-2 text-rose-500"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>

                        <div className="pt-6 border-t border-slate-200 dark:border-white/10 space-y-6">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SUBTOTAL</span>
                            <span className="text-sm font-black text-slate-600 dark:text-slate-400">{formatCurrency(cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0))}</span>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[8px] font-black text-rose-400 uppercase tracking-widest">Less Amount</label>
                            <div className="relative group">
                              <Minus className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-focus-within:text-rose-400 transition-colors" />
                              <input 
                                type="number"
                                placeholder="0.00"
                                value={lessAmount}
                                onChange={(e) => setLessAmount(e.target.value)}
                                className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl py-1.5 pl-8 pr-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500/50 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total AMOUNT</span>
                            <span className="text-2xl font-black text-indigo-600 tracking-tighter">{formatCurrency(calculateTotal())}</span>
                          </div>
                          <button 
                            onClick={saveCreditRecord}
                            disabled={cart.length === 0}
                            className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3"
                          >
                            <Save className="w-4 h-4" /> Save Record
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showDraft && (
                <div className="flex flex-col items-center justify-center py-40 bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[3rem] shadow-xl text-center">
                  <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-6">
                    <Plus className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ready for Credit Entry</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 max-w-sm">
                    Select items from the Cashier tab and click "SOS Credit Registry" to populate this station.
                  </p>
                  <button 
                    onClick={() => setShowDraft(true)}
                    className="mt-8 px-10 py-5 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all"
                  >
                    Open Registry Form
                  </button>
                </div>
              )}
            </div>
          ) : (
        /* Records History Section */
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
            <div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Registry History</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Real-time Audit trail of all credit releases
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
              {[
                { label: "Active Registry", value: allRecords.filter(r => r.status !== 'voided').length, suffix: "RCDS", color: "indigo" },
                { label: "Total Receivables", value: formatCurrency(allRecords.filter(r => r.status !== 'voided' && r.paymentStatus !== 'completed').reduce((sum, r) => sum + (r.total || 0), 0)), color: "rose" },
                { label: "Total Collected", value: formatCurrency(allRecords.filter(r => r.status !== 'voided' && r.paymentStatus === 'completed').reduce((sum, r) => sum + (r.total || 0), 0)), color: "emerald" },
                { label: "Liquidation Rate", value: `${allRecords.length ? Math.round((allRecords.filter(r => r.paymentStatus === 'completed').length / allRecords.length) * 100) : 0}%`, color: "amber" }
              ].sort((a, b) => a.label.localeCompare(b.label)).map((stat, idx) => (
                <div key={idx} className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 p-4 rounded-2xl shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className={`text-sm font-black text-${stat.color}-600 leading-none truncate`}>
                    {stat.value} <span className="text-[8px] opacity-50 ml-0.5">{stat.suffix}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {allRecords.length === 0 ? (
            <div className="py-40 text-center bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[3rem] shadow-xl">
              <Box className="w-16 h-16 text-slate-100 dark:text-white/5 mx-auto mb-6" />
              <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Database Empty</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">No SOS Credit applications found in registry</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {[...allRecords].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")).map((record, i) => (
                <motion.div 
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedRecord(record)}
                  className="group bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-7 shadow-xl relative overflow-hidden cursor-pointer hover:border-indigo-500/30 transition-all active:scale-[0.98]"
                >
                  <div className="flex flex-col h-full gap-6">
                    {/* Card Top: ID and Status */}
                    <div className="flex items-center justify-between">
                      <div className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded-lg border border-slate-200 dark:border-white/5">
                        {record.id}
                      </div>
                      <div className="flex gap-2">
                        {record.status === 'voided' && (
                          <div className="px-3 py-1.5 bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-rose-500/20">
                            Voided
                          </div>
                        )}
                        <div className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                          record.paymentStatus === 'completed' 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        }`}>
                          {record.paymentStatus || 'pending'}
                        </div>
                      </div>
                    </div>
                    
                    {/* User Profile Info */}
                    <div className="flex items-center gap-4 pb-2 border-b border-slate-100 dark:border-white/5">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                        {record.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none truncate group-hover:text-indigo-600 transition-colors">
                          {record.fullName}
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          {new Date(record.timestamp).toLocaleDateString()} · {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grant Total</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{formatCurrency(record.total)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(record);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-indigo-600/20 transition-all"
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-80">Action</span>
                        <span className="text-[10px] font-black uppercase">Review Entry</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Box className="w-3 h-3" /> Itemized Release
                        </p>
                        <div className="max-h-[100px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                          {record.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">
                              <span className="truncate max-w-[120px]">{item.name}</span>
                              <span>{item.quantity}x</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-slate-400 w-full mb-1">
                          <MapPin className="w-3 h-3 text-indigo-500/60" />
                          <p className="text-[8px] font-bold uppercase truncate">{record.address || "NO ADDRESS"}</p>
                        </div>
                        <button 
                          className="px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVoidRecordId(record.id);
                          }}
                        >
                           Void
                        </button>
                        <button 
                          className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteRecordId(record.id);
                          }}
                        >
                           Purge
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Record Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-[#15161d] rounded-[2rem] md:rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col lg:flex-row max-h-[95vh] md:max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedRecord(null)}
                className="absolute top-4 right-4 md:top-8 md:right-8 z-50 p-2 md:p-3 bg-white/50 dark:bg-black/50 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl md:rounded-2xl transition-all"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
              </button>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 md:space-y-12 scrollbar-hide border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-white/5">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6 text-center sm:text-left mt-4 sm:mt-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-2xl md:text-3xl font-black shadow-2xl shadow-indigo-600/30 shrink-0">
                    {selectedRecord.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 md:gap-3 mb-2">
                       <span className="px-3 py-1 bg-indigo-600 text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-lg">{selectedRecord.id}</span>
                       <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(selectedRecord.timestamp).toLocaleDateString()} at {new Date(selectedRecord.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{selectedRecord.fullName}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                  <div className="space-y-8">
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Client Contact Profile</h4>
                      </div>
                      <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Residence</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedRecord.address}</p>
                        </div>
                        <div className="flex gap-8">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Line</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedRecord.contactNumber}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Facebook</p>
                            <p className="text-sm font-bold text-indigo-500">{selectedRecord.facebook || "Not Provided"}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-3 text-amber-500">
                        <Users className="w-4 h-4" />
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Guarantor Information</h4>
                      </div>
                      <div className="bg-amber-500/[0.03] p-6 rounded-[2rem] border border-amber-500/10 space-y-4">
                        <div>
                          <p className="text-[9px] font-black text-amber-600/50 uppercase tracking-widest mb-1">Full Name</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedRecord.coMakerName}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-amber-600/50 uppercase tracking-widest mb-1">Guarantor Residence</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedRecord.coMakerAddress}</p>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Client Location Sketch</h4>
                    </div>
                    {selectedRecord.sketchImage ? (
                      <div className="bg-slate-50 dark:bg-black/20 rounded-[2.5rem] border border-slate-100 dark:border-white/5 overflow-hidden">
                        <img src={selectedRecord.sketchImage} className="w-full h-80 object-cover" alt="Location Sketch" />
                      </div>
                    ) : (
                      <div className="h-80 bg-slate-50 dark:bg-black/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center p-10">
                        <CloudOff className="w-10 h-10 text-slate-200 mb-4" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No sketch provided for this entry</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itemized Sidebar */}
              <div className="w-full lg:w-[350px] xl:w-[400px] bg-slate-50 dark:bg-black/20 p-6 md:p-10 flex flex-col">
                <div className="flex items-center gap-4 mb-6 md:mb-10">
                  <div className="p-2.5 md:p-3 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-slate-200 dark:border-white/10">
                    <Box className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Itemized Registry</h3>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 mb-8 md:mb-10 pr-1 md:pr-2 scrollbar-hide min-h-[200px] lg:min-h-0">
                  {selectedRecord.items.map((item: any, i: number) => (
                    <div key={i} className="bg-white dark:bg-[#1a1b23] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                      <div className="overflow-hidden">
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{formatCurrency(item.price)} each</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-indigo-600">x{item.quantity}</p>
                        <p className="text-[10px] font-black text-slate-400 tracking-tighter mt-1">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-slate-200 dark:border-white/10 space-y-4">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Registry Total</span>
                    <span className="text-4xl font-black text-indigo-600 tracking-tighter leading-none">{formatCurrency(selectedRecord.total)}</span>
                  </div>
                  
                  {/* Payment Details Section */}
                  <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Liquidation</p>
                      <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${selectedRecord.paymentStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {selectedRecord.paymentStatus || 'pending'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₱</span>
                        <input 
                          type="number"
                          placeholder="Enter amount paid"
                          className="w-full pl-8 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          defaultValue={selectedRecord.amountPaid || ""}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance</p>
                          <p className="text-xs font-black text-rose-500">
                            {formatCurrency(Math.max(0, selectedRecord.total - (selectedRecord.amountPaid || 0)))}
                          </p>
                        </div>
                        <button 
                          onClick={handleSavePayment}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                        >
                          Save Payment
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={printRecord}
                        className="py-5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all hover:bg-indigo-500 shadow-xl shadow-indigo-600/20"
                      >
                        <Printer className="w-4 h-4" /> Print
                      </button>
                      <button 
                        onClick={downloadReceipt}
                        className="py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-opacity hover:opacity-90"
                      >
                        <FileDown className="w-4 h-4" /> Download
                      </button>
                    </div>

                    {selectedRecord.status !== 'voided' && (
                      <button 
                        onClick={() => setVoidRecordId(selectedRecord.id)}
                        className="w-full py-5 rounded-2xl bg-amber-500 text-white hover:bg-amber-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-500/20 active:scale-[0.98]"
                      >
                        <Lock className="w-3.5 h-3.5" /> Void Transaction
                      </button>
                    )}
                    <button 
                      onClick={(e) => setDeleteRecordId(selectedRecord.id)}
                      className="w-full py-5 rounded-2xl bg-rose-500 text-white hover:bg-rose-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-rose-500/20 active:scale-[0.98]"
                    >
                      Delete Application Record
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteRecordId && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteRecordId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#15161d] rounded-[2.5rem] p-8 shadow-2xl border border-rose-500/20 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <AlertTriangle className="w-24 h-24 text-rose-500" />
              </div>
              
              <div className="relative space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6">
                  <Trash2 className="w-8 h-8 text-rose-500" />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Confirm Purge</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2 leading-relaxed">
                    You are about to PERMANENTLY BURN this record from the registry database. 
                    <span className="text-rose-500 block mt-1">This action is irreversible.</span>
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setDeleteRecordId(null)}
                    className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-[1.5] py-4 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-2 font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Purge Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Void Confirmation Modal */}
      <AnimatePresence>
        {voidRecordId && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVoidRecordId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#15161d] rounded-[2.5rem] p-8 shadow-2xl border border-amber-500/20 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Lock className="w-24 h-24 text-amber-500" />
              </div>
              
              <div className="relative space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                  <Lock className="w-8 h-8 text-amber-500" />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Confirm Void</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2 leading-relaxed">
                    You are about to VOID this transaction.
                    <span className="text-amber-600 block mt-1 font-black">Products will be automatically returned to inventory stocks.</span>
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setVoidRecordId(null)}
                    className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={voidRecord}
                    className="flex-[1.5] py-4 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95 flex items-center justify-center gap-2 font-bold"
                  >
                    <Lock className="w-3.5 h-3.5" /> Void Record
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Printable Receipt Component for Download Capture */}
      <div className="fixed -left-[2000px] top-0 opacity-0 pointer-events-none z-[-1]">
        {selectedRecord && (
          <div 
            ref={receiptRef}
            className="w-[800px] bg-white p-12 text-slate-900 flex flex-col"
            style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
          >
            {/* Header Mirroring Receipt.tsx */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-8 mb-8">
              <div className="flex flex-col">
                <h1 className="text-4xl font-black tracking-tighter uppercase mb-1">
                  {selectedRecord.status === 'voided' ? 'VOIDED RECORD' : 'SOS CREDIT RECEIPT'}
                </h1>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Official Registry Registry Audit</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ref ID</p>
                <p className="text-xl font-black text-slate-900">{selectedRecord.id}</p>
              </div>
            </div>
            
            {selectedRecord.status === 'voided' && (
              <div className="absolute top-[20%] left-[10%] rotate-[-25deg] pointer-events-none opacity-[0.15]">
                <p className="text-[150px] font-black border-[10px] border-rose-500 text-rose-500 px-12 leading-none">VOID</p>
              </div>
            )}

            {/* Business/Client Info */}
            <div className="flex justify-between gap-12 mb-12">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Store Info</p>
                <h2 className="text-xl font-black text-slate-900 uppercase">{businessInfo?.name || "CBK APPARAL"}</h2>
                <p className="text-xs font-bold text-slate-500 uppercase max-w-[250px]">{businessInfo?.address || "Davao de Oro, Philippines"}</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Billed To</p>
                <h2 className="text-xl font-black text-slate-900 uppercase">{selectedRecord.fullName}</h2>
                <p className="text-xs font-bold text-slate-500 uppercase">{selectedRecord.address}</p>
                <p className="text-xs font-bold text-slate-500 uppercase">{selectedRecord.contactNumber}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden mb-12">
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr] bg-slate-50 border-b border-slate-200 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Sum</span>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedRecord?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[3fr_1fr_1fr_1fr] px-6 py-4 items-center">
                    <span className="text-sm font-black text-slate-900 uppercase">{item.name}</span>
                    <span className="text-center text-sm font-bold text-slate-500">{item.quantity}</span>
                    <span className="text-right text-sm font-bold text-slate-500">{formatCurrency(item.price)}</span>
                    <span className="text-right text-sm font-black text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-end">
              <div className="space-y-4">
                <div className="flex gap-8">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date Issued</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(selectedRecord.timestamp).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">SOS CREDIT</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className={`text-sm font-black uppercase ${selectedRecord.paymentStatus === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {selectedRecord.paymentStatus || 'pending'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(selectedRecord.amountPaid || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-sm font-black text-rose-500">{formatCurrency(Math.max(0, selectedRecord.total - (selectedRecord.amountPaid || 0)))}</p>
                  </div>
                </div>
                <div className="w-48 h-[1px] bg-slate-200" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Receivable</p>
                <p className="text-5xl font-black text-indigo-600 tracking-tighter">{formatCurrency(selectedRecord.total)}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-16 text-center border-t-2 border-slate-100 pt-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Registry Receipt - Non-Taxable Archive</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>
  );
}
