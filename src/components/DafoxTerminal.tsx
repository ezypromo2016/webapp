import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, CheckCircle2, Phone, ShoppingCart, RefreshCw, History, Send, Wallet, WifiOff, Search, ArrowLeft, Signal, ChevronRight, Activity, Zap, Trash2, X } from 'lucide-react';
import { DAFOX_PROMOS } from '../lib/dafoxPromos';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DafoxTerminalProps {
  user?: any;
}

export const DafoxTerminal: React.FC<DafoxTerminalProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<"pera-padala" | "cashin" | "records">("pera-padala");
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPromo, setSelectedPromo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // E-Load UX States
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [promoSearchQuery, setPromoSearchQuery] = useState('');

  // Cash-in states
  const [cashinWallet, setCashinWallet] = useState<"GCASH" | "MAYA">("GCASH");
  const [cashinNumber, setCashinNumber] = useState('');
  const [cashinAmount, setCashinAmount] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Local File History State
  const [cashinHistory, setCashinHistory] = useState<any[]>([]);

  const refreshTransactionHistory = async () => {
    try {
      const response = await fetch('/api/dafox/history');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const result = await response.json();
        if (result.success) {
          setCashinHistory(result.data);
        } else {
           console.error("History fetch failed:", result.error);
        }
      } else {
        const text = await response.text();
        console.error("Expected JSON but got:", text.substring(0, 50));
      }
    } catch (error) {
      console.error("Failed to refresh history", error);
    }
  };

  useEffect(() => {
    if (activeTab === 'cashin') {
      refreshTransactionHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchRecords = async () => {
    setIsLoadingRecords(true);
    try {
      const q = query(collection(db, "dafox_transactions"), orderBy("createdAt", "desc"), limit(50));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(data);
    } catch (error) {
      console.error("Error fetching Dafox records:", error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab]);

  const formatPhoneNumber = (input: string) => {
    let cleaned = input.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('63') && cleaned.length === 12) {
      cleaned = '0' + cleaned.substring(2);
    }
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
  };

  const handlePhoneBlur = () => {
    setPhoneNumber(formatPhoneNumber(phoneNumber));
  };

  const handleCashinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashinNumber || !cashinAmount || !isOnline) return;

    setIsSubmitting(true);
    try {
      const cleanPhone = formatPhoneNumber(cashinNumber);
      if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
        alert("Please enter a valid 11-digit mobile number starting with 09.");
        setIsSubmitting(false);
        return;
      }
      
      const val = Number(cashinAmount);
      
      const getShopFee = (amount: number) => {
        if (!amount || amount < 1) return 0;
        if (amount >= 1 && amount <= 100) return 10;
        if (amount >= 101 && amount <= 300) return 15;
        if (amount >= 301 && amount <= 1000) return 20;
        if (amount >= 1001 && amount <= 1500) return 30;
        if (amount >= 1501 && amount <= 2000) return 40;
        if (amount >= 2001 && amount <= 2500) return 50;
        if (amount >= 2501 && amount <= 3000) return 60;
        if (amount >= 3001 && amount <= 4000) return 70;
        if (amount >= 4001 && amount <= 5000) return 100;
        if (amount >= 5001 && amount <= 10000) return 200;
        return 200;
      };

      const getSystemFee = (amount: number) => {
        if (!amount || amount < 10) return 0;
        return Math.floor((amount === 10000 ? 9999 : amount) / 1000) + 2;
      };
      
      const shopFee = getShopFee(val);
      const systemFee = getSystemFee(val);
      const totalPay = val + shopFee; // Collection from customer
      const totalDeduction = val + systemFee; // Deducted from wallet

      const keyword = `${cashinWallet}${val}`;
      const syntaxPayload = `${cleanPhone} ${keyword}`;
      const encodedPayload = encodeURIComponent(syntaxPayload);
      const targetUrl = `https://m.me/dafoxtech?text=${encodedPayload}`;

      await addDoc(collection(db, "dafox_transactions"), {
        phone: cleanPhone,
        promoId: `CASHIN_${cashinWallet}`,
        keyword: keyword,
        price: val,
        shopFee: shopFee,
        systemFee: systemFee,
        totalPay: totalPay,
        totalDeduction: totalDeduction,
        status: "pending_messenger",
        createdAt: serverTimestamp(),
        senderId: user?.uid || "anonymous_user",
        senderUsername: user?.customUsername || user?.name || "User",
      });

      setShowSuccessAnimation(true);
      
      setTimeout(() => {
        window.open(targetUrl, "_blank");
        setCashinNumber('');
        setCashinAmount('');
        refreshTransactionHistory();
        setShowSuccessAnimation(false);
      }, 1500);

    } catch (error: any) {
      alert(`Error: ${error.message || 'Network error'}`);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !selectedPromo) return;

    setIsSubmitting(true);

    try {
      const cleanPhone = formatPhoneNumber(phoneNumber);
      
      if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
        alert("Please enter a valid 11-digit Philippine mobile number starting with 09.");
        setIsSubmitting(false);
        return;
      }
      
      const promo = DAFOX_PROMOS.find(p => p.id === selectedPromo);
      if (!promo) throw new Error("Promo not found");

      const syntaxPayload = `${cleanPhone} ${promo.keyword}`;
      const encodedPayload = encodeURIComponent(syntaxPayload);
      const targetUrl = `https://m.me/dafoxtech?text=${encodedPayload}`;

      await addDoc(collection(db, "dafox_transactions"), {
        phone: cleanPhone,
        promoId: promo.id,
        keyword: promo.keyword,
        price: promo.price,
        status: "pending_messenger",
        createdAt: serverTimestamp(),
        senderId: user?.uid || "anonymous_user",
        senderUsername: user?.customUsername || user?.name || "User",
      });

      setShowSuccessAnimation(true);

      setTimeout(() => {
        window.open(targetUrl, "_blank");
        setPhoneNumber('');
        setSelectedPromo('');
        setShowSuccessAnimation(false);
        setIsSubmitting(false);
      }, 1500);

    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      await deleteDoc(doc(db, "dafox_transactions", recordId));
      setRecords(prev => prev.filter(r => r.id !== recordId));
      setSelectedRecord(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Failed to delete record.");
    }
  };

  const closeRecordDetails = () => {
    setSelectedRecord(null);
    setShowDeleteConfirm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111218] border border-white/5 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="p-8 border-b border-white/5 bg-[#15161d]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">DAFOX Terminal</h2>
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">E-Load & Cash-In Gateway</p>
          </div>
        </div>
        
        {/* Inner Tabs for Dafox */}
        <div className="flex mt-8 bg-black/20 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab("pera-padala")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "pera-padala" ? "bg-orange-500/10 text-orange-400 shadow-sm border border-orange-500/20" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Pera Padala
          </button>
          <button
            onClick={() => setActiveTab("cashin")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "cashin" ? "bg-orange-500/10 text-orange-400 shadow-sm border border-orange-500/20" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Dafox Cash-In
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "records" ? "bg-orange-500/10 text-orange-400 shadow-sm border border-orange-500/20" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Transaction Records
          </button>
        </div>
      </div>

      <div className="p-8">
        {activeTab === "pera-padala" && (
          <div className="space-y-6">
            {!selectedNetwork ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tighter">SELECT PROVIDER</h3>
                    <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Tap a network to continue</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(() => {
                    const TOP_NETWORKS = ['GLOBE', 'TM', 'SMART', 'TNT', 'DITO', 'SUN', 'GCASH', 'MAYA'];
                    const networksData = Array.from(new Set(DAFOX_PROMOS.map(p => p.network))).filter(Boolean) as string[];
                    const sortedNetworks = [
                      ...networksData.filter(n => TOP_NETWORKS.includes(n)).sort((a,b) => TOP_NETWORKS.indexOf(a) - TOP_NETWORKS.indexOf(b)),
                      ...networksData.filter(n => !TOP_NETWORKS.includes(n)).sort()
                    ];

                    return sortedNetworks.map((network) => {
                      const count = DAFOX_PROMOS.filter(p => p.network === network).length;
                      const isTop = TOP_NETWORKS.includes(network);
                      return (
                        <button
                          key={network}
                          onClick={() => {
                            setSelectedNetwork(network);
                            setSelectedPromo('');
                            setPromoSearchQuery('');
                          }}
                          className="relative overflow-hidden group flex flex-col items-start p-5 bg-[#15161d] border border-white/5 rounded-2xl hover:border-orange-500/50 hover:bg-orange-500/10 transition-all text-left"
                        >
                          <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center transition-colors ${
                            isTop ? 'bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white' : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
                          }`}>
                            {isTop ? <Zap className="w-5 h-5" /> : <Signal className="w-5 h-5" />}
                          </div>
                          
                          <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1 line-clamp-1">{network}</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{count} Packages</p>
                          
                          <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                            <ChevronRight className="w-4 h-4 text-orange-500" />
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Header Back Button */}
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setSelectedNetwork(null);
                      setSelectedPromo('');
                      setPromoSearchQuery('');
                    }}
                    className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tighter uppercase">{selectedNetwork} PROMOS</h3>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Enter number & select package</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col h-full gap-6">
                  <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                    {/* Left Column */}
                    <div className="flex flex-col gap-6 md:w-1/3 md:min-w-[320px] shrink-0">
                      <div className="bg-[#15161d] border border-white/5 p-6 rounded-3xl">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                            Customer Mobile Number
                          </label>
                          <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={handlePhoneChange}
                              onBlur={handlePhoneBlur}
                              placeholder="09XXXXXXXXX"
                              required
                              className="w-full bg-[#111218] border border-white/5 rounded-2xl py-5 pl-12 pr-4 text-white text-xl font-black placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all font-mono"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop CTA */}
                      <div className="hidden md:flex flex-col gap-4 mt-auto">
                        <button
                          type="submit"
                          disabled={isSubmitting || !phoneNumber || !selectedPromo}
                          className="w-full relative py-5 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-400 text-white shadow-xl shadow-orange-500/20"
                        >
                          <div className="relative z-10 flex items-center justify-center gap-2">
                            <span>Launch Dafox Messenger</span>
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </button>
                        <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/10">
                          <p className="text-[10px] text-orange-500/80 font-bold uppercase tracking-widest leading-relaxed text-center">
                            Powered by DafoxTech Frontend Gateway • Executes via Messenger URL Prefill
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Column / Promo grid */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#15161d] border border-white/5 p-6 rounded-3xl">
                      <div className="flex items-center justify-between shrink-0 mb-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 hidden sm:block">
                          Select Product / Promo Code
                        </label>
                        <div className="relative w-full sm:w-1/2 sm:max-w-[240px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={promoSearchQuery}
                            onChange={(e) => setPromoSearchQuery(e.target.value)}
                            placeholder="Search promos..."
                            className="w-full bg-[#111218] border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-white text-xs font-bold placeholder-slate-600 focus:outline-none focus:border-orange-500/50 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-2 custom-scrollbar md:h-full max-h-[400px] md:max-h-[500px]">
                        {(() => {
                          let filtered = DAFOX_PROMOS.filter(p => p.network === selectedNetwork);
                          if (promoSearchQuery) {
                            const q = promoSearchQuery.toLowerCase();
                            filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.desc && p.desc.toLowerCase().includes(q)));
                          }
                          
                          if (filtered.length === 0) {
                            return (
                              <div className="col-span-1 md:col-span-2 py-8 text-center bg-[#111218] border border-white/5 rounded-2xl flex flex-col items-center justify-center min-h-[160px]">
                                <Search className="w-8 h-8 text-white/10 mb-3" />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No matching promos</p>
                              </div>
                            );
                          }

                          return filtered.map((promo) => (
                            <div
                              key={promo.id}
                              onClick={() => setSelectedPromo(promo.id)}
                              className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 min-h-[140px] pt-5 ${
                                selectedPromo === promo.id
                                  ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.05)]'
                                  : 'bg-[#111218] border-white/5 hover:border-white/20 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight">{promo.name}</h4>
                                  <p className="text-[10px] font-bold text-slate-400 mt-1.5 leading-relaxed pr-2 line-clamp-3">{promo.desc || '-'}</p>
                                </div>
                                <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${selectedPromo === promo.id ? 'border-orange-500' : 'border-slate-600'}`}>
                                  <div className={`w-2.5 h-2.5 rounded-full transition-colors ${selectedPromo === promo.id ? 'bg-orange-500' : 'bg-transparent'}`} />
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-auto mx-1 pb-1 pt-1">
                                <span className="text-[10px] font-mono font-bold text-orange-400/90 border border-orange-500/20 bg-orange-500/10 px-2 py-1 rounded capitalize tracking-widest">
                                  {promo.keyword.toLowerCase()}
                               </span>
                               {promo.price > 0 && (
                                 <span className="text-base font-black text-white">₱{promo.price.toFixed(2)}</span>
                               )}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Mobile CTA */}
                  <div className="md:hidden flex flex-col gap-4 mt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !phoneNumber || !selectedPromo}
                      className="w-full relative py-5 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-400 text-white shadow-xl shadow-orange-500/20"
                    >
                      <div className="relative z-10 flex items-center justify-center gap-2">
                        <span>Launch Dafox Messenger</span>
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </button>
                    <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/10">
                      <p className="text-[10px] text-orange-500/80 font-bold uppercase tracking-widest leading-relaxed text-center">
                        Powered by DafoxTech Frontend Gateway • Executes via Messenger URL Prefill
                      </p>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </div>
        )}

        {activeTab === "cashin" && (
          <div className="flex flex-col md:flex-row gap-8">
            <form onSubmit={handleCashinSubmit} className="space-y-6 w-full md:w-[400px] shrink-0">
              {!isOnline && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                  <WifiOff className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black text-rose-600">Connection Lost</h4>
                    <p className="text-xs text-rose-500 font-bold mt-1">Dafox API requires an active terminal connection. Please reconnect.</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Target Wallet
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCashinWallet("GCASH")}
                    className={`py-4 rounded-xl border text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${cashinWallet === "GCASH" ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-inner" : "bg-[#15161d] border-white/5 text-slate-500 hover:border-white/20"}`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full ${cashinWallet === "GCASH" ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      <span className="text-[12px] -mt-0.5 font-bold tracking-normal">G</span>
                    </div>
                    GCash
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashinWallet("MAYA")}
                    className={`py-4 rounded-xl border text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${cashinWallet === "MAYA" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-inner" : "bg-[#15161d] border-white/5 text-slate-500 hover:border-white/20"}`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full ${cashinWallet === "MAYA" ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      <span className="text-[12px] -mt-0.5 font-bold tracking-normal">M</span>
                    </div>
                    Maya
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Wallet Number
                </label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="tel"
                    value={cashinNumber}
                    onChange={(e) => setCashinNumber(e.target.value)}
                    onBlur={() => setCashinNumber(formatPhoneNumber(cashinNumber))}
                    placeholder="09XXXXXXXXX"
                    required
                    disabled={!isOnline}
                    className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-lg font-black placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Amount (PHP)
                  </label>
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-600 group-focus-within:text-orange-500 transition-colors">₱</span>
                    <input
                      type="number"
                      value={cashinAmount}
                      onChange={(e) => setCashinAmount(e.target.value)}
                      placeholder="1000.00"
                      required
                      disabled={!isOnline}
                      min="1"
                      className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-lg font-black placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all font-mono"
                    />
                  </div>
                </div>

                {(() => {
                  const val = Number(cashinAmount) || 0;
                  if (val < 1) return null;
                  
                  const getShopFee = (amount: number) => {
                    if (!amount || amount < 1) return 0;
                    if (amount >= 1 && amount <= 100) return 10;
                    if (amount >= 101 && amount <= 300) return 15;
                    if (amount >= 301 && amount <= 1000) return 20;
                    if (amount >= 1001 && amount <= 1500) return 30;
                    if (amount >= 1501 && amount <= 2000) return 40;
                    if (amount >= 2001 && amount <= 2500) return 50;
                    if (amount >= 2501 && amount <= 3000) return 60;
                    if (amount >= 3001 && amount <= 4000) return 70;
                    if (amount >= 4001 && amount <= 5000) return 100;
                    if (amount >= 5001 && amount <= 10000) return 200;
                    return 200;
                  };

                  const getSystemFee = (amount: number) => {
                    if (!amount || amount < 10) return 0;
                    return Math.floor((amount === 10000 ? 9999 : amount) / 1000) + 2;
                  };
                  
                  const shopFee = getShopFee(val);
                  const systemFee = getSystemFee(val);
                  return (
                    <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-widest">Base Amount</span>
                        <span className="text-white font-mono">₱{val.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-widest">Store Convenience Fee</span>
                        <span className="text-orange-400 font-mono">₱{shopFee.toFixed(2)}</span>
                      </div>
                      <div className="h-px w-full bg-white/5 my-2"></div>
                      <div className="flex justify-between items-center text-sm font-black mb-3">
                        <span className="text-white uppercase tracking-widest">Total Collection</span>
                        <span className="text-emerald-400 font-mono">₱{(val + shopFee).toFixed(2)}</span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl mt-3 flex justify-between items-center text-[10px]">
                        <div>
                          <span className="text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Dafox System Fee: ₱{systemFee.toFixed(2)}</span>
                          <span className="text-slate-500 font-bold uppercase tracking-widest block">Wallet Deduction</span>
                        </div>
                        <span className="text-slate-300 font-mono text-[11px]">₱{(val + systemFee).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !cashinNumber || !cashinAmount || !isOnline}
                className="w-full relative py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-400 text-white shadow-xl shadow-orange-500/20"
              >
                <div className="relative z-10 flex items-center justify-center gap-2">
                  <span>Execute Cash-In</span>
                  <Send className="w-4 h-4" />
                </div>
              </button>
              <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/10 mb-8 md:mb-0">
                <p className="text-[10px] text-orange-500/80 font-bold uppercase tracking-widest leading-relaxed text-center">
                  Powered by DafoxTech Frontend Gateway • Executes via Messenger URL Prefill
                </p>
              </div>
            </form>

            {/*  Live Transaction Ledger  */}
            <div className="flex-1 flex flex-col pt-8 md:pt-0 border-t md:border-t-0 md:border-l border-white/5 md:pl-8 min-h-0 h-[500px]">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <span className="text-xl">📊</span> Live Transaction Ledger
                </h3>
                <button 
                  type="button"
                  onClick={refreshTransactionHistory} 
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-slate-400"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div id="history-logs-container" className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
                {cashinHistory.length === 0 ? (
                  <div className="p-6 text-center border border-white/5 bg-[#15161d] rounded-2xl">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No recent transactions</p>
                  </div>
                ) : (
                  cashinHistory.map((log: any, idx: number) => (
                    <div key={idx} className="p-4 border border-white/5 bg-[#15161d] rounded-2xl flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Ref: {log.referenceId}</span>
                        <span className="text-[9px] font-bold text-slate-400">
                           {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wallet</p>
                           <p className="text-sm font-black text-white">{log.walletNumber} ({log.targetWallet})</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount</p>
                           <p className="text-sm font-black text-emerald-400 tabular-nums">₱{log.amount}</p>
                        </div>
                      </div>
                      <div className="mt-1 text-right">
                        <span className="inline-block px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {activeTab === "records" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Recent Transactions</h3>
              <button 
                onClick={fetchRecords} 
                disabled={isLoadingRecords}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isLoadingRecords ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingRecords ? (
              <div className="py-12 flex justify-center">
                <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center bg-[#15161d] rounded-2xl border border-white/5 text-center">
                <History className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No transactions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((tx: any) => (
                  <div 
                    key={tx.id} 
                    onClick={() => setSelectedRecord(tx)}
                    className="cursor-pointer bg-[#15161d] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group hover:border-orange-500/30 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Customer</p>
                        <p className="text-sm font-black text-white font-mono">{tx.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Date</p>
                        <p className="text-xs font-bold text-slate-400">
                          {tx.createdAt ? new Date(tx.createdAt.toDate()).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="h-px w-full bg-white/5" />
                    
                    <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-orange-400/80 mb-1">Cashier / User</p>
                         <p className="text-xs font-black text-orange-400 max-w-[150px] truncate">
                           {tx.senderUsername || 'Unknown User'}
                         </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{tx.keyword}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-black text-orange-500">₱</span>
                          <span className="text-lg font-black text-white tabular-nums leading-none">
                            {Number(tx.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeRecordDetails}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111218] border border-white/10 p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              <button
                onClick={closeRecordDetails}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-6 mt-2">
                  <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-3xl flex items-center justify-center mb-6">
                    <History className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight mb-2">
                    Transaction Details
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-md">
                      Completed
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      ID: {selectedRecord.id.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="p-4 bg-[#15161d] border border-white/5 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</span>
                    <span className="text-sm font-black text-white font-mono">{selectedRecord.phone}</span>
                  </div>

                  <div className="p-4 bg-[#15161d] border border-white/5 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Keyword / Promo</span>
                    <span className="text-sm font-black text-orange-400">{selectedRecord.keyword}</span>
                  </div>

                  <div className="p-4 bg-[#15161d] border border-white/5 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Base Amount</span>
                    <span className="text-sm font-black text-white font-mono">
                      ₱{(Number(selectedRecord.price)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {selectedRecord.fee !== undefined ? (
                    <>
                      <div className="p-4 bg-[#15161d] border border-white/5 rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Fee</span>
                        <span className="text-sm font-black text-orange-400 font-mono">
                          ₱{(Number(selectedRecord.fee)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Total Collection</span>
                        <span className="text-lg font-black text-emerald-400 font-mono">
                          ₱{(Number(selectedRecord.totalPay || (selectedRecord.price + selectedRecord.fee))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Total Charged</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        ₱{(Number(selectedRecord.price)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="p-4 bg-[#15161d] border border-white/5 rounded-2xl flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Processed By</span>
                    <span className="text-sm font-black text-white">{selectedRecord.senderUsername || 'Unknown'}</span>
                    <span className="text-[10px] font-bold text-slate-500 mt-1">
                      {selectedRecord.createdAt ? new Date(selectedRecord.createdAt.toDate()).toLocaleString('en-PH') : 'Unknown Date'}
                    </span>
                  </div>
                </div>

                {(user?.role === 'admin' || user?.customUsername === '@admin' || user?.name === '@admin') && (
                  <div className="mt-4">
                    {showDeleteConfirm ? (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-4">
                        <p className="text-sm font-bold text-rose-500 text-center">Are you sure you want to delete this record?</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] bg-white/5 hover:bg-white/10 text-white transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(selectedRecord.id)}
                            className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Confirm
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full relative py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all overflow-hidden group bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20"
                      >
                        <div className="relative z-10 flex items-center justify-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Record</span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center justify-center w-24 h-24 bg-emerald-500 rounded-full shadow-2xl shadow-emerald-500/50 mb-8"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-black text-white uppercase tracking-widest mb-2 text-center"
            >
              Request Generated
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm font-bold text-emerald-400 uppercase tracking-widest text-center flex items-center gap-2"
            >
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                Redirecting to Messenger...
              </motion.span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
