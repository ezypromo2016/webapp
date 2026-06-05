import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { Store, Mail, Lock, Loader2, AlertCircle, WifiOff, Zap } from "lucide-react";

export default function Login() {
  const { login, signup, loginWithGoogle, loginOffline } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
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
      if (isRegistering) {
        if (!name.trim()) {
           setError("Please enter your name.");
           setIsSubmitting(false);
           return;
        }
        await signup(trimmedEmail, password, name.trim());
      } else {
        await login(trimmedEmail, password);
      }
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
        if (isRegistering) {
          setError("Your signup request was rejected. The email might be malformed or blocked. If you already have an account, please 'Login' instead.");
        } else {
          setError("Incorrect security key or username. If you haven't created an account yet, please 'Sign Up' first. If you previously used Google Login, please use it again.");
        }
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
              {isRegistering ? "Create New Account" : "Management Portal"}
            </p>
          </div>

          {isOffline && (
            <div className="mb-5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-amber-500 text-[9px] font-bold uppercase tracking-wider">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Offline connection active</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 relative">
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">FULL NAME</label>
                <div className="relative group">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    required={isRegistering}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1c1d26] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-bold"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

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

            <div className="flex justify-end">
               <button 
                 type="button"
                 onClick={() => {
                   setIsRegistering(!isRegistering);
                   setError(null);
                 }}
                 className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
               >
                 {isRegistering ? "Existing User? Login" : "New Account? Sign Up"}
               </button>
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
                  {isRegistering ? "Registering..." : "Authenticating..."}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {isRegistering ? "CREATE ACCOUNT" : "ACCOUNT LOGIN"}
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-[8px] uppercase tracking-[0.3em]">
                <span className="bg-[#15161d] px-2 text-slate-600">Or use socials</span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  await loginWithGoogle();
                } catch (err: any) {
                  if (err.code === 'auth/network-request-failed') {
                    setError("Network error. Please check your internet connection or ad-blocker settings.");
                  } else if (err.code === 'auth/popup-closed-by-user') {
                    setError("Login popup closed. Please try again.");
                  } else {
                    setError("Google authentication failed.");
                  }
                }
              }}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-white text-[9px] font-black uppercase tracking-[0.2em] py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google Sign In
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

          

