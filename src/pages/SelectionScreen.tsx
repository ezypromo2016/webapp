import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, CreditCard, Lock, Fingerprint, ArrowRight, Loader2, ShieldCheck, Mail, User, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { API } from "../lib/api";

interface SelectionScreenProps {
  onSelect: (module: "dashboard" | "credit-tracker", borrowerId?: string) => void;
}

export default function SelectionScreen({ onSelect }: SelectionScreenProps) {
  const { user, login, logout } = useAuth();
  const [step, setStep] = useState<"selection" | "verify-dashboard" | "verify-credit">("selection");
  const [password, setPassword] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleDashboardVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      // Re-verify password by attempting login with current user's email
      if (user?.email) {
        await login(user.email, password);
        onSelect("dashboard");
      }
    } catch (err: any) {
      setError("Security credentials invalid. Please enter your login password.");
    } finally {
      setIsVerifying(false);
    }
  };

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

  const handleCreditVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);
    
    try {
      // Fetch all records to check if ID exists
      const res = await API.get("/credits");
      const records = res.data || [];
      
      const inputId = accountId.trim().replace(/^#/, "").toUpperCase();
      
      const foundMatch = records.some((r: any) => {
        const resolvedId = resolveBorrowerId(r.borrower_name, r.borrower_id, records);
        return resolvedId.toUpperCase() === inputId;
      });

      if (foundMatch) {
        onSelect("credit-tracker", inputId);
      } else {
        setError("Access Denied: Account User ID not found in our records.");
      }
    } catch (err) {
      setError("Connection error. Please try again later.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 lg:p-10 font-sans overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl relative z-10 py-8"
      >
        <div className="text-center mb-8 md:mb-12">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-4 md:mb-6"
          >
            <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-emerald-500" />
            <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Access Verification Required</span>
          </motion.div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-tighter mb-2">Initialize <span className="text-indigo-500">Module</span></h1>
          <p className="text-[9px] md:text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em]">Select your operational workspace to continue</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "selection" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                {/* Dashboard Card */}
                <motion.button
                  key="dash-card"
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  onClick={() => setStep("verify-dashboard")}
                  className="group relative bg-[#15161d] border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 text-left overflow-hidden transition-all hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-indigo-600/10 blur-3xl rounded-full group-hover:bg-indigo-600/20 transition-all" />
                  <div className="flex justify-between items-start mb-6 md:mb-10">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                      <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Module Status</p>
                      <p className="text-xs md:text-sm font-black text-emerald-500 uppercase">Operational</p>
                    </div>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mb-2">Dashboard</h3>
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold leading-relaxed uppercase tracking-wide mb-4 md:mb-6">Global Audit, Inventory, Analysis & Core POS Terminal Access</p>
                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 md:pt-6">
                     <div>
                       <p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase tracking-widest">Active nodes</p>
                       <p className="text-base md:text-lg font-black text-white">12</p>
                     </div>
                     <div>
                       <p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase tracking-widest">Uptime</p>
                       <p className="text-base md:text-lg font-black text-white">99.9%</p>
                     </div>
                  </div>
                  <div className="mt-6 md:mt-8 flex items-center gap-2 text-[9px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-[-10px] sm:group-hover:translate-x-0">
                    Verify Credentials <ArrowRight className="w-3 h-3" />
                  </div>
                </motion.button>

                {/* Credit Tracker Card */}
                <motion.button
                  key="credit-card"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  onClick={() => setStep("verify-credit")}
                  className="group relative bg-[#15161d] border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 text-left overflow-hidden transition-all hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/20"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-emerald-600/10 blur-3xl rounded-full group-hover:bg-emerald-600/20 transition-all" />
                  <div className="flex justify-between items-start mb-6 md:mb-10">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:scale-110 transition-transform">
                      <CreditCard className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Account Status</p>
                      <p className="text-xs md:text-sm font-black text-indigo-500 uppercase">Secured</p>
                    </div>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mb-2">Credit Tracker</h3>
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold leading-relaxed uppercase tracking-wide mb-4 md:mb-6">Borrower Registry, Loan Management & Credit History Protocols</p>
                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 md:pt-6">
                     <div>
                       <p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase tracking-widest">Verified Users</p>
                       <p className="text-base md:text-lg font-black text-white">850+</p>
                     </div>
                     <div>
                       <p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase tracking-widest">Protocol</p>
                       <p className="text-base md:text-lg font-black text-white">v3.4</p>
                     </div>
                  </div>
                  <div className="mt-6 md:mt-8 flex items-center gap-2 text-[9px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-[-10px] sm:group-hover:translate-x-0">
                    Verify Identity <ArrowRight className="w-3 h-3" />
                  </div>
                </motion.button>
              </div>
              
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-12 flex justify-center"
              >
                <button 
                  onClick={() => logout()}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-xl shadow-rose-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Session
                </button>
              </motion.div>
            </>
          ) : (
            <motion.div
              key="verification-form"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-[#15161d] border border-white/10 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
                {/* Visual indicator for current module */}
                <div className={`absolute top-0 left-0 w-1 h-full ${step === "verify-dashboard" ? "bg-indigo-600" : "bg-emerald-600"}`} />
                
                <div className="flex items-center gap-4 mb-6 md:mb-8">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${step === "verify-dashboard" ? "bg-indigo-600/10 text-indigo-500" : "bg-emerald-600/10 text-emerald-500"}`}>
                    {step === "verify-dashboard" ? <Lock className="w-5 h-5 md:w-6 md:h-6" /> : <Fingerprint className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-white uppercase tracking-tight">Security Protocol</h3>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {step === "verify-dashboard" ? "Confirm Account Password" : "Verify Account User ID"}
                    </p>
                  </div>
                </div>

                <form onSubmit={step === "verify-dashboard" ? handleDashboardVerify : handleCreditVerify} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      {step === "verify-dashboard" ? "Account Password" : "Account User ID"}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors">
                        {step === "verify-dashboard" ? <Mail className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <input
                        autoFocus
                        type={step === "verify-dashboard" ? "password" : "text"}
                        required
                        value={step === "verify-dashboard" ? password : accountId}
                        onChange={(e) => step === "verify-dashboard" ? setPassword(e.target.value) : setAccountId(e.target.value)}
                        placeholder={step === "verify-dashboard" ? "Enter login password" : "Enter 6-digit Account ID"}
                        className="w-full bg-[#1c1d26] border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-black uppercase tracking-widest"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-500 text-[10px] font-black uppercase tracking-widest leading-relaxed"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-col gap-3">
                    <button
                      disabled={isVerifying}
                      type="submit"
                      className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl ${
                        step === "verify-dashboard" 
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20" 
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                      }`}
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      Confirm Credentials
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("selection");
                        setError(null);
                        setPassword("");
                        setAccountId("");
                      }}
                      className="w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors"
                    >
                      Back to Selection
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
