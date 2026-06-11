import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Send,
  User,
  CreditCard,
  Building2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Wallet,
  RefreshCw,
  TrendingUp,
  Trash2,
  X,
  ChevronDown,
  Activity,
  Banknote,
  LogOut,
  LayoutDashboard,
  Clock,
  ShoppingCart,
  ClipboardList,
  SmartphoneNfc,
  Package,
  History,
  Users,
  IdCard,
  Printer,
  Briefcase,
  Settings,
  Menu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";

interface SendMoneyProps {
  navigate: (page: any) => void;
  currentPage: string;
}

const PROVIDERS = [
  { name: "GCash", code: "GXCHPHM2XXX", icon: "G" },
  { name: "Maya", code: "PAYMPHMMXXX", icon: "M" },
  { name: "BPI", code: "BOPIPHMMXXX", icon: "B" },
  { name: "BDO", code: "BNORPHMMXXX", icon: "B" },
  { name: "Landbank", code: "LBPKPHMMXXX", icon: "L" },
  { name: "Unionbank", code: "UBPHPHMMXXX", icon: "U" },
  { name: "Metrobank", code: "MBTCPHMMXXX", icon: "M" },
  { name: "Security Bank", code: "SECBPHMMXXX", icon: "S" },
];

export default function SendMoney({ navigate }: SendMoneyProps) {
  const { user, isAdmin, logout } = useAuth();
  const isPadalaOnlyUser = Boolean(user && !isAdmin && user.email?.startsWith('user@'));
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", allowed: !isPadalaOnlyUser },
    { icon: Clock, label: "Attendance", id: "attendance", allowed: !isPadalaOnlyUser },
    { icon: ShoppingCart, label: "Cashier", id: "pos", allowed: !isPadalaOnlyUser },
    { icon: ClipboardList, label: "Orders", id: "orders", allowed: !isPadalaOnlyUser },
    { icon: SmartphoneNfc, label: "GCash Tracker", id: "gcash", allowed: !isPadalaOnlyUser },
    { icon: Package, label: "Inventory", id: "inventory", allowed: !isPadalaOnlyUser && isAdmin },
    { icon: History, label: "Transactions", id: "transactions", allowed: !isPadalaOnlyUser },
    { icon: Users, label: "SUKICARD MEMBERS", id: "customers", allowed: !isPadalaOnlyUser && isAdmin },
    { icon: IdCard, label: "SUKICARD Generator", id: "generator", allowed: !isPadalaOnlyUser && isAdmin },
    { icon: Printer, label: "Printing Sales", id: "printing", allowed: !isPadalaOnlyUser && isAdmin },
    { icon: CreditCard, label: "Credit Tracker", id: "credit-tracker", allowed: !isPadalaOnlyUser && isAdmin },
    { icon: Briefcase, label: "SOS CREDIT", id: "sos-credit", allowed: !isPadalaOnlyUser && isAdmin },
    { icon: SmartphoneNfc, label: "Pera Padala", id: "send-money", allowed: true },
    { icon: Settings, label: "Settings", id: "settings", allowed: !isPadalaOnlyUser && isAdmin }
  ];

  const filteredTransactions = transactions.filter(tx => {
    if (startDate && tx.createdAt) {
      if (new Date(tx.createdAt) < new Date(startDate)) return false;
    }
    if (endDate && tx.createdAt) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(tx.createdAt) > end) return false;
    }
    return true;
  });

  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "transactions", recordToDelete));
      setTransactions((prev) => prev.filter((tx) => tx.id !== recordToDelete));
    } catch (err) {
      console.error("Failed to delete record:", err);
    } finally {
      setRecordToDelete(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecordToDelete(id);
  };

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoadingTx(true);
    try {
      // Async sync from PayMongo for pending records
      const baseUrl = import.meta.env.VITE_API_URL || "";
      axios.post(`${baseUrl}/api/debug-refund`).catch(() => {});
      axios.get(`${baseUrl}/api/sync-transfers`).catch(() => {});
      
      const q = query(
        collection(db, "transactions"),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map((doc) => {
        const data = doc.data();

        // Sync pending PayMongo transfer status continuously
        if (data.status === "pending" && data.metadata?.transferId) {
          axios
            .get(`${baseUrl}/api/paymongo-transfer/${data.metadata.transferId}`)
            .then(async (res) => {
              const transferStatus =
                res.data?.data?.status || res.data?.data?.attributes?.status;
              if (transferStatus && transferStatus !== "pending") {
                const isFailed =
                  transferStatus === "failed" || transferStatus === "rejected";
                const isCompleted =
                  transferStatus === "completed" ||
                  transferStatus === "succeeded";

                if (isFailed || isCompleted) {
                  const newStatus = isFailed ? "failed" : "completed";
                  const failMsg = isFailed
                    ? res.data?.data?.provider_error_message ||
                      res.data?.data?.failure_reason ||
                      "Failed at PayMongo"
                    : undefined;

                  const { doc: firestoreDoc, updateDoc } = await import(
                    "firebase/firestore"
                  );
                  await updateDoc(firestoreDoc(db, "transactions", doc.id), {
                    status: newStatus,
                    ...(failMsg ? { failureMessage: failMsg } : {}),
                  });
                  console.log(
                    `Updated pending transfer ${doc.id} to ${newStatus}`,
                  );
                }
              }
            })
            .catch(() => {});
        }

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : null,
        };
      });
      let filtered = fetched;
      if (!isAdmin) {
        filtered = fetched.filter(tx => (tx.metadata?.senderUsername || "User") === (user?.customUsername || user?.name || "User"));
      }
      setTransactions(filtered);
    } catch (e: any) {
      console.error("Failed to load transactions:", e.message);
    } finally {
      setLoadingTx(false);
    }
  };

  const fetchBalance = async () => {
    setLoadingBalance(true);
    setErrorMessage("");
    try {
      // ✅ FIXED: Dynamically injects VITE_API_URL route to map directly out to your Render server
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const response = await axios.get(`${baseUrl}/api/paymongo-balance`);
      setBalance(response.data.balance || 0);
    } catch (error: any) {
      console.error("Failed to fetch balance:", error);
      const msg =
        error.response?.data?.error ||
        error.response?.data?.errors?.[0]?.detail ||
        "Failed to sync with PayMongo. Verify your API credentials.";
      setErrorMessage(msg);
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const calculateFee = (amt: number): number => {
    if (amt >= 1 && amt <= 200) return 15;
    if (amt >= 201 && amt <= 1000) return 20;
    if (amt >= 1001 && amt <= 1500) return 30;
    if (amt >= 1501 && amt <= 2000) return 40;
    if (amt >= 2001 && amt <= 2500) return 50;
    if (amt >= 2501 && amt <= 3000) return 60;
    if (amt >= 3001 && amt <= 4000) return 70;
    if (amt >= 4001 && amt <= 5000) return 100;
    if (amt >= 5001 && amt <= 10000) return 200;
    return 10; // default base charge
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    setErrorMessage("");

    const parsedAmount = parseFloat(amount);
    const calculatedFee = calculateFee(parsedAmount);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const response = await axios.post(`${baseUrl}/api/create-batch-transfer`, {
        recipientAccountNumber: accountNumber,
        recipientAccountName: accountName,
        recipientBankBic: provider.code,
        amountInPesos: parsedAmount,
        description: description,
      });

      if (response.data.success) {
        setStatus("success");
        try {
          const transfers = response.data.data?.transfers || response.data.data?.attributes?.transfers || [];
          const transferStatus = transfers[0]?.status || transfers[0]?.attributes?.status;
          const txStatus = (transferStatus === "completed" || transferStatus === "processing" || transferStatus === "queued" || transferStatus === "pending") ? "completed" : "pending";
          
          await addDoc(collection(db, "transactions"), {
            amount: parsedAmount * 100, // store in cents
            currency: "PHP",
            status: txStatus,
            type: "payout",
            metadata: {
              account: accountNumber,
              name: accountName,
              bic: provider.code,
              description: description || "Pera Padala via Instapay",
              transferId: transfers[0]?.id || null,
              senderUsername: user?.customUsername || user?.name || "User",
              fee: calculatedFee
            },
            createdAt: serverTimestamp(),
            senderId: auth.currentUser?.uid || "anonymous_user",
            recipientId: "external",
          });
          setTimeout(fetchTransactions, 500);
        } catch (dbError) {
          console.error(
            "Successfully transferred but failed to log transaction:",
            dbError,
          );
        }
      }
    } catch (error: any) {
      setStatus("error");
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.errors?.[0]?.detail ||
        "Transfer failed. Please check your credentials and recipient info.";
      setErrorMessage(errorMsg);

      // Log the failed transaction to Firestore
      try {
        await addDoc(collection(db, "transactions"), {
          amount: parsedAmount * 100, // store in cents
          currency: "PHP",
          status: "failed",
          type: "payout",
          metadata: {
            account: accountNumber,
            name: accountName,
            bic: provider.code,
            description: description || "Pera Padala via Instapay",
            failureMessage: errorMsg,
            senderUsername: user?.customUsername || user?.name || "User",
            fee: calculatedFee
          },
          createdAt: serverTimestamp(),
          senderId: auth.currentUser?.uid || "anonymous_user",
          recipientId: "external",
        });
        // Wait briefly for firestore, then fetch
        setTimeout(fetchTransactions, 500);
      } catch (dbError) {
        console.error("Failed to log failed transaction:", dbError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#111218] border border-white/5 p-10 rounded-[2.5rem] w-full max-w-md text-center space-y-6 shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              Transfer Successful
            </h2>
            <p className="text-slate-500 text-sm font-bold">
              PHP {parseFloat(amount).toLocaleString()} has been sent to{" "}
              {accountName}.
            </p>
          </div>
          {!isPadalaOnlyUser && (
            <button
              onClick={() => navigate("dashboard")}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all font-sans"
            >
              Back to Dashboard
            </button>
          )}

          <button
            onClick={() => {
              setStatus("idle");
              setAmount("");
              setAccountName("");
              setAccountNumber("");
              setDescription("");
              fetchBalance();
              fetchTransactions();
            }}
            className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all font-sans ${isPadalaOnlyUser ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20' : 'bg-white/5 hover:bg-white/10 text-slate-300'}`}
          >
            Make Another Transfer
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-500 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

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
            const isActive = 'send-money' === item.id;
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
          <div className="bg-white/50 backdrop-blur-md rounded-[1.5rem] p-4 border border-slate-200 dark:bg-[#1c1d26]/50 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center font-black text-slate-600 dark:text-white shadow-inner">
                {user?.customUsername?.charAt(0) || user?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{user?.customUsername || user?.name || "User"}</p>
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
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto max-h-screen relative z-10 scrollbar-hide min-w-0">
        <div className="max-w-xl mx-auto px-6 py-6 lg:py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 rounded-xl transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              {isPadalaOnlyUser ? null : (
                <button
                  onClick={() => navigate("dashboard")}
                  className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all border border-slate-200 dark:border-white/5"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              )}
            </div>
            <div className="text-right">
              <h1 className="text-lg font-black uppercase tracking-tighter leading-none text-slate-900 dark:text-white">
                PayMongo
              </h1>
              <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-1">
                Pera Padala
              </p>
            </div>
          </div>


        {/* Balance Dashboard Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden mb-8"
        >
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px]" />

          <div className="relative bg-[#111218] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden group">
            {/* Subtle Grid Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                    <Wallet className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    PayMongo Wallet Balance
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-center md:justify-start gap-2">
                    <span className="text-xl font-black text-indigo-500 opacity-50">
                      ₱
                    </span>
                    <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter tabular-nums leading-none">
                      {loadingBalance ? (
                        <div className="w-48 h-12 bg-white/5 animate-pulse rounded-2xl" />
                      ) : balance === null ? (
                        <span className="text-slate-700">--.---</span>
                      ) : (
                        balance.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      )}
                    </h2>
                  </div>
                  {balance !== null && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-center md:justify-start gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">
                        Live Sync Enabled
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={fetchBalance}
                  disabled={loadingBalance}
                  className="p-6 bg-white/5 hover:bg-white/10 rounded-3xl border border-white/10 transition-all group/btn active:scale-95 disabled:opacity-50 relative overflow-hidden"
                >
                  <RefreshCw
                    className={`w-8 h-8 text-indigo-400 group-hover/btn:rotate-180 transition-transform duration-700 ${loadingBalance ? "animate-spin" : ""}`}
                  />
                  {loadingBalance && (
                    <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
                  )}
                </button>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                  Sync Wallet
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleTransfer}
          className="bg-[#111218] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-8"
        >
          <div className="flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
            <Lock className="w-4 h-4 text-indigo-500 shrink-0" />
            <p className="text-[9px] font-bold text-indigo-200/70 uppercase leading-relaxed tracking-wider">
              Payments are handled securely via PayMongo Instapay Real-time
              transfers.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Transfer Amount (PHP)
              </label>
              <div className="relative group">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-lg font-black placeholder-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                />
              </div>
              {amount && (
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex justify-between items-center px-4 py-3 bg-[#111218] rounded-xl border border-white/5 shadow-inner">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service Fee (+ ₱{calculateFee(parseFloat(amount) || 0)})</span>
                    <span className="text-sm font-black text-rose-400 tabular-nums">
                      ₱{calculateFee(parseFloat(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-inner">
                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Amount to Pay</span>
                    <span className="text-xl font-black text-emerald-400 tabular-nums leading-none">
                      ₱{((parseFloat(amount) || 0) + calculateFee(parseFloat(amount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-inner">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-500">Net Profit</span>
                    <span className="text-xl font-black text-amber-500 tabular-nums leading-none">
                      ₱{(Math.max(0, calculateFee(parseFloat(amount) || 0) - 10)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Recipient Name
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    required
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="FULL NAME"
                    className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-black placeholder-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Account Number
                </label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    required
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="0000 0000 00"
                    className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-black placeholder-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Provider / Bank
              </label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                <select
                  required
                  value={provider.code}
                  onChange={(e) => {
                    const selected = PROVIDERS.find(
                      (p) => p.code === e.target.value,
                    );
                    if (selected) setProvider(selected);
                  }}
                  className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-10 text-white text-xs font-black placeholder-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase appearance-none cursor-pointer"
                >
                  {PROVIDERS.map((p) => (
                    <option
                      key={p.code}
                      value={p.code}
                      className="bg-[#111218] text-white py-2"
                    >
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                  <RefreshCw className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Purpose of Transaction
              </label>
              <div className="relative">
                <select
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 px-6 text-white text-[10px] font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase appearance-none cursor-pointer"
                >
                  <option value="" disabled className="bg-[#111218] text-white py-2">SELECT PURPOSE</option>
                  <option value="Allowance" className="bg-[#111218] text-white py-2">Allowance</option>
                  <option value="Salary" className="bg-[#111218] text-white py-2">Salary</option>
                  <option value="Payment of Customer" className="bg-[#111218] text-white py-2">Payment of Customer</option>
                  <option value="Bills Payment" className="bg-[#111218] text-white py-2">Bills Payment</option>
                  <option value="Personal / Other" className="bg-[#111218] text-white py-2">Personal / Other</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {status === "error" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-tight leading-relaxed">
                  {errorMessage}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            disabled={isSubmitting}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing Transfer...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                Send PHP {amount ? parseFloat(amount).toLocaleString() : "0.00"}{" "}
                Now
              </>
            )}
          </button>
        </motion.form>

        {/* Transaction History Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-10"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Transaction History
            </h2>
            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/5 p-2 shrink-0">
                <input type="date" className="bg-transparent text-[10px] uppercase font-black tracking-widest text-slate-400 focus:outline-none [color-scheme:dark]" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-[10px] text-slate-500 font-bold uppercase">To</span>
                <input type="date" className="bg-transparent text-[10px] uppercase font-black tracking-widest text-slate-400 focus:outline-none [color-scheme:dark]" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <button
                onClick={fetchTransactions}
                disabled={loadingTx}
                className="p-2.5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-400 ${loadingTx ? "animate-spin text-indigo-400" : ""}`}
                />
              </button>
            </div>
          </div>

          {!loadingTx && filteredTransactions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#111218] border border-white/5 rounded-[1.5rem] p-6 flex flex-col justify-between min-h-[140px] group hover:-translate-y-1 hover:border-emerald-500/30 transition-all shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Account Executive</span>
                    <div className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter truncate">
                      {user?.customUsername || user?.name || "User"}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-inner">
                    <User className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5 z-10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Session
                </div>
                <div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
              </div>
              
              <div className="bg-[#111218] border border-white/5 rounded-[1.5rem] p-6 flex flex-col justify-between min-h-[140px] group hover:-translate-y-1 hover:border-rose-500/30 transition-all shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-400/80">Total Fees Collected</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-slate-500">₱</span>
                      <span className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter tabular-nums leading-none">
                        {(filteredTransactions.filter(tx => tx.status === 'completed' || tx.status === 'succeeded').reduce((sum, tx) => sum + (tx.metadata?.fee || 10), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-inner">
                    <Activity className="w-5 h-5 text-rose-400" />
                  </div>
                </div>
                <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5 z-10">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Dynamic Fee Pool
                </div>
                <div className="absolute right-0 bottom-0 w-32 h-32 bg-rose-500/5 rounded-full blur-[40px] group-hover:bg-rose-500/10 transition-all pointer-events-none" />
              </div>

              <div className="bg-gradient-to-br from-[#111218] to-[#151623] border border-indigo-500/20 rounded-[1.5rem] p-8 flex flex-col justify-between min-h-[160px] group hover:-translate-y-1 hover:border-indigo-500/40 transition-all shadow-xl shadow-indigo-900/20 relative overflow-hidden">
                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/80">Total Value Deducted</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-indigo-500">₱</span>
                      <span className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter tabular-nums leading-none">
                        {(
                          filteredTransactions.filter(tx => tx.status === 'completed' || tx.status === 'succeeded')
                          .reduce((sum, tx) => sum + (tx.amount / 100) + 10, 0)
                        ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
                    <Banknote className="w-6 h-6 text-indigo-400" />
                  </div>
                </div>
                <div className="text-[10px] font-bold text-indigo-300/60 uppercase mt-4 flex items-center gap-2 z-10">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Base 10.00 PHP System Deduction Applied
                </div>
                <div className="absolute right-0 bottom-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
              </div>

              <div className="bg-gradient-to-br from-[#111218] to-[#181511] border border-amber-500/20 rounded-[1.5rem] p-8 flex flex-col justify-between min-h-[160px] group hover:-translate-y-1 hover:border-amber-500/40 transition-all shadow-xl shadow-amber-900/20 relative overflow-hidden">
                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/80">Net Profit</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-amber-500">₱</span>
                      <span className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter tabular-nums leading-none">
                        {(
                          filteredTransactions.filter(tx => tx.status === 'completed' || tx.status === 'succeeded')
                          .reduce((sum, tx) => sum + Math.max(0, (tx.metadata?.fee || 10) - 10), 0)
                        ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <div className="text-[10px] font-bold text-amber-300/60 uppercase mt-4 flex items-center gap-2 z-10">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Total Revenue Less System Deduction
                </div>
                <div className="absolute right-0 bottom-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] group-hover:bg-amber-500/20 transition-all pointer-events-none" />
              </div>
            </div>
          )}

          <div className="bg-[#111218] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            {loadingTx && transactions.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  No Transactions Found
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedRecord(tx)}
                    className="p-6 hover:bg-white/[0.02] transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-2xl ${
                          ["completed", "pending", "processing", "queued", "succeeded"].includes(tx.status)
                            ? "bg-emerald-500/10 text-emerald-500"
                            : tx.status === "failed"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {["completed", "pending", "processing", "queued", "succeeded"].includes(tx.status) ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : tx.status === "failed" ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                          {tx.metadata?.name || "Unknown Recipient"}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mt-0.5">
                          {tx.type} •{" "}
                          {tx.metadata?.bic || tx.metadata?.account || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div
                          className={`text-base font-black tracking-tight tabular-nums ${
                            tx.status === "failed"
                              ? "text-slate-500 line-through"
                              : "text-white"
                          }`}
                        >
                          - ₱
                          {(Number(tx.amount || 0) / 100).toLocaleString(
                            undefined,
                            { minimumFractionDigits: 2 },
                          )}
                        </div>
                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                          {tx.createdAt
                            ? new Date(tx.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "-"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, tx.id)}
                        className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl opacity-0 md:group-hover:opacity-100 transition-all active:scale-95 border border-rose-500/10"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {recordToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setRecordToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111218] border border-rose-500/20 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Delete Record</h3>
              <p className="text-sm font-medium text-slate-400 mb-8">
                Are you sure you want to delete this record? This action cannot be undone.
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setRecordToDelete(null)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111218] border border-white/10 p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              <button
                onClick={() => setSelectedRecord(null)}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="overflow-y-auto pr-2 -mr-2 space-y-6">
                <div className="mb-2 pr-12 pt-2">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
                      ["completed", "pending", "processing", "queued", "succeeded"].includes(selectedRecord.status)
                        ? "bg-emerald-500/10 text-emerald-500"
                        : selectedRecord.status === "failed"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {["completed", "pending", "processing", "queued", "succeeded"].includes(selectedRecord.status) ? (
                      <CheckCircle2 className="w-8 h-8" />
                    ) : selectedRecord.status === "failed" ? (
                      <AlertCircle className="w-8 h-8" />
                    ) : (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                    Transaction Details
                  </h3>
                </div>

                <div className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#15161d] p-4 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Status
                    </span>
                    <span
                      className={`text-sm font-black uppercase tracking-widest ${["completed", "pending", "processing", "queued", "succeeded"].includes(selectedRecord.status) ? "text-emerald-500" : selectedRecord.status === "failed" ? "text-rose-500" : "text-amber-500"}`}
                    >
                      {["completed", "pending", "processing", "queued", "succeeded"].includes(selectedRecord.status) ? "COMPLETED" : selectedRecord.status}
                    </span>
                  </div>
                  <div className="bg-[#15161d] p-4 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Processed By
                    </span>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-200 truncate block">
                      {selectedRecord.metadata?.senderUsername || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="bg-[#15161d] p-5 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Send Amount</span>
                    <span className="text-sm font-black text-white tabular-nums">
                      ₱{(Number(selectedRecord.amount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service Fee</span>
                    <span className="text-sm font-black text-rose-400 tabular-nums">
                      + ₱{(selectedRecord.metadata?.fee || 10).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Amount to Pay</span>
                    <span className="text-xl font-black text-emerald-400 tabular-nums leading-none">
                      ₱{((Number(selectedRecord.amount || 0) / 100) + (selectedRecord.metadata?.fee || 10)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Total Deducted</span>
                    <span className="text-sm font-black text-indigo-400 tabular-nums">
                      ₱{((Number(selectedRecord.amount || 0) / 100) + 10).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-500">Net Profit</span>
                    <span className="text-xl font-black text-amber-400 tabular-nums">
                      ₱{Math.max(0, (selectedRecord.metadata?.fee || 10) - 10).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="bg-[#15161d] p-5 rounded-2xl border border-white/5 space-y-4">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Recipient Name
                    </span>
                    <span className="text-sm font-bold text-slate-200 uppercase">
                      {selectedRecord.metadata?.name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Account Number
                    </span>
                    <span className="text-sm font-bold text-slate-200">
                      {selectedRecord.metadata?.account || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Bank / Provider
                    </span>
                    <span className="text-sm font-bold text-slate-200 uppercase">
                      {selectedRecord.metadata?.bic || "N/A"}
                    </span>
                  </div>
                  {selectedRecord.metadata?.description && (
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                        Description
                      </span>
                      <span className="text-xs font-medium text-slate-300 uppercase">
                        {selectedRecord.metadata?.description}
                      </span>
                    </div>
                  )}
                  {selectedRecord.metadata?.failureMessage && (
                    <div className="pt-2 mt-2 border-t border-rose-500/10">
                      <span className="text-[9px] font-black uppercase text-rose-500 block mb-1">
                        Failure Reason
                      </span>
                      <span className="text-xs font-medium text-rose-400/80 uppercase">
                        {selectedRecord.metadata?.failureMessage}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1 mt-4">
                      Date & Time
                    </span>
                    <span className="text-xs font-medium text-slate-300">
                      {selectedRecord.createdAt
                        ? new Date(selectedRecord.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "-"}
                    </span>
                  </div>
                  {selectedRecord.id && (
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                        Reference Number
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {selectedRecord.id}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}