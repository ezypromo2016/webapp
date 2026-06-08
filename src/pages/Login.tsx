import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { Store, Mail, Lock, Loader2, AlertCircle, WifiOff, Zap } from "lucide-react";

export default function Login() {
  const { login, loginOffline } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      await login(trimmedEmail, password);
    } catch (err: any) {
      console.error("Auth Exception:", err);
      const code = err.code || "";
      const message = err.message || "";
      
      if (
        code === 'auth/invalid-credential' || 
        code === 'auth/user-not-found' || 
        code === 'auth/wrong-password' ||
        message.toLowerCase().includes('invalid-credential') ||
        message.toLowerCase().includes('wrong-password')
      ) {
        setError("Incorrect security key or username.");
      } else if (code === 'auth/email-already-in-use') {
        setError("This email is already in use. Please try logging in instead.");
      } else if (code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else if (code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please try again later or reset your password.");
      } else if (code === 'auth/network-request-failed') {
        setError("Network error detected. Your internet might be blocked or Google servers are unreachable. You can use 'Emergency Offline Mode' to continue working.");
      } else {
        setError(err.message || "Authentication failed. Please check your internet connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 font-sans text-slate-200 transition-colors duration-300 dark:bg-[#0a0a0f] dark:text-slate-200 light:bg-[#f8f9fa] light:text-slate-900">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-[#15161d] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden relative dark:bg-[#15161d] dark:border-white/10 light:bg-white light:border-slate-200 light:shadow-xl light:shadow-slate-200/50">
          {/* Decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 blur-3xl rounded-full dark:block light:hidden" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 blur-3xl rounded-full dark:block light:hidden" />

          <div className="text-center mb-6 relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/20 mb-3">
              <Store className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-white mb-1 uppercase tracking-widest dark:text-white light:text-slate-900">CBKPOS</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-slate-500 light:text-slate-500">
              "Management Portal"
            </p>
          </div>

          {isOffline && (
            <div className="mb-5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-amber-500 text-[9px] font-bold uppercase tracking-wider">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Offline connection active</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 relative">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">USERNAME (Email)</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1c1d26] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-bold"
                  placeholder="admin@pos.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Security Key (Password)</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1c1d26] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>



            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex flex-col gap-2 text-rose-500 text-[9px] font-bold uppercase tracking-wider overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {error.includes("Network error") && (
                    <button 
                      type="button"
                      onClick={() => window.location.reload()}
                      className="mt-1 w-fit bg-rose-500 text-white px-3 py-1.5 rounded-md hover:bg-rose-600 transition-colors uppercase tracking-[0.2em] text-[7px]"
                    >
                      Hard Refresh App
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
               type="submit"
               disabled={isSubmitting}
               className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-[0.3em] py-3 px-6 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  ACCOUNT LOGIN
                </>
              )}
            </button>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => loginOffline()}
                className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-[0.2em] py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <WifiOff className="w-4 h-4" />
                Emergency Offline Login
              </button>
              <p className="text-[7px] text-center text-slate-600 mt-2 uppercase tracking-widest leading-relaxed">
                Use offline mode if Google login is blocked in your country <br/> or if you have no internet.
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

          

