import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { API } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, LayoutDashboard, ShoppingCart, Package, History, 
  Settings, LogOut, Search, Menu, X, Plus, UserPlus,
  User, MapPin, Phone, Calendar, Printer, RefreshCw, 
  CheckCircle2, AlertCircle, Users, IdCard, Trash2, ClipboardList,
  Download, Filter, ChevronRight, Lock, CreditCard, Image as ImageIcon,
  Trophy,
  Briefcase,
  Clock,
  SmartphoneNfc,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { db, LocalCustomer } from "../lib/db";
import JsBarcode from "jsbarcode";
import { toJpeg } from "html-to-image";

export default function CustomerRegistry({ navigate, currentPage }: { navigate: (page: any) => void, currentPage: string }) {
  const { user, logout, isAdmin } = useAuth();
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact_number: "",
    birthdate: ""
  });

  const barcodeRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [generatedBarcode, setGeneratedBarcode] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("dashboard");
      return;
    }
    fetchCustomers();
  }, [isAdmin]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await API.get("/customers");
      setCustomers(response.data);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      // Fallback
      const allCustomers = await db.customers.reverse().toArray();
      setCustomers(allCustomers);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      // Generate a unique ID for the barcode (Suki- + timestamp)
      const customerId = `SUKI-${Date.now()}`;
      
      const newCustomer: LocalCustomer = {
        id: customerId,
        name: formData.name,
        address: formData.address,
        contact_number: formData.contact_number,
        birthdate: formData.birthdate,
        suki_number: customerId,
        points: 0,
        created_at: new Date().toISOString()
      };

      await db.customers.add(newCustomer);
      
      // Also sync with API/Cloud if needed
      try {
        await API.post("/customers", newCustomer);
      } catch (syncErr) {
        console.warn("Offline registration saved locally, sync pending.");
      }

      setGeneratedBarcode(customerId);
      setShowAddModal(false);
      setFormData({ name: "", address: "", contact_number: "", birthdate: "" });
      fetchCustomers();
    } catch (err: any) {
      console.error("Registration failed:", err);
      alert("Failed to save customer. Error: " + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadCard = async (name: string) => {
    if (cardRef.current === null) return;
    
    try {
      const dataUrl = await toJpeg(cardRef.current, { quality: 0.95, backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = `SUKI_CARD_${name.replace(/\s+/g, '_').toUpperCase()}.jpeg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download card:', err);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Remove this customer from registry?")) return;
    try {
      await db.customers.delete(id);
      await API.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Failed to delete customer: " + (err.message || String(err)));
    }
  };

  const openCardGenerator = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setGeneratedBarcode(customerId);
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contact_number || "").includes(searchTerm) ||
    (c.id || "").includes(searchTerm.toUpperCase())
  );

  useEffect(() => {
    if (generatedBarcode && barcodeRef.current) {
      JsBarcode(barcodeRef.current, generatedBarcode, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontOptions: "bold",
        fontSize: 14,
        margin: 10
      });
    }
  }, [generatedBarcode]);



  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 flex transition-colors duration-300 font-sans">
      {/* Sidebar - Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transition-transform lg:translate-x-0 lg:static dark:bg-[#111218] dark:border-white/5 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">CBK<span className="text-indigo-600">POS</span></span>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          {sidebarItems.map((item, idx) => {
            const isActive = currentPage === item.id;
            return (
              <button 
                key={idx} 
                onClick={() => { if (item.allowed) { navigate(item.id as any); } }} 
                disabled={!item.allowed} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all 
                  ${!item.allowed ? 'opacity-30 cursor-not-allowed filter grayscale' : ''} 
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : (item.allowed ? 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100' : 'text-slate-400')}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {!item.allowed && <Lock className="w-3 h-3 ml-auto opacity-50" />}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 dark:bg-[#1c1d26] dark:border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center font-black text-slate-600 dark:text-white">
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

      <main className="flex-1 overflow-y-auto max-h-screen">
        <header className="sticky top-0 z-30 bg-[#f8f9fa]/80 dark:bg-[#0a0a0f]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 p-4 lg:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Customer Registry</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 active:scale-95 transition-all">
              <UserPlus className="w-4 h-4" /> Register Suki
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search Customers..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none uppercase"
              />
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <Users className="w-4 h-4" /> {customers.length} Total Registered
            </div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accessing Registry...</p>
             </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="bg-white dark:bg-[#15161d] border border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] py-20 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6">
                <IdCard className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">No Customers Found</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 max-w-xs">Start building your 'Suki' network by registering new customers today.</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="mt-8 flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" /> New Registration
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCustomers.map((customer) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={customer.id} 
                  className="bg-white dark:bg-[#15161d] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-xl font-black text-indigo-600">
                        {customer.name?.charAt(0) || "C"}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[150px]">{customer.name || "Customer"}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{customer.id}</p>
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
                            <Trophy className="w-2.5 h-2.5" />
                            {customer.points || 0} PTS
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteCustomer(customer.id)}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                      <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{customer.address || "No Address Recorded"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <p className="text-[11px] text-slate-500 font-black tracking-widest">{customer.contact_number || "N/A"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Born: {customer.birthdate || "N/A"}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <button 
                      onClick={() => openCardGenerator(customer.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      <IdCard className="w-3.5 h-3.5" /> Suki Card
                    </button>
                    <span className="text-[8px] font-bold text-slate-300 uppercase">Joined {new Date(customer.created_at).toLocaleDateString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Add Modal */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
                onClick={() => setShowAddModal(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-[#111218] rounded-[2.5rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">New Suki Registration</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Capture customer data for special rewards</p>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-3 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleRegister} className="p-8 space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Customer Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="ENTER FULL NAME..."
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Complete Address</label>
                    <input 
                      type="text"
                      placeholder="CITY, BARANGAY, STREET..."
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Contact Number</label>
                      <input 
                        type="tel"
                        placeholder="09XXXXXXXXX"
                        value={formData.contact_number}
                        onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Birthdate</label>
                      <input 
                        type="date"
                        value={formData.birthdate}
                        onChange={(e) => setFormData({...formData, birthdate: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Finalize Registration
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Barcode / Card Modal */}
        <AnimatePresence>
          {generatedBarcode && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
                onClick={() => { setGeneratedBarcode(null); setSelectedCustomerId(null); }} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-[#111218] rounded-[3rem] p-8 md:p-10 flex flex-col items-center text-center shadow-2xl"
              >
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center mb-6">
                  <IdCard className="w-8 h-8 text-indigo-500" />
                </div>
                
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Suki Membership Card</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8 text-center px-4">Generate and download the customer's digital membership card</p>
                
                {/* Visual Card Representation */}
                <div className="mb-10 w-full overflow-hidden flex justify-center">
                  <div 
                    ref={cardRef}
                    className="w-[350px] h-[210px] bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[1.5rem] p-6 text-left relative flex flex-col justify-between shadow-2xl overflow-hidden shadow-indigo-500/20"
                  >
                    {/* Gloss Effects */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                    
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20">
                          <Store className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-black text-white tracking-widest uppercase">CBK STORE</span>
                      </div>
                      <div className="text-[8px] font-black text-white/40 tracking-[0.3em] uppercase rotate-90 origin-right translate-y-3">
                        AUTHORIZED SUKI
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-[7px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">MEMBER NAME</p>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">
                        {customers.find(c => c.id === generatedBarcode)?.name || "GUEST CUSTOMER"}
                      </h4>
                    </div>

                    <div className="bg-white rounded-xl p-2 flex flex-col items-center justify-center">
                      <svg ref={barcodeRef} className="w-full max-h-[50px]" />
                    </div>
                    
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-1 items-end opacity-20">
                      {[1,2,3].map(i => <div key={i} className="h-[2px] w-8 bg-white rounded-full" />)}
                    </div>
                  </div>
                </div>
                
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={() => downloadCard(customers.find(c => c.id === generatedBarcode)?.name || "Suki")}
                    className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4" /> Download JPEG
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="py-4 bg-slate-900 dark:bg-white/5 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" /> Print Card
                  </button>
                </div>
                
                <button 
                  onClick={() => { setGeneratedBarcode(null); setSelectedCustomerId(null); }}
                  className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Close Preview
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
