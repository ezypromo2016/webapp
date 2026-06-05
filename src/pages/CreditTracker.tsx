import { useState, useEffect, FormEvent, useRef } from "react";
import { useAuth } from "../lib/auth";
import { API } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { toJpeg } from 'html-to-image';
import download from 'downloadjs';
import { Store, LayoutDashboard, ShoppingCart, Package, History, 
  Settings, LogOut, Search, Menu, X, Plus, CreditCard, 
  User, MapPin, Phone, DollarSign, Calculator, FileText, 
  Info, Trash2, Edit3, ChevronRight, CheckCircle2, AlertCircle,
  TrendingUp, ArrowRight, UserPlus, Receipt, ArrowUpRight,
  Printer, RefreshCw, Fingerprint, Lock, Users, Clock, IdCard, Briefcase,
  ClipboardList, SmartphoneNfc, CloudOff, Image
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { db } from "../lib/db";

interface Payment {
  id: string;
  amount: number;
  date: string;
  notes?: string;
  loanId?: string;
  loanNotes?: string;
}

interface CreditRecord {
  id: string;
  borrower_id?: string;
  borrower_name: string;
  borrower_address: string;
  borrower_contact: string;
  comaker_name: string;
  comaker_address: string;
  comaker_contact: string;
  principal_amount: number;
  interest_rate: number;
  interest_amount: number;
  total_amount: number;
  paid_amount?: number;
  balance_amount?: number;
  payments?: Payment[];
  notes: string;
  status: 'active' | 'paid' | 'overdue';
  created_at: string;
  isPending?: boolean;
}

export default function CreditTracker({ navigate, currentPage, verifiedBorrowerId }: { navigate: (page: any) => void, currentPage: string, verifiedBorrowerId?: string }) {
  const { user, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const { theme, toggleTheme } = useTheme();

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [viewMode, setViewMode] = useState<'registry' | 'summary'>('registry');

  const isBorrowerMode = !!verifiedBorrowerId;
  
  // Form State
  const [formData, setFormData] = useState({
    borrower_name: "",
    borrower_address: "",
    borrower_contact: "",
    comaker_name: "",
    comaker_address: "",
    comaker_contact: "",
    principal_amount: 0,
    interest_rate: 0,
    notes: ""
  });

  const [idToEdit, setIdToEdit] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedLoanRecord, setSelectedLoanRecord] = useState<CreditRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);
  const [soaToDownload, setSoaToDownload] = useState<any>(null);
  const soaRef = useRef<HTMLDivElement>(null);

  const handleDownloadJPEG = async (customer: any) => {
    setSoaToDownload(customer);
  };

  useEffect(() => {
    if (soaToDownload && soaRef.current) {
      const capture = async () => {
        try {
          // Add a small delay to ensure rendering
          await new Promise(resolve => setTimeout(resolve, 500));
          const dataUrl = await toJpeg(soaRef.current!, { 
            quality: 0.95, 
            backgroundColor: '#ffffff',
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left'
            }
          });
          download(dataUrl, `SOA-${soaToDownload.name.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.jpeg`);
        } catch (error) {
          console.error("Capture failed:", error);
        } finally {
          setSoaToDownload(null);
        }
      };
      capture();
    }
  }, [soaToDownload]);

  const resolveBorrowerId = (name: string, currentId: string | undefined, allRecords: any[]) => {
    // Strip # if present
    const sanitizedId = currentId?.replace(/^#/, "");
    if (sanitizedId && sanitizedId !== "PEND" && sanitizedId !== "PENDING") return sanitizedId;
    
    const canonicalName = name.trim().toUpperCase();
    const existing = allRecords.find(r => 
      r.borrower_name.trim().toUpperCase() === canonicalName && 
      r.borrower_id && 
      r.borrower_id.replace(/^#/, "") !== "PEND" && 
      r.borrower_id.replace(/^#/, "") !== "PENDING"
    );
    if (existing?.borrower_id) return existing.borrower_id.replace(/^#/, "");
    
    let hash = 0;
    for (let i = 0; i < canonicalName.length; i++) {
        hash = ((hash << 5) - hash) + canonicalName.charCodeAt(i);
        hash |= 0;
    }
    const seed = Math.abs(hash).toString(36).toUpperCase();
    return (seed + "X7Y9Z2").substring(0, 6);
  };

  const fetchRecords = async () => {
    try {
      // 1. Fetch from Server
      const res = await API.get("/credits");
      const serverRecords = res.data || [];
      
      // 2. Fetch pending from IndexedDB
      const pending = await db.pendingTransactions.where('path').equals('/credits').toArray();
      const pendingRecords = pending.map(p => ({ ...p.data, isPending: true }));
      
      // 3. Local Cache for offline use
      if (serverRecords.length > 0) {
        await db.credits.clear();
        await db.credits.bulkPut(serverRecords);
      }

      // Combine and filter duplicates
      const all = [...pendingRecords, ...serverRecords].reduce((acc: CreditRecord[], curr) => {
        if (!acc.some(r => r.id === curr.id)) acc.push(curr);
        return acc;
      }, []);

      // If in borrower mode, filter only their records using resolution logic
      const filteredForBorrower = verifiedBorrowerId 
        ? all.filter(r => resolveBorrowerId(r.borrower_name, r.borrower_id, all).toUpperCase() === verifiedBorrowerId.toUpperCase())
        : all;

      setRecords(filteredForBorrower);
    } catch (err) {
      console.error("Fetch Error, using local cache:", err);
      const local = await db.credits.toArray();
      const pending = await db.pendingTransactions.where('path').equals('/credits').toArray();
      const all = [...pending.map(p => ({ ...p.data, isPending: true })), ...local];
      
      const filteredForBorrower = verifiedBorrowerId 
        ? all.filter(r => resolveBorrowerId(r.borrower_name, r.borrower_id, all).toUpperCase() === verifiedBorrowerId.toUpperCase())
        : all;
        
      setRecords(filteredForBorrower);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin && !verifiedBorrowerId) {
      navigate("dashboard");
      return;
    }
    fetchRecords();
    
    // Sync listener
    const handleSync = () => fetchRecords();
    window.addEventListener('sync-complete', handleSync);
    return () => window.removeEventListener('sync-complete', handleSync);
  }, []);

  const calculateInterest = () => {
    const principal = Number(formData.principal_amount) || 0;
    const rate = Number(formData.interest_rate) || 0;
    const interest = principal * (rate / 100);
    const total = principal + interest;
    return { interest, total };
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    const { interest, total } = calculateInterest();
    const id = idToEdit || `crd_${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    // Check if borrower already has an ID
    let borrowerId = records.find(r => r.borrower_name.trim().toUpperCase() === formData.borrower_name.trim().toUpperCase())?.borrower_id;
    if (!borrowerId) {
      borrowerId = generateBorrowerId();
    }
    
    const payload = {
      id,
      borrower_id: borrowerId.replace(/^#/, ""),
      ...formData,
      interest_amount: interest,
      total_amount: total,
      paid_amount: 0,
      balance_amount: total,
      payments: [],
      status: 'active' as const,
      created_at: createdAt
    };

    try {
      if (idToEdit) {
        await API.put(`/credits/${idToEdit}`, payload);
      } else {
        await API.post("/credits", payload);
      }
      
      // Optimize: Update local view
      setRecords(prev => [{ ...payload }, ...prev.filter(r => r.id !== id)]);
      setIsModalOpen(false);
      resetForm();
      fetchRecords(); 
    } catch (err) {
      console.warn("Saving offline via catch:", err);
      // Fallback manual queue if API didn't handle it (it should have)
      const isQueued = await db.pendingTransactions.where('data.id').equals(id).first();
      if (!isQueued) {
        await db.pendingTransactions.add({
          path: '/credits',
          method: idToEdit ? 'PUT' : 'POST',
          data: payload,
          status: 'pending',
          timestamp: Date.now()
        });
      }
      await db.credits.put(payload);
      setRecords(prev => [{ ...payload, isPending: true }, ...prev.filter(r => r.id !== id)]);
      setIsModalOpen(false);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await API.delete(`/credits/${id}`);
      fetchRecords();
    } catch (err) {
      setRecords(prev => prev.filter(r => r.id !== id));
      await db.credits.delete(id);
      await db.pendingTransactions.add({
        path: `/credits/${id}`,
        method: 'DELETE',
        data: { id },
        status: 'pending',
        timestamp: Date.now()
      });
    }
  };

  const resetForm = () => {
    setFormData({
      borrower_name: "",
      borrower_address: "",
      borrower_contact: "",
      comaker_name: "",
      comaker_address: "",
      comaker_contact: "",
      principal_amount: 0,
      interest_rate: 0,
      notes: ""
    });
    setIdToEdit(null);
  };

  const openEdit = (record: CreditRecord) => {
    setFormData({
      borrower_name: record.borrower_name,
      borrower_address: record.borrower_address,
      borrower_contact: record.borrower_contact,
      comaker_name: record.comaker_name,
      comaker_address: record.comaker_address,
      comaker_contact: record.comaker_contact,
      principal_amount: record.principal_amount,
      interest_rate: record.interest_rate,
      notes: record.notes
    });
    setIdToEdit(record.id);
    setIsModalOpen(true);
  };

  const filteredRecords = records.filter(r => 
    (r.borrower_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.comaker_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.borrower_id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalActive: records.filter(r => r.status === 'active').length,
    totalReceivable: records.reduce((acc, r) => acc + (r.status === 'active' ? r.total_amount : 0), 0),
    totalInterest: records.reduce((acc, r) => acc + (r.status === 'active' ? r.interest_amount : 0), 0)
  };

  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
    }).format(n || 0);

  const safeDate = (dateStr: any) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (iso: string) => {
    const d = safeDate(iso);
    if (!d) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const generateBorrowerId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const formatTime = (iso: string) => {
    const d = safeDate(iso);
    if (!d) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handlePrint = (customer: any) => {
    const txn = {
      transactionNumber: `SOA-${(customer.name || "CUST").substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      customer: { 
        name: customer.name,
        address: `${customer.address} • ID: #${customer.borrower_id}`,
        contact: customer.contact
      },
      cashier: { name: user?.name || user?.email || "Branch Manager" },
      paymentMethod: "SOA / CREDIT",
      title: "STATEMENT OF ACCOUNT",
      items: customer.records.map((r: any) => ({
        id: r.id,
        name: `LOAN REF: #${r.id.split('_').pop()?.toUpperCase()} • ${formatDate(r.created_at)}`,
        notes: r.notes || "",
        qty: 1,
        price: r.total_amount
      })),
      total: customer.total_balance,
      total_loaned: customer.total_due,
      total_paid: customer.total_paid
    };

    console.log("CreditTracker: Dispatching swiftpos-print", txn);
    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  const handlePrintPayment = (payment: Payment, record?: CreditRecord) => {
    const loanRecord = record || records.find(r => r.id === payment.loanId);
    if (!loanRecord) {
      console.warn("Loan record not found for payment", payment);
      return;
    }

    const txn = {
      transactionNumber: `PAY-#${payment.id.split('_').pop()?.toUpperCase()}`,
      createdAt: payment.date,
      customer: { 
        name: loanRecord.borrower_name,
        address: `${loanRecord.borrower_address} • ID: #${loanRecord.borrower_id}`,
        contact: loanRecord.borrower_contact
      },
      cashier: { name: user?.name || user?.email || "Branch Manager" },
      paymentMethod: "CASH REPAYMENT",
      title: "PAYMENT RECEIPT",
      items: [
        {
          id: 'PYMT',
          name: "Loan Repayment",
          qty: 1,
          price: payment.amount,
          notes: payment.notes
        }
      ],
      total: loanRecord.total_amount - (loanRecord.paid_amount || 0) + payment.amount, // Balance before this payment
      total_paid: payment.amount,
      paymentRemarks: payment.notes
    };

    console.log("CreditTracker: Dispatching swiftpos-print", txn);
    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  const handlePrintSingle = (record: CreditRecord) => {
    const txn = {
      transactionNumber: `LOAN-#${record.id.split('_').pop()?.toUpperCase()}`,
      createdAt: record.created_at,
      customer: { 
        name: record.borrower_name,
        address: `${record.borrower_address} • ID: #${record.borrower_id}`,
        contact: record.borrower_contact
      },
      cashier: { name: user?.name || user?.email || "Branch Manager" },
      paymentMethod: "LOAN DISBURSEMENT",
      title: "LOAN RECEIPT",
      items: [
        {
          id: 'PRN',
          name: "Principal Amount",
          qty: 1,
          price: record.principal_amount
        },
        {
          id: 'INT',
          name: `Interest (${record.interest_rate}%)`,
          qty: 1,
          price: record.interest_amount
        }
      ],
      total: record.total_amount
    };

    window.dispatchEvent(new CustomEvent('swiftpos-print', { detail: txn }));
  };

  const handlePayment = async () => {
    if (!activeLoanId || !paymentAmount || Number(paymentAmount) <= 0 || isSaving) return;
    setIsSaving(true);
    
    const record = records.find(r => r.id === activeLoanId);
    if (!record) {
      setIsSaving(false);
      return;
    }

    const amount = Number(paymentAmount);
    const newPaidAmount = (record.paid_amount || 0) + amount;
    const newBalance = record.total_amount - newPaidAmount;
    
    const newPayment: Payment = {
      id: `pay_${Date.now()}`,
      amount,
      date: new Date().toISOString(),
      notes: paymentNotes
    };

    const updatedPayments = [...(record.payments || []), newPayment];
    const newStatus = newBalance <= 0 ? 'paid' : record.status;

    const updatedRecord = {
      ...record,
      paid_amount: newPaidAmount,
      balance_amount: newBalance,
      payments: updatedPayments,
      status: newStatus as any
    };

    try {
      // Optimistic update
      setRecords(prev => prev.map(r => r.id === activeLoanId ? updatedRecord : r));
      
      if (selectedCustomer) {
        const updatedCustRecords = selectedCustomer.records.map((r: any) => r.id === activeLoanId ? updatedRecord : r);
        setSelectedCustomer({
          ...selectedCustomer,
          records: updatedCustRecords,
          total_paid: (selectedCustomer.total_paid || 0) + amount,
          total_balance: (selectedCustomer.total_balance || 0) - amount
        });
      }

      await API.put(`/credits/${activeLoanId}`, updatedRecord);
      
      setPaymentAmount("");
      setPaymentNotes("");
      setActiveLoanId(null);
      fetchRecords();
    } catch (err) {
      console.error("Payment failed:", err);
      // Ensure local state reflecting pending if needed? API handles queuing
    } finally {
      setIsSaving(false);
    }
  };

  const groupedByCustomer = records.reduce<Record<string, {
    records: CreditRecord[],
    borrower_id: string,
    total_principal: number,
    total_interest: number,
    total_due: number,
    total_paid: number,
    total_balance: number,
    address: string,
    contact: string
  }>>((acc, record) => {
    const name = record.borrower_name.trim().toUpperCase();
    if (!acc[name]) {
      acc[name] = {
        records: [],
        borrower_id: resolveBorrowerId(record.borrower_name, record.borrower_id, records),
        total_principal: 0,
        total_interest: 0,
        total_due: 0,
        total_paid: 0,
        total_balance: 0,
        address: record.borrower_address,
        contact: record.borrower_contact
      };
    }
    acc[name].records.push(record);
    if (record.borrower_id && (acc[name].borrower_id.includes("PEND") || acc[name].borrower_id.length < 6)) {
      acc[name].borrower_id = resolveBorrowerId(record.borrower_name, record.borrower_id, records);
    }
    acc[name].total_principal += record.principal_amount;
    acc[name].total_interest += record.interest_amount;
    acc[name].total_due += record.total_amount;
    acc[name].total_paid += (record.paid_amount || 0);
    acc[name].total_balance += (record.balance_amount ?? record.total_amount);
    return acc;
  }, {});

  const customers = (Object.entries(groupedByCustomer) as [string, any][])
    .map(([name, data]) => ({ name, ...data }))
    .filter(c => (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.total_due - a.total_due);



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
                      layoutId="active-indicator-credit"
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

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="sticky top-0 z-30 bg-[#f8f9fa]/80 dark:bg-[#0a0a0f]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
          <div className="p-4 lg:p-6 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4">
              <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter whitespace-nowrap">
                {isBorrowerMode ? "My Credit Portfolio" : "CREDIT TRACKER"}
              </h2>
              {isBorrowerMode && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Verified ID: {verifiedBorrowerId}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              {/* Desktop Search */}
              <div className="hidden md:flex items-center h-10 bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-xl px-4">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                  placeholder="SEARCH BORROWERS..." 
                  className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase tracking-widest w-48 text-slate-900 dark:text-white uppercase" 
                />
              </div>

              <div className="hidden md:flex items-center gap-1 bg-white dark:bg-[#15161d] p-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                <button 
                  onClick={() => setViewMode('registry')}
                  className={`px-3 lg:px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'registry' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                  Reg
                </button>
                <button 
                  onClick={() => setViewMode('summary')}
                  className={`px-3 lg:px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'summary' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                  Sum
                </button>
              </div>

              <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                disabled={isBorrowerMode}
                className={`hidden md:flex bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-6 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all ${isBorrowerMode ? 'opacity-50 cursor-not-allowed hidden' : ''}`}
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Credit</span>
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-8">
          {/* Mobile Search Bar - Visible only on mobile */}
          <div className="md:hidden">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="Search borrowers..." 
                className="w-full bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none uppercase" 
              />
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[
              { label: "Active Loans", value: stats.totalActive, icon: Receipt, color: "text-indigo-500", bg: "bg-indigo-500/10", isCount: true },
              { label: "Total Receivables", value: stats.totalReceivable, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Projected Interest", value: stats.totalInterest, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-[#15161d] p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4 md:gap-6"
              >
                <div className={`${stat.bg} ${stat.color} w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 md:w-7 md:h-7" />
                </div>
                <div>
                  <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">{stat.label}</p>
                  <h3 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {stat.isCount ? stat.value : formatCurrency(stat.value)}
                  </h3>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Records Table / Summary */}
          {/* Mobile Actions - Visible only on mobile */}
          <div className="md:hidden space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 bg-white dark:bg-[#15161d] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                <button 
                  onClick={() => setViewMode('registry')}
                  className={`flex-1 py-3 rounded-[0.8rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'registry' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400'}`}
                >
                  Regular
                </button>
                <button 
                  onClick={() => setViewMode('summary')}
                  className={`flex-1 py-3 rounded-[0.8rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'summary' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400'}`}
                >
                  Summary
                </button>
              </div>
              
              <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                disabled={isBorrowerMode}
                className={`bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all ${isBorrowerMode ? 'hidden' : ''}`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              disabled={isBorrowerMode}
              className={`w-full bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center justify-center gap-2 shadow-sm ${isBorrowerMode ? 'hidden' : ''}`}
            >
              <Plus className="w-4 h-4" /> Add New Credit
            </button>
          </div>

          <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-4 md:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h4 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {viewMode === 'registry' ? 'Borrower Registry' : 'Customer Credit Summary'}
              </h4>
              <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-full w-fit">
                <Info className="w-3 md:w-3.5 h-3 md:h-3.5" />
                {viewMode === 'registry' ? `${filteredRecords.length} Individual Loans` : `${customers.length} Unique Customers`}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                {viewMode === 'registry' ? (
                  <>
                    <thead className="bg-[#f8f9fa] dark:bg-[#1c1d26] text-slate-400 text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 lg:px-8 py-5 hidden sm:table-cell">User ID</th>
                        <th className="px-4 lg:px-8 py-5">Borrower Details</th>
                        <th className="px-4 lg:px-8 py-5 hidden sm:table-cell">Date & Time</th>
                        <th className="px-4 lg:px-8 py-5 text-right sm:text-left">Financial Profile</th>
                        <th className="px-4 lg:px-8 py-5 hidden lg:table-cell">Notes</th>
                        <th className="px-4 lg:px-8 py-5 hidden md:table-cell">Status</th>
                        <th className="px-4 lg:px-8 py-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Records...</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4 text-slate-400">
                              <AlertCircle className="w-12 h-12 opacity-20" />
                              <p className="text-[10px] font-black uppercase tracking-widest">No credit records found</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredRecords.map((record) => (
                        <tr key={record.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group ${record.isPending ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                          <td className="px-4 lg:px-8 py-6 hidden sm:table-cell">
                            <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded-lg uppercase tracking-widest">#{resolveBorrowerId(record.borrower_name, record.borrower_id, records)}</span>
                          </td>
                          <td className="px-4 lg:px-8 py-6">
                            <div className="flex items-center gap-3 lg:gap-4">
                              <div className={`w-8 h-8 lg:w-10 lg:h-10 shrink-0 rounded-lg md:rounded-xl flex items-center justify-center font-black text-[10px] lg:text-base ${record.isPending ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600'}`}>
                                {record.borrower_name?.charAt(0) || "B"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] lg:text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{record.borrower_name}</p>
                                  {record.isPending && (
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-500" />
                                  )}
                                </div>
                                <div className="sm:hidden flex flex-col gap-0.5 mt-1">
                                  <span className="text-[8px] font-black text-indigo-500 uppercase">#{resolveBorrowerId(record.borrower_name, record.borrower_id, records)}</span>
                                  <span className="text-[8px] text-slate-400 font-bold flex items-center gap-1 uppercase truncate">
                                    {formatDate(record.created_at)}
                                  </span>
                                  <span className={`text-[8px] font-black uppercase ${
                                    record.status === 'paid' ? 'text-emerald-500' : 
                                    record.status === 'overdue' ? 'text-rose-500' : 
                                    'text-amber-500'
                                  }`}>
                                    {record.status}
                                  </span>
                                </div>
                                <p className="hidden sm:flex text-[8px] lg:text-[9px] text-slate-400 font-bold items-center gap-1 uppercase mt-0.5 truncate">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" /> {record.borrower_address}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 hidden sm:table-cell">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider">{formatDate(record.created_at)}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">{formatTime(record.created_at)}</span>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6">
                            <div className="space-y-0.5 lg:space-y-1 min-w-[100px] md:min-w-[120px] text-right sm:text-left">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 sm:justify-between">
                                <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest order-2 sm:order-1">Due</span>
                                <span className="text-[9px] md:text-[10px] lg:text-[11px] font-black text-slate-900 dark:text-white truncate order-1 sm:order-2">{formatCurrency(record.total_amount)}</span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 sm:justify-between">
                                <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest order-2 sm:order-1">Left</span>
                                <span className={`text-[9px] md:text-[10px] lg:text-[11px] font-black truncate order-1 sm:order-2 ${record.balance_amount && record.balance_amount <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {formatCurrency(record.balance_amount ?? record.total_amount)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 hidden lg:table-cell">
                            <p className="text-[9px] font-bold text-slate-400 uppercase line-clamp-2 max-w-[120px]">
                              {record.notes || "—"}
                            </p>
                          </td>
                          <td className="px-4 lg:px-8 py-6 hidden md:table-cell">
                             <span className={`px-2 lg:px-3 py-1 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-wider ${
                               record.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 
                               record.status === 'overdue' ? 'bg-rose-500/10 text-rose-500' : 
                               'bg-amber-500/10 text-amber-500'
                             }`}>
                               {record.status}
                             </span>
                          </td>
                          <td className="px-4 lg:px-8 py-6 text-right">
                            {!isBorrowerMode && (
                              <div className="flex items-center justify-end gap-1 lg:gap-2">
                                <button onClick={() => openEdit(record)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors">
                                  <Edit3 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                </button>
                                <button onClick={() => handleDelete(record.id)} className="p-2 hover:bg-rose-500/10 rounded-xl text-slate-400 hover:text-rose-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead className="bg-[#f8f9fa] dark:bg-[#1c1d26] text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 lg:px-8 py-5">User ID</th>
                        <th className="px-4 lg:px-8 py-5">Customer Profile</th>
                        <th className="px-4 lg:px-8 py-5 hidden sm:table-cell">Active Loans</th>
                        <th className="px-4 lg:px-8 py-5">Cumulative Debt</th>
                        <th className="px-4 lg:px-8 py-5 hidden md:table-cell">Contact</th>
                        <th className="px-4 lg:px-8 py-5 text-right">Reports</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {customers.map((customer) => (
                        <tr key={customer.name} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                          <td className="px-4 lg:px-8 py-6">
                            <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded-lg uppercase tracking-widest">#{customer.borrower_id}</span>
                          </td>
                          <td className="px-4 lg:px-8 py-6">
                            <div className="flex items-center gap-3 lg:gap-4">
                              <div className="w-10 h-10 lg:w-12 lg:h-12 shrink-0 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base lg:text-lg">
                                {customer.name?.charAt(0) || "C"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] lg:text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{customer.name || "Unknown"}</p>
                                <p className="text-[8px] lg:text-[9px] text-slate-500 font-bold uppercase mt-0.5 truncate max-w-[150px] lg:max-w-[200px]">{customer.address}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 hidden sm:table-cell">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-white/10 rounded-full">
                              <span className="text-[10px] font-black text-slate-900 dark:text-white">{customer.records.length}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Loans</span>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6">
                             <div className="space-y-0.5 lg:space-y-1">
                               <p className="text-[12px] lg:text-[14px] font-black text-indigo-600 truncate">{formatCurrency(customer.total_due)}</p>
                               <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase truncate">
                                 Left: {formatCurrency(customer.total_balance)}
                               </p>
                             </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 hidden md:table-cell">
                            <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{customer.contact}</p>
                          </td>
                          <td className="px-4 lg:px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-1 lg:gap-2">
                               <button 
                                 onClick={() => setSelectedCustomer(customer)}
                                 className="px-3 lg:px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all"
                               >
                                 Summary
                               </button>
                               <button 
                                 onClick={() => handlePrint(customer)}
                                 className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                 title="Print PDF"
                               >
                                 <Printer className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                               </button>
                               <button 
                                 onClick={() => handleDownloadJPEG(customer)}
                                 className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                                 title="Download JPEG"
                               >
                                 <Image className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Customer Detail Summary Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-0 md:p-4 lg:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="fixed inset-0 bg-[#0a0a0f]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-white dark:bg-[#15161d] rounded-none md:rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/5 my-0 md:my-8 min-h-screen md:min-h-0"
            >
              <div className="p-6 md:p-10 lg:p-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 md:mb-12">
                  <div className="flex items-center gap-4 lg:gap-6">
                    <div className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white text-lg lg:text-2xl font-black shrink-0">
                      {selectedCustomer.name?.charAt(0) || "S"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <h3 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate leading-tight">{selectedCustomer.name || "Unknown"}</h3>
                        <span className="px-2 py-0.5 md:px-3 md:py-1 bg-indigo-600 text-white text-[8px] md:text-[10px] font-black rounded-lg uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20">#{selectedCustomer.borrower_id}</span>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2 mt-1 truncate">
                        <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" /> {selectedCustomer.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <button 
                      onClick={() => handlePrint(selectedCustomer)}
                      className="flex-1 md:flex-none px-4 lg:px-6 py-2.5 lg:py-3 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20"
                    >
                      <Printer className="w-4 h-4" /> <span className="inline">Print Statement</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadJPEG(selectedCustomer)}
                      className="flex-1 md:flex-none px-4 lg:px-6 py-2.5 lg:py-3 bg-emerald-600 text-white rounded-xl md:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
                    >
                      <Image className="w-4 h-4" /> <span className="inline">Download JPEG</span>
                    </button>
                    <button onClick={() => setSelectedCustomer(null)} className="p-2.5 lg:p-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl md:rounded-2xl transition-colors shrink-0">
                      <X className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6 mb-8 lg:mb-12">
                  {[
                    { label: "Total Loaned", value: selectedCustomer.total_due, color: "text-slate-900 dark:text-white" },
                    { label: "Total Paid", value: selectedCustomer.total_paid, color: "text-emerald-500" },
                    { label: "Current Balance", value: selectedCustomer.total_balance, color: "text-rose-600" },
                    { label: "Interest", value: selectedCustomer.total_interest, color: "text-amber-500" }
                  ].map((s, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-white/5 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-[1.5rem] lg:rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                      <p className="text-[7px] md:text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 md:mb-2 line-clamp-1">{s.label}</p>
                      <p className={`text-[10px] md:text-sm lg:text-xl font-black ${s.color} truncate`}>{formatCurrency(s.value)}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: Loans Table */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl lg:rounded-[2rem] overflow-hidden shadow-sm">
                      <div className="p-4 md:p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <h5 className="text-[9px] md:text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-indigo-500" /> Loan Records
                        </h5>
                      </div>
                      <div className="overflow-x-auto max-h-[300px] md:max-h-[500px]">
                        <table className="w-full text-left border-collapse min-w-[500px] md:min-w-0">
                          <thead className="bg-slate-50 dark:bg-black/20 text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                              <th className="px-4 md:px-6 py-4">Loan ID</th>
                              <th className="px-4 md:px-6 py-4">Timeline</th>
                              <th className="px-4 md:px-6 py-4">Loan Val.</th>
                              <th className="px-4 md:px-6 py-4">Due Balance</th>
                              <th className="px-4 md:px-6 py-4 hidden md:table-cell">Notes</th>
                              <th className="px-4 md:px-6 py-4 text-right">Process</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {selectedCustomer.records.map((r: any) => (
                              <tr key={r.id} className={`hover:bg-slate-50 shadow-sm dark:hover:bg-white/5 transition-all group cursor-pointer ${activeLoanId === r.id ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}>
                                <td onClick={() => setSelectedLoanRecord(r)} className="px-4 md:px-6 py-4">
                                  <span className="text-[8px] font-black bg-indigo-600/10 text-indigo-600 px-2 py-1 rounded-lg">#{r.id.split('_').pop()?.toUpperCase()}</span>
                                </td>
                                <td onClick={() => setSelectedLoanRecord(r)} className="px-4 md:px-6 py-4">
                                  <p className="text-[9px] lg:text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">{formatDate(r.created_at)}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">{formatTime(r.created_at)}</p>
                                </td>
                                <td onClick={() => setSelectedLoanRecord(r)} className="px-4 md:px-6 py-4">
                                  <p className="text-[10px] lg:text-[11px] font-black text-indigo-600">{formatCurrency(r.total_amount)}</p>
                                </td>
                                <td onClick={() => setSelectedLoanRecord(r)} className="px-4 md:px-6 py-4">
                                  <p className={`text-[10px] lg:text-[11px] font-black ${r.balance_amount <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {formatCurrency(r.balance_amount ?? r.total_amount)}
                                  </p>
                                </td>
                                <td onClick={() => setSelectedLoanRecord(r)} className="px-4 md:px-6 py-4 hidden md:table-cell">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase line-clamp-1 max-w-[120px]">{r.notes || "—"}</p>
                                </td>
                                <td className="px-4 md:px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setSelectedLoanRecord(r); }}
                                      className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-400 rounded-xl transition-all"
                                      title="View Details"
                                    >
                                      <Info className="w-4 h-4" />
                                    </button>
                                    {r.status !== 'paid' ? (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveLoanId(r.id); }}
                                        className={`px-3 md:px-4 py-2 rounded-xl text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all ${activeLoanId === r.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600'}`}
                                      >
                                        {activeLoanId === r.id ? 'Active' : 'Pay'}
                                      </button>
                                    ) : (
                                      <div className="flex items-center justify-end text-emerald-500 gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span className="text-[8px] font-black uppercase">Paid</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Payment History Tracker */}
                    <div className="bg-slate-900 dark:bg-black rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 text-white relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                        <History className="w-48 h-48" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                               <History className="w-5 h-5" />
                             </div>
                             <h5 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Transaction Ledger</h5>
                          </div>
                          <span className="hidden sm:inline-block text-[8px] font-black text-indigo-400 uppercase bg-indigo-400/10 px-3 py-1 rounded-full">Recent Activity</span>
                        </div>
                        <div className="space-y-3">
                          {selectedCustomer.records.flatMap((r: any) => (r.payments || []).map((p: any) => ({...p, loanId: r.id, loanNotes: r.notes}))).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).length === 0 ? (
                            <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/5">
                              <AlertCircle className="w-8 h-8 text-white/10 mx-auto mb-3" />
                              <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">No transaction history detected</p>
                            </div>
                          ) : (
                            selectedCustomer.records.flatMap((r: any) => (r.payments || []).map((p: any) => ({...p, loanId: r.id, loanNotes: r.notes})))
                              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .slice(0, 8)
                              .map((payment: any, idx: number) => (
                                <motion.div 
                                  key={idx} 
                                  whileHover={{ x: 5 }}
                                  onClick={() => setSelectedPayment(payment)}
                                  className="flex items-center justify-between p-4 md:p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                      <TrendingUp className="w-5 h-5 shrink-0" />
                                    </div>
                                    <div>
                                      <p className="text-[12px] md:text-[13px] font-black tracking-tight">{formatCurrency(payment.amount)}</p>
                                      <p className="text-[8px] text-indigo-200/50 font-bold uppercase mt-0.5">{formatDate(payment.date)} • {formatTime(payment.date)}</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-4">
                                    <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-2 justify-end mb-1">
                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[100px]">{payment.notes || "REPAYMENT"}</span>
                                        <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white transition-colors shrink-0" />
                                      </div>
                                      <p className="text-[7px] text-white/20 font-black uppercase tracking-tighter">REF: #{payment.id.split('_').pop()}</p>
                                    </div>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrintPayment(payment);
                                      }}
                                      className="p-2 bg-white/5 text-slate-400 hover:text-indigo-400 hover:bg-white/10 rounded-xl transition-all"
                                      title="Print Payment Receipt"
                                    >
                                      <Printer className="w-4 h-4" />
                                    </button>
                                  </div>
                                </motion.div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Partial Payment Input */}
                  <div className="space-y-6">
                    <div className="bg-indigo-600 rounded-[2rem] lg:rounded-[2.5rem] p-7 md:p-8 lg:p-10 text-white shadow-[0_30px_60px_-15px_rgba(79,70,229,0.3)] sticky top-8">
                       <div className="flex items-center gap-4 mb-8 md:mb-10">
                         <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
                           <Calculator className="w-6 h-6" />
                         </div>
                         <div>
                           <h5 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-white">Ledger Entry</h5>
                           <p className="text-[8px] font-bold text-indigo-200/80 uppercase">Update Account Balance</p>
                         </div>
                       </div>

                       {!activeLoanId ? (
                         <div className="py-12 md:py-16 text-center text-indigo-100/40 flex flex-col items-center gap-6">
                           <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                             <ArrowRight className="w-8 h-8 md:w-10 md:h-10 opacity-10" />
                           </div>
                           <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] max-w-[170px] leading-relaxed">Select a loan row from the registry to post a payment</p>
                         </div>
                       ) : (
                         <div className="space-y-6 md:space-y-8">
                           <div>
                             <div className="bg-black/10 rounded-2xl p-4 mb-6 md:mb-8">
                               <p className="text-[8px] md:text-[9px] font-black text-indigo-100/60 uppercase tracking-widest mb-1">Current Obligation</p>
                               <p className="text-xl md:text-2xl font-black text-white">{formatCurrency(selectedCustomer.records.find((r: any) => r.id === activeLoanId)?.balance_amount ?? selectedCustomer.records.find((r: any) => r.id === activeLoanId)?.total_amount)}</p>
                             </div>

                             <div className="space-y-4 md:space-y-5">
                               <div className="relative">
                                 <p className="text-[8px] font-black text-indigo-200 uppercase tracking-widest mb-2 ml-1">Payment Amount</p>
                                 <div className="relative group">
                                   <DollarSign className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-indigo-300 transition-colors group-focus-within:text-white" />
                                   <input 
                                     type="number"
                                     placeholder="0.00"
                                     value={paymentAmount}
                                     onChange={(e) => setPaymentAmount(e.target.value)}
                                     className="w-full bg-white/10 border border-white/10 rounded-2xl pl-11 md:pl-14 pr-4 md:pr-6 py-4 md:py-5 text-xl md:text-2xl font-black focus:ring-4 focus:ring-white/10 text-white placeholder-white/20 transition-all outline-none"
                                   />
                                 </div>
                               </div>
                               <div>
                                 <p className="text-[8px] font-black text-indigo-200 uppercase tracking-widest mb-2 ml-1">Notes / Remarks</p>
                                 <textarea 
                                   placeholder="OPTIONAL..."
                                   rows={2}
                                   value={paymentNotes}
                                   onChange={(e) => setPaymentNotes(e.target.value)}
                                   className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 md:px-6 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-white/10 text-white placeholder-white/20 transition-all outline-none resize-none"
                                 />
                               </div>
                             </div>
                           </div>

                           <div className="space-y-3">
                             <button 
                               onClick={handlePayment}
                               disabled={!paymentAmount || Number(paymentAmount) <= 0 || isSaving}
                               className="w-full h-14 md:h-16 bg-white text-indigo-700 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] hover:scale-[1.02] hover:shadow-2xl active:scale-95 transition-all shadow-xl disabled:opacity-30 disabled:scale-100 disabled:pointer-events-none flex items-center justify-center gap-2"
                             >
                               {isSaving ? (
                                 <>
                                   <RefreshCw className="w-4 h-4 animate-spin" />
                                   Processing...
                                 </>
                               ) : (
                                 "Confirm Payment"
                               )}
                             </button>

                             <button 
                               onClick={() => { setActiveLoanId(null); setPaymentAmount(""); setPaymentNotes(""); }}
                               className="w-full py-2 text-white/50 text-[9px] font-black uppercase tracking-[0.2em] hover:text-white transition-colors flex items-center justify-center gap-2"
                             >
                               <X className="w-3 h-3" /> Cancel Selection
                             </button>
                           </div>
                         </div>
                       )}
                    </div>

                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-[2rem] lg:rounded-[2.5rem] p-6 md:p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-6 md:mb-8">
                         <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                           <Info className="w-4 h-4" />
                         </div>
                         <h5 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Risk Analytics</h5>
                      </div>
                      <div className="space-y-4 md:space-y-5">
                        {[
                          { label: "Credit Trust", value: "Verified", color: "text-emerald-500", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                          { label: "Repayment", value: "Optimal (4.2d)", color: "text-indigo-600 dark:text-indigo-400", icon: <TrendingUp className="w-3.5 h-3.5" /> },
                          { label: "Health", value: "Grade A+", color: "text-slate-900 dark:text-white", icon: <DollarSign className="w-3.5 h-3.5" /> }
                        ].map((item, id) => (
                           <div key={id} className="flex items-center justify-between pb-3 md:pb-4 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{item.label}</span>
                             <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${item.color}`}>
                               {item.icon}
                               {item.value}
                             </div>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Entry Detail Modal */}
      <AnimatePresence>
        {selectedPayment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPayment(null)}
              className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#15161d] rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                     <Receipt className="w-6 h-6" />
                   </div>
                   <div className="flex items-center gap-2">
                     <button 
                        onClick={() => handlePrintPayment(selectedPayment)}
                        className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-all flex items-center gap-2 group"
                        title="Print Payment"
                      >
                        <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </button>
                     <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                       <X className="w-5 h-5 text-slate-400" />
                     </button>
                   </div>
                </div>
                
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Payment Detailed Record</h4>
                <p className="text-4xl font-black text-slate-900 dark:text-white mb-8">{formatCurrency(selectedPayment.amount)}</p>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Process Date</span>
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{formatDate(selectedPayment.date)}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Timestamp</span>
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{formatTime(selectedPayment.date)}</span>
                  </div>
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/10">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Payment Remarks</p>
                    <p className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200 leading-relaxed italic">
                      "{selectedPayment.notes || "This transaction represent a standard partial or full repayment toward an active loan obligation."}"
                    </p>
                  </div>
                  {selectedPayment.loanNotes && (
                    <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Loan Original Remarks</p>
                      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed italic line-clamp-3">
                        "{selectedPayment.loanNotes}"
                      </p>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => setSelectedPayment(null)}
                  className="w-full mt-8 py-5 bg-slate-900 dark:bg-white text-white dark:text-[#0a0a0f] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-transform active:scale-95"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Specific Loan Detail Modal */}
      <AnimatePresence>
        {selectedLoanRecord && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLoanRecord(null)}
              className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#15161d] rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-22xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 pb-4 shrink-0">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Loan #ID-{selectedLoanRecord.id.split('_').pop()?.toUpperCase()}</h4>
                      <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Specific Record Detail</p>
                    </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={() => handlePrintSingle(selectedLoanRecord)}
                       className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-all flex items-center gap-2 group"
                       title="Print Record"
                     >
                       <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                       <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Print Receipt</span>
                     </button>
                     <button onClick={() => setSelectedLoanRecord(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                       <X className="w-6 h-6 text-slate-400" />
                     </button>
                   </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Principal</p>
                    <p className="text-[13px] font-black text-slate-900 dark:text-white">{formatCurrency(selectedLoanRecord.principal_amount)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Rate / Int.</p>
                    <p className="text-[13px] font-black text-amber-500">{selectedLoanRecord.interest_rate}% / {formatCurrency(selectedLoanRecord.interest_amount)}</p>
                  </div>
                  <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
                    <p className="text-[8px] font-black text-indigo-100/60 uppercase mb-1">Total Valuation</p>
                    <p className="text-[13px] font-black text-white">{formatCurrency(selectedLoanRecord.total_amount)}</p>
                  </div>
                  <div className="p-4 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
                    <p className="text-[8px] font-black text-emerald-100/60 uppercase mb-1">Outstanding</p>
                    <p className="text-[13px] font-black text-white">{formatCurrency(selectedLoanRecord.balance_amount ?? selectedLoanRecord.total_amount)}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Original Remarks</p>
                  </div>
                  <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                    "{selectedLoanRecord.notes || "No additional remarks were provided for this credit application."}"
                  </p>
                </div>

                <div className="flex items-center justify-between mb-4 px-2">
                  <h5 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" /> Loan Repayments
                  </h5>
                  <span className="text-[8px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{(selectedLoanRecord.payments || []).length} Entries</span>
                </div>
              </div>

              <div className="px-8 pb-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/5">
                <div className="space-y-3">
                  {(!selectedLoanRecord.payments || selectedLoanRecord.payments.length === 0) ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">No payment records found for this loan</p>
                    </div>
                  ) : (
                    selectedLoanRecord.payments.map((payment, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:ring-2 hover:ring-indigo-500/20 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <TrendingUp className="w-5 h-5 shrink-0" />
                          </div>
                          <div>
                            <p className="text-[12px] font-black text-slate-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{formatDate(payment.date)} • {formatTime(payment.date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">{payment.notes || "PARTIAL PAYMENT"}</p>
                          <p className="text-[7px] text-slate-400 font-black uppercase tracking-tighter">REF: #{payment.id.split('_').pop()}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintPayment(payment, selectedLoanRecord);
                            }}
                            className="p-2 bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Print Payment Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-8 pt-0 shrink-0">
                <button 
                  onClick={() => setSelectedLoanRecord(null)}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-[#0a0a0f] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-transform active:scale-95"
                >
                  Return to Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal - Premium Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-start lg:items-center justify-center overflow-y-auto p-4 lg:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-[#0a0a0f]/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-[#15161d] rounded-[2.5rem] lg:rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/5 my-8 lg:my-0"
            >
              <div className="p-8 lg:p-12">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                      {idToEdit ? 'Update Credit Profile' : 'New Credit Application'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registry Entry • Automated Calculation</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Column: People */}
                    <div className="space-y-6 lg:space-y-8">
                     <div>
                        <div className="flex items-center gap-2 mb-4">
                          <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500" />
                          <h5 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Borrower Information</h5>
                        </div>
                        <div className="space-y-3 md:space-y-4 text-slate-900 dark:text-white">
                          <input 
                            required
                            type="text" 
                            placeholder="Full Name"
                            value={formData.borrower_name}
                            onChange={(e) => setFormData({...formData, borrower_name: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
                          />
                          <input 
                            required
                            type="text" 
                            placeholder="Current Address"
                            value={formData.borrower_address}
                            onChange={(e) => setFormData({...formData, borrower_address: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
                          />
                          <input 
                            required
                            type="text" 
                            placeholder="Contact Number"
                            value={formData.borrower_contact}
                            onChange={(e) => setFormData({...formData, borrower_contact: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                          <h5 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Co-Maker Details</h5>
                        </div>
                        <div className="space-y-3 md:space-y-4 text-slate-900 dark:text-white">
                           <input 
                            required
                            type="text" 
                            placeholder="Co-Maker Name"
                            value={formData.comaker_name}
                            onChange={(e) => setFormData({...formData, comaker_name: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                             <input 
                              type="text" 
                              placeholder="Address (Optional)"
                              value={formData.comaker_address}
                              onChange={(e) => setFormData({...formData, comaker_address: e.target.value})}
                              className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
                            />
                            <input 
                              type="text" 
                              placeholder="Contact (Optional)"
                              value={formData.comaker_contact}
                              onChange={(e) => setFormData({...formData, comaker_contact: e.target.value})}
                              className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Loan */}
                    <div className="space-y-6 lg:space-y-8">
                       <div>
                        <div className="flex items-center gap-2 mb-4">
                          <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
                          <h5 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loan Parameters</h5>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mb-4">
                          <div className="space-y-2">
                             <label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Principal Amount</label>
                             <input 
                                required
                                type="number" 
                                value={formData.principal_amount || ""}
                                onChange={(e) => setFormData({...formData, principal_amount: Number(e.target.value)})}
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-xl md:text-2xl font-black focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 dark:text-white"
                              />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Interest Rate (%)</label>
                             <input 
                                required
                                type="number" 
                                value={formData.interest_rate || ""}
                                onChange={(e) => setFormData({...formData, interest_rate: Number(e.target.value)})}
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-xl md:text-2xl font-black focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-900 dark:text-white"
                              />
                          </div>
                        </div>
                        <textarea 
                          placeholder="ADDITIONAL NOTES..."
                          rows={3}
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Display Row */}
                      <div className="bg-indigo-600 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                          <Calculator className="w-16 md:w-24 h-16 md:h-24" />
                        </div>
                        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                           <div>
                             <p className="text-[8px] md:text-[10px] font-black text-indigo-200 uppercase tracking-[0.25em] mb-1">Interest Amount</p>
                             <h4 className="text-xl md:text-2xl font-black">{formatCurrency(calculateInterest().interest)}</h4>
                           </div>
                           <div className="sm:text-right">
                             <p className="text-[8px] md:text-[10px] font-black text-indigo-200 uppercase tracking-[0.25em] mb-1">Total Valuation</p>
                             <h4 className="text-2xl md:text-3xl font-black">{formatCurrency(calculateInterest().total)}</h4>
                           </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full h-14 md:h-16 bg-slate-900 border dark:bg-white text-white dark:text-black rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            {idToEdit ? 'Finalize Updates' : 'Authorize New Credit'}
                            <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden SOA Template for JPEG Capture */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none overflow-hidden" style={{ width: '800px' }}>
        <div ref={soaRef} className="bg-white w-[800px] border-[1px] border-slate-100" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
           {soaToDownload && (
             <div className="bg-white text-slate-900 relative h-auto">
               {/* Tiny top label */}
               <div className="text-center py-1 bg-slate-50 border-b border-slate-100">
                 <span className="text-[7.5px] text-slate-400 font-bold tracking-[0.4em] uppercase">
                   This is not an Official Receipt · Statement of Account Summary
                 </span>
               </div>

               {/* Premium Header */}
               <div className="relative bg-gradient-to-r from-[#1e293b] to-[#334155] text-white px-8 py-4 flex justify-between items-center h-[70px]">
                 <div>
                   <h1 className="text-xl font-black tracking-tight uppercase leading-none text-blue-50">STATEMENT OF ACCOUNT</h1>
                   <div className="flex items-center gap-2 mt-1 opacity-50">
                     <span className="text-[8px] font-bold uppercase tracking-widest leading-none">Customer's Copy</span>
                     <span className="w-1 h-1 rounded-full bg-blue-400" />
                     <span className="text-[8px] font-bold uppercase tracking-widest leading-none">MARIZ-POS</span>
                   </div>
                 </div>
                 <div className="text-right">
                    <div className="text-[9px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Print Date</div>
                    <div className="text-xs font-bold text-white leading-none">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                 </div>
               </div>

               <div className="px-8 py-6">
                 {/* Branding */}
                 <div className="text-center mb-6 pb-6 border-b border-slate-100">
                   <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
                     MARIZ ENTERPRISES
                   </h2>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-tight mb-1 opacity-80">
                     Davao de Oro, Philippines
                   </p>
                 </div>

                 {/* Metadata */}
                 <div className="flex justify-between items-start mb-6">
                   <div className="text-left">
                     <p className="text-[7.5px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Billed To</p>
                     <div className="flex flex-col">
                       <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5">{soaToDownload.name}</span>
                       <span className="text-[7px] text-slate-400 font-bold uppercase tracking-tight leading-tight">{soaToDownload.address}</span>
                       <span className="text-[7px] text-slate-400 font-bold uppercase tracking-tight leading-tight">{soaToDownload.contact}</span>
                       <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-1 opacity-60">Client Master ID: {soaToDownload.borrower_id}</span>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="text-[7.5px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Summary Ref</p>
                     <div className="flex flex-col">
                       <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5">SOA-{soaToDownload.borrower_id}</span>
                       <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                   </div>
                 </div>

                 {/* Items Table */}
                 <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                   <div className="grid grid-cols-[3fr_90px_90px] bg-slate-50 border-b border-slate-200 px-6 py-3 text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                     <span className="text-left">Description / Loan Ref</span>
                     <span className="text-right">Principal</span>
                     <span className="text-right">Total Due</span>
                   </div>
                   <div className="divide-y divide-slate-100">
                     {soaToDownload.records.map((r: any, i: number) => (
                       <div key={i} className={`grid grid-cols-[3fr_90px_90px] px-6 py-3 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                         <div className="flex flex-col">
                           <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                             LOAN REF: #{r.id.split('_').pop()?.toUpperCase()} • {formatDate(r.created_at)}
                           </span>
                           {r.notes && (
                             <span className="text-[8px] text-indigo-600 font-bold uppercase mt-0.5 italic leading-tight">Remarks: {r.notes}</span>
                           )}
                           <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter opacity-60">STAT: {r.status.toUpperCase()} • {r.interest_rate}% INT</span>
                         </div>
                         <div className="text-right font-mono text-[11px] font-bold text-slate-500">
                           {r.principal_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                         </div>
                         <div className="text-right font-mono text-[12px] font-black text-slate-900">
                           {r.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

                 {/* Summary Section */}
                 <div className="flex justify-between items-end gap-10 pt-2">
                   <div className="flex-1">
                     <div className="flex items-center gap-10 mb-6">
                       <div className="bg-slate-50 rounded-lg px-4 py-2 border border-slate-100 inline-block">
                         <div className="flex items-center gap-4">
                           <div>
                             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Record Type</p>
                             <p className="text-[9px] font-black text-slate-700 uppercase leading-none">SOA / CREDIT</p>
                           </div>
                           <div className="w-[1px] h-5 bg-slate-200" />
                           <div>
                             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Security</p>
                             <p className="text-[9px] font-black text-emerald-600 uppercase leading-none">Verified</p>
                           </div>
                         </div>
                       </div>
                       <div className="flex-1 max-w-[140px]">
                         <div className="h-8 border-b border-slate-300 w-full" />
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center">Authorized Signature</p>
                       </div>
                     </div>
                     <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                       * All digital records are subject to final audit. <br/>
                       * This statement covers all active and previous loan obligations.
                     </div>
                   </div>

                   <div className="text-right space-y-4">
                     <div className="flex flex-col items-end pr-2">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Total Loaned Volume</span>
                       <span className="text-xs font-black text-slate-700">{formatCurrency(soaToDownload.total_due)}</span>
                     </div>
                     <div className="flex flex-col items-end pr-2">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Cumulative Payments</span>
                       <span className="text-xs font-black text-emerald-600">-{formatCurrency(soaToDownload.total_paid)}</span>
                     </div>
                     <div className="inline-block bg-slate-900 text-white rounded-xl px-5 py-3 shadow-lg shadow-slate-200">
                       <p className="text-[8px] font-black text-blue-300 uppercase tracking-[0.3em] mb-1.5 leading-none text-center">Total Outstanding Balance</p>
                       <div className="flex items-baseline justify-end gap-1">
                          <span className="text-[9px] font-black text-blue-400">PHP</span>
                          <span className="text-3xl font-black text-white tracking-tighter leading-none">
                            {formatCurrency(soaToDownload.total_balance).replace('PHP', '').trim()}
                          </span>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Decorative Footer */}
               <div className="h-[3px] bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 opacity-80 mt-8" />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
