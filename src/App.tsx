/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Transactions from "./pages/Transactions";
import Printing from "./pages/Printing";
import Settings from "./pages/Settings";
import CreditTracker from "./pages/CreditTracker";
import CustomerRegistry from "./pages/CustomerRegistry";
import Attendance from "./pages/Attendance";
import SukiGenerator from "./pages/SukiGenerator";
import Orders from "./pages/Orders";
import GCashTracker from "./pages/GCashTracker";
import SelectionScreen from "./pages/SelectionScreen";
import SOSCredit from "./pages/SOSCredit";
import SendMoney from "./pages/SendMoney";
import { Loader2, WifiOff } from "lucide-react";
import { API } from "./lib/api";
import Receipt from "./components/Receipt";
import PWAUpdateNotification from "./components/PWAUpdateNotification";

function AppContent() {
  const { user, loading, logout, isAdmin } = useAuth();
  const isRestrictedUser = user?.email === 'user@mariz.com';
  const [currentPage, setCurrentPage] = useState<"dashboard" | "pos" | "inventory" | "transactions" | "printing" | "settings" | "credit-tracker" | "customers" | "attendance" | "generator" | "orders" | "gcash" | "sos-credit" | "send-money">("dashboard");
  const [isModuleVerified, setIsModuleVerified] = useState(false);
  const [verifiedBorrowerId, setVerifiedBorrowerId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [printData, setPrintData] = useState<any>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);

  useEffect(() => {
    // Reset verification when user changes
    if (!user) {
      setIsModuleVerified(false);
      setVerifiedBorrowerId(null);
    } else {
      // Trigger sync when user logs in
      if (navigator.onLine) {
        API.syncPendingTransactions().catch(console.error);
      }
      
      // Auto-verify and set page for restricted user
      if (isRestrictedUser) {
        setCurrentPage("gcash");
        setIsModuleVerified(true);
      } else if (Boolean(user && !isAdmin && !isRestrictedUser && user.email?.startsWith('user@'))) {
        setCurrentPage("send-money");
        setIsModuleVerified(true);
      }
    }
  }, [user, isRestrictedUser]);

  useEffect(() => {
    // Load business info for printing
    API.get("/settings/business").then(res => setBusinessInfo(res.data)).catch(console.error);

    const handlePrintEvent = (e: any) => {
      console.log("App: Received swiftpos-print event", e.detail);
      setPrintData(e.detail);
    };

    window.addEventListener("swiftpos-print", handlePrintEvent as any);

    const handleOnline = () => {
      setIsOnline(true);
      API.syncPendingTransactions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check and sync if online
    if (navigator.onLine) {
      API.syncPendingTransactions();
    }

    return () => {
      window.removeEventListener("swiftpos-print", handlePrintEvent as any);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#111118]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  if (!isModuleVerified) {
    return (
      <SelectionScreen 
        onSelect={(module, borrowerId) => {
          setCurrentPage(module);
          setVerifiedBorrowerId(borrowerId || null);
          setIsModuleVerified(true);
        }} 
      />
    );
  }

  const isPadalaOnlyUser = Boolean(user && !isAdmin && !isRestrictedUser && user.email?.startsWith('user@'));

  const navigate = (page: typeof currentPage) => {
    // Restricted user is locked to gcash or dashboard (to see menu)
    if (isRestrictedUser && !["gcash", "dashboard"].includes(page)) {
      console.warn("Navigation restricted for terminal user");
      return;
    }
    
    // Pera Padala user is restricted to send-money
    if (isPadalaOnlyUser && !["send-money"].includes(page)) {
      console.warn("Navigation restricted for Padala Only user");
      return;
    }

    // If logged in as a specific borrower, do not allow navigation away from credit-tracker
    if (verifiedBorrowerId && page !== "credit-tracker") {
      console.warn("Navigation restricted in ID mode");
      return;
    }

    // Role-based access control
    const restrictedPages = ["inventory", "printing", "settings", "credit-tracker", "customers", "generator"];
    if (!isAdmin && restrictedPages.includes(page) && !verifiedBorrowerId) {
      console.warn("Navigation restricted for non-admin user");
      return;
    }

    setCurrentPage(page);
  };

  const handleLogout = () => {
    setIsModuleVerified(false);
    setVerifiedBorrowerId(null);
    logout();
  };

  return (
    <div className="relative">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black text-[10px] py-1 px-4 font-bold flex items-center justify-center gap-2 uppercase tracking-widest animate-pulse">
          <WifiOff className="w-3 h-3" />
          Offline Mode - Transactions will queue and sync when online
        </div>
      )}
      {(() => {
        switch (currentPage) {
          case "pos": return <POS navigate={navigate} currentPage={currentPage} />;
          case "inventory": return <Inventory navigate={navigate} currentPage={currentPage} />;
          case "transactions": return <Transactions navigate={navigate} currentPage={currentPage} />;
          case "printing": return <Printing navigate={navigate} currentPage={currentPage} />;
          case "settings": return <Settings navigate={navigate} currentPage={currentPage} />;
          case "customers": return <CustomerRegistry navigate={navigate} currentPage={currentPage} />;
          case "attendance": return <Attendance navigate={navigate} currentPage={currentPage} />;
          case "generator": return <SukiGenerator navigate={navigate} currentPage={currentPage} />;
          case "orders": return <Orders navigate={navigate} currentPage={currentPage} />;
          case "gcash": return <GCashTracker navigate={navigate} currentPage={currentPage} />;
          case "sos-credit": return <SOSCredit navigate={navigate} currentPage={currentPage} />;
          case "send-money": return <SendMoney navigate={navigate} currentPage={currentPage} />;
          case "credit-tracker": return <CreditTracker navigate={navigate} currentPage={currentPage} verifiedBorrowerId={verifiedBorrowerId || undefined} />;
          default: return <Dashboard navigate={navigate} currentPage={currentPage} />;
        }
      })()}
      
      {printData && (
        <Receipt 
          txn={printData} 
          businessInfo={businessInfo} 
          onPrintDone={() => setPrintData(null)} 
        />
      )}
      
      <PWAUpdateNotification />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

