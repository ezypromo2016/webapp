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
      axios.post("/api/debug-refund").catch(() => {});
      axios.get("/api/sync-transfers").catch(() => {});
      
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
            .get(`/api/paymongo-transfer/${data.metadata.transferId}`)
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
      setTransactions(fetched);
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
      const response = await axios.get("/api/paymongo-balance");
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

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const response = await axios.post("/api/create-batch-transfer", {
        recipientAccountNumber: accountNumber,
        recipientAccountName: accountName,
        recipientBankBic: provider.code,
        amountInPesos: parseFloat(amount),
        description: description,
      });

      if (response.data.success) {
        setStatus("success");
        try {
          const transfers = response.data.data?.transfers || response.data.data?.attributes?.transfers || [];
          const txStatus = (transfers[0]?.status || transfers[0]?.attributes?.status) === "completed" ? "completed" : "pending";
          
          await addDoc(collection(db, "transactions"), {
            amount: parseFloat(amount) * 100, // store in cents
            currency: "PHP",
            status: txStatus,
            type: "payout",
            metadata: {
              account: accountNumber,
              name: accountName,
              bic: provider.code,
              description: description || "Pera Padala via Instapay",
              transferId: transfers[0]?.id || null
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
          amount: parseFloat(amount) * 100, // store in cents
          currency: "PHP",
          status: "failed",
          type: "payout",
          metadata: {
            account: accountNumber,
            name: accountName,
            bic: provider.code,
            description: description || "Pera Padala via Instapay",
            failureMessage: errorMsg,
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
          <button
            onClick={() => navigate("dashboard")}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all font-sans"
          >
            Back to Dashboard
          </button>

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
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all font-sans"
          >
            Make Another Transfer
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-indigo-500/30">
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("dashboard")}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="text-right">
            <h1 className="text-lg font-black uppercase tracking-tighter leading-none">
              PayMongo
            </h1>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Transaction History
            </h2>
            <button
              onClick={fetchTransactions}
              disabled={loadingTx}
              className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-400 ${loadingTx ? "animate-spin text-indigo-400" : ""}`}
              />
            </button>
          </div>

          <div className="bg-[#111218] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            {loadingTx && transactions.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : transactions.length === 0 ? (
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
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedRecord(tx)}
                    className="p-6 hover:bg-white/[0.02] transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-2xl ${
                          tx.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : tx.status === "failed"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {tx.status === "completed" ? (
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
              className="bg-[#111218] border border-white/10 p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={() => setSelectedRecord(null)}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8 pr-12">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
                    selectedRecord.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : selectedRecord.status === "failed"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-amber-500/10 text-amber-500"
                  }`}
                >
                  {selectedRecord.status === "completed" ? (
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

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#15161d] p-4 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Amount
                    </span>
                    <span className="text-xl font-black text-white tabular-nums">
                      ₱
                      {(Number(selectedRecord.amount || 0) / 100).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                  <div className="bg-[#15161d] p-4 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Status
                    </span>
                    <span
                      className={`text-sm font-black uppercase tracking-widest ${selectedRecord.status === "completed" ? "text-emerald-500" : selectedRecord.status === "failed" ? "text-rose-500" : "text-amber-500"}`}
                    >
                      {selectedRecord.status}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
