import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, LayoutDashboard, ShoppingCart, Package, History, 
  Settings, LogOut, Clock, Calendar, CheckCircle2, 
  AlertCircle, ChevronRight, Lock, Printer, CreditCard, ClipboardList,
  Users, Timer, ArrowRight, MapPin, Coffee, Menu, IdCard, Plus, Trash2, Edit3, X,
  Briefcase,
  User, Phone, RefreshCw, SmartphoneNfc, CloudOff
} from "lucide-react";
import { db, LocalAttendance, LocalStaff } from "../lib/db";
import { API } from "../lib/api";

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

export default function Attendance({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"attendance" | "staff">("attendance");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [history, setHistory] = useState<LocalAttendance[]>([]);
  const [staffList, setStaffList] = useState<LocalStaff[]>([]);
  const [currentSession, setCurrentSession] = useState<LocalAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Time In Modal State
  const [showTimeInModal, setShowTimeInModal] = useState(false);
  const [timeInName, setTimeInName] = useState("");

  // Staff Form State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    address: "",
    contact_number: ""
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAttendance();
    fetchStaff();
  }, [user]);

  const fetchStaff = async () => {
    try {
      const response = await API.get("/staff");
      setStaffList(response.data);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      // Fallback
      const allStaff = await db.staff.toArray();
      setStaffList(allStaff);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaffId) {
        const updateData = { ...staffForm, id: editingStaffId };
        await db.staff.put(updateData);
        await API.put(`/staff/${editingStaffId}`, updateData);
      } else {
        const newId = `staff_${Date.now()}`;
        const newStaff = {
          ...staffForm,
          id: newId,
          joined_at: new Date().toISOString()
        };
        await db.staff.add(newStaff);
        await API.post("/staff", newStaff);
      }
      setStaffForm({ name: "", address: "", contact_number: "" });
      setEditingStaffId(null);
      setShowStaffModal(false);
      fetchStaff();
    } catch (err: any) {
      console.error("Staff operation failed:", err);
      alert("Failed to save staff info: " + (err.message || String(err)));
    }
  };

  const deleteStaff = async (id: string) => {
    if (confirm("Are you sure you want to delete this staff member?")) {
      await db.staff.delete(id);
      await API.delete(`/staff/${id}`);
      fetchStaff();
    }
  };

  const editStaff = (staff: LocalStaff) => {
    setStaffForm({
      name: staff.name,
      address: staff.address,
      contact_number: staff.contact_number
    });
    setEditingStaffId(staff.id);
    setShowStaffModal(true);
  };

  const fetchAttendance = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      let allHistory: LocalAttendance[] = [];
      try {
        const params = !isAdmin ? { user_id: user.id } : undefined;
        const response = await API.get("/attendance", params);
        allHistory = response.data;
      } catch (e) {
        console.warn("Using local attendance as fallback");
        let query = db.attendance;
        if (isAdmin) {
          allHistory = await query.reverse().toArray();
        } else {
          allHistory = await query
            .where('user_id')
            .equals(user.id)
            .reverse()
            .toArray();
        }
      }
      
      // Filter for non-admins if API returned everything
      if (!isAdmin) {
        allHistory = allHistory.filter(h => h.user_id === user.id);
      }

      setHistory(allHistory);

      // Check if there's an active session FOR THE CURRENT USER
      const active = allHistory.find(a => a.user_id === user.id && !a.time_out);
      setCurrentSession(active || null);
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !timeInName.trim()) return;
    try {
      const now = new Date();
      const newId = `attendance_${now.getTime()}_${user.id}`;
      const record: LocalAttendance = {
        id: newId,
        user_id: user.id,
        user_name: timeInName.trim(),
        time_in: now.toISOString(),
        date: now.toISOString().split('T')[0]
      };
      
      await db.attendance.add(record);
      await API.post("/attendance", record);
      
      setShowTimeInModal(false);
      setTimeInName("");
      fetchAttendance();
    } catch (err: any) {
      console.error("Time In failed:", err);
      alert("Failed to record Time In. Details: " + (err.message || String(err)));
    }
  };

  const handleTimeOut = async () => {
    if (!currentSession || !currentSession.id) return;
    try {
      const now = new Date();
      const updated = {
        ...currentSession,
        time_out: now.toISOString()
      };
      await db.attendance.put(updated);
      await API.post("/attendance", updated); // Use POST to overwrite/sync or PUT if you prefer doc set
      
      fetchAttendance();
    } catch (err: any) {
      console.error("Time Out failed:", err);
      alert("Failed to record Time Out. Details: " + (err.message || String(err)));
    }
  };

  const deleteAttendanceRecord = async (id: string) => {
    if (confirm("Are you sure you want to delete this specific log entry?")) {
      try {
        await db.attendance.delete(id);
        await API.delete(`/attendance/${id}`);
        fetchAttendance();
      } catch (err) {
        console.error("Failed to delete record:", err);
        alert("Failed to delete record.");
      }
    }
  };

  const handleClearHistory = async () => {
    console.log("handleClearHistory triggered, isAdmin:", isAdmin);
    if (!isAdmin) {
      alert("Only administrators can clear history.");
      return;
    }
    
    if (confirm("Are you sure you want to clear ALL attendance history? This action cannot be undone.")) {
      try {
        console.log("Clearing attendance database...");
        await db.attendance.clear();
        console.log("Database cleared, fetching fresh data...");
        await fetchAttendance();
        alert("Attendance history cleared successfully.");
      } catch (err) {
        console.error("Failed to clear history:", err);
        alert("Failed to clear history: " + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const calculateDuration = (inStr: string, outStr?: string) => {
    const start = new Date(inStr);
    const end = outStr ? new Date(outStr) : currentTime;
    const diff = end.getTime() - start.getTime();
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const calculateTotalHoursForUser = (userName: string) => {
    const userRecords = history.filter(h => h.user_name === userName && h.time_out);
    let totalMs = 0;
    userRecords.forEach(r => {
      if (r.time_out) {
        totalMs += new Date(r.time_out).getTime() - new Date(r.time_in).getTime();
      }
    });

    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getUniqueStaffFromHistory = () => {
    const names = new Set(history.map(h => h.user_name));
    return Array.from(names);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-300 font-sans">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 z-50 transition-transform md:translate-x-0 md:static
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
                      layoutId="active-indicator-attendance"
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

      <main className="flex-1 overflow-y-auto max-h-screen scrollbar-hide relative z-10 min-w-0">
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#0a0a0f]/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 p-4 lg:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Attendance & Staff</h2>
          </div>
            
          {isAdmin && (
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab("attendance")}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Attendance
              </button>
              <button 
                onClick={() => setActiveTab("staff")}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'staff' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Staff Info
              </button>
            </div>
          )}
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
          {activeTab === "attendance" ? (
            <div className="space-y-8">
              <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : 'max-w-2xl mx-auto'} gap-8`}>
                <div className={`${isAdmin ? 'lg:col-span-2' : 'w-full'} space-y-6`}>
                  <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Internal Terminal Clock</p>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">
                          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </h1>
                        <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>

                      <div className="flex gap-4">
                        {!currentSession ? (
                          <button 
                            onClick={() => setShowTimeInModal(true)}
                            className="group relative flex flex-col items-center justify-center w-40 h-40 bg-indigo-600 text-white rounded-[3rem] shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all"
                          >
                            <Timer className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Time In</span>
                          </button>
                        ) : (
                          <button 
                            onClick={handleTimeOut}
                            className="group relative flex flex-col items-center justify-center w-40 h-40 bg-rose-500 text-white rounded-[3rem] shadow-2xl shadow-rose-500/30 active:scale-95 transition-all"
                          >
                            <Coffee className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Time Out</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {currentSession && (
                      <div className="mt-10 p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 flex flex-wrap gap-8 items-center justify-center md:justify-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry At</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white">{formatTime(currentSession.time_in)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{calculateDuration(currentSession.time_in)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#15161d] p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center gap-2 mb-3 text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Status OK</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Terminal</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ready for transaction recording</p>
                    </div>
                    <div className="bg-white dark:bg-[#15161d] p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center gap-2 mb-3 text-indigo-500">
                        <MapPin className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Location</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">CBK Store Main</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Vessel POS ID: #772</p>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-6 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] lowercase">Recent Log History</h3>
                        {isAdmin && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearHistory();
                            }}
                            disabled={history.length === 0}
                            className={`p-2 rounded-xl transition-all active:scale-95 group ${history.length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-rose-500/10 text-rose-500'}`}
                            title="Clear All History"
                          >
                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                        {loading ? (
                          <div className="animate-pulse space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 dark:bg-white/5 rounded-2xl" />)}
                          </div>
                        ) : history.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 opacity-30 italic text-slate-400">
                            <History className="w-8 h-8 mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-widest">No history yet</p>
                          </div>
                        ) : (
                          history.slice(0, 5).map((record) => (
                            <div key={record.id} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 group hover:border-indigo-500/30 transition-all">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{record.user_name}</p>
                                <span className={`text-[8px] font-black uppercase p-1 rounded ${record.time_out ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500 animate-pulse'}`}>
                                  {record.time_out ? 'Completed' : 'Active'}
                                </span>
                              </div>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500 tabular-nums">
                                <div className="flex items-center gap-1.5 text-[9px]">
                                  <ArrowRight className="w-3 h-3 text-emerald-500" /> {formatTime(record.time_in)}
                                </div>
                                {record.time_out ? (
                                  <div className="flex items-center gap-1.5 text-[9px]">
                                    <History className="w-3 h-3 text-rose-500" /> {formatTime(record.time_out)}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-indigo-500 animate-bounce">...</span>
                                )}
                              </div>
                              {record.time_out && (
                                <p className="mt-2 pt-2 border-t border-slate-200 dark:border-white/5 text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">
                                  {calculateDuration(record.time_in, record.time_out)}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Table Section - Only for Admins */}
              {isAdmin && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center">
                        <LayoutDashboard className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Detailed Records</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Complete attendance tracking data</p>
                      </div>
                    </div>
                    {isAdmin && history.length > 0 && (
                      <button 
                        onClick={handleClearHistory}
                        className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" /> Clear All Logs
                      </button>
                    )}
                  </div>
  
                  <div className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Time In</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Time Out</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Hrs</th>
                            {isAdmin && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {loading ? (
                            <tr>
                              <td colSpan={isAdmin ? 5 : 4} className="px-6 py-10 text-center animate-pulse text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Processing logs...</td>
                            </tr>
                          ) : history.length === 0 ? (
                            <tr>
                              <td colSpan={isAdmin ? 5 : 4} className="px-6 py-20 text-center opacity-30 italic text-slate-400">
                                <p className="text-[10px] font-black uppercase tracking-widest">Electronic records are empty</p>
                              </td>
                            </tr>
                          ) : (
                            history.map((record) => (
                              <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center font-black text-[10px] text-indigo-600">
                                      {record.user_name?.charAt(0) || "U"}
                                    </div>
                                    <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{record.user_name || "Unknown"}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{new Date(record.date).toLocaleDateString()}</p>
                                    <p className="text-[9px] font-bold text-slate-400 tabular-nums uppercase">{formatTime(record.time_in)}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {record.time_out ? (
                                    <div className="space-y-0.5">
                                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{new Date(record.time_out).toLocaleDateString()}</p>
                                      <p className="text-[9px] font-bold text-slate-400 tabular-nums uppercase">{formatTime(record.time_out)}</p>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Running...</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tabular-nums tracking-widest ${record.time_out ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'bg-slate-100 text-slate-400 dark:bg-white/5'}`}>
                                    {calculateDuration(record.time_in, record.time_out)}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td className="px-6 py-4 text-center">
                                    <button 
                                      onClick={() => deleteAttendanceRecord(record.id)}
                                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                                      title="Delete Entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
  
                    {/* Summary Footer */}
                    {history.length > 0 && (
                      <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2 mb-6">
                          <History className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Partner Performance Summary</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {getUniqueStaffFromHistory().map((name: string) => (
                            <div key={name} className="p-4 bg-white dark:bg-[#111218] border border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-between group shadow-sm transition-all hover:border-indigo-500/30">
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate max-w-[120px]">{name}</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">{calculateTotalHoursForUser(name)}</p>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                                <Clock className="w-5 h-5 text-slate-400 group-hover:text-white transition-all" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Staff Registry</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Add and manage official store staff</p>
                </div>
                <button 
                  onClick={() => { setEditingStaffId(null); setStaffForm({ name: "", address: "", contact_number: "" }); setShowStaffModal(true); }}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add New Staff
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffList.length === 0 ? (
                  <div className="col-span-full py-20 bg-white dark:bg-[#15161d] border border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center opacity-40">
                    <Users className="w-12 h-12 mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No staff registered yet</p>
                  </div>
                ) : (
                  staffList.map((staff) => (
                    <motion.div 
                      key={staff.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => editStaff(staff)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteStaff(staff.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{staff.name}</h4>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{staff.address || 'No Address'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{staff.contact_number || 'No Contact'}</p>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Partner since: {new Date(staff.joined_at).toLocaleDateString()}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Staff Modal */}
        <AnimatePresence>
          {showTimeInModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowTimeInModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-[#111218] w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between text-center md:text-left">
                  <div className="w-full">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center mx-auto md:mx-0 mb-4">
                      <Timer className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Attendance Entry</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Please verify your identification</p>
                  </div>
                </div>
                
                <form onSubmit={handleTimeIn} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Full Name</label>
                    <input 
                      required
                      autoFocus
                      type="text" 
                      list="staff-suggestions"
                      value={timeInName}
                      onChange={(e) => setTimeInName(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="Type your name..."
                    />
                    <datalist id="staff-suggestions">
                      {staffList.map((staff) => (
                        <option key={staff.id} value={staff.name} />
                      ))}
                    </datalist>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all mt-4"
                  >
                    Confirm Time In
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showStaffModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowStaffModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-[#111218] w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingStaffId ? 'Edit Staff' : 'Add New Staff'}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fill in member details</p>
                  </div>
                  <button onClick={() => setShowStaffModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleAddStaff} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={staffForm.name}
                      onChange={(e) => setStaffForm({...staffForm, name: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Contact Number</label>
                    <input 
                      required
                      type="text" 
                      value={staffForm.contact_number}
                      onChange={(e) => setStaffForm({...staffForm, contact_number: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="Mobile or phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Address</label>
                    <textarea 
                      required
                      value={staffForm.address}
                      onChange={(e) => setStaffForm({...staffForm, address: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none min-h-[100px]"
                      placeholder="Home or work address"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all mt-4"
                  >
                    {editingStaffId ? 'Update Staff Info' : 'Confirm Registration'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.2);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
