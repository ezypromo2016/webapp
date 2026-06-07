import { Storage } from "./storage";
import { db as dexieDb } from "./db";
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  addDoc,
  serverTimestamp,
  writeBatch,
  increment
} from "firebase/firestore";
import { db as firestore, auth } from "./firebase";
import axios from "axios";

import { handleFirestoreError, OperationType } from "./firestore-errors";

let isSyncing = false;

export const API = {
  isSyncing() {
    return isSyncing;
  },
  // Common error handler
  handleError(err: any, operation: OperationType = OperationType.WRITE, path: string | null = null) {
    handleFirestoreError(err, operation, path);
  },

  // Helper to convert Firestore Timestamps to ISO strings
  sanitizeData(data: any) {
    if (!data) return data;
    const sanitized = { ...data };
    
    // Common fields that might be Timestamps
    const dateFields = ["created_at", "updated_at", "date", "timestamp"];
    
    for (const field of dateFields) {
      if (sanitized[field] && typeof sanitized[field] === 'object' && 'seconds' in sanitized[field]) {
        sanitized[field] = new Date(sanitized[field].seconds * 1000).toISOString();
      }
    }

    // Recursively sanitize if it's a known structure (like items in transactions)
    if (sanitized.items && Array.isArray(sanitized.items)) {
      sanitized.items = sanitized.items.map((item: any) => this.sanitizeData(item));
    }
    
    if (sanitized.payments && Array.isArray(sanitized.payments)) {
      sanitized.payments = sanitized.payments.map((p: any) => this.sanitizeData(p));
    }

    return sanitized;
  },

  async syncPendingTransactions() {
    if (isSyncing || !auth.currentUser) return;
    if (!navigator.onLine) return;

    const pending = await dexieDb.pendingTransactions.where('status').equals('pending').toArray();
    if (pending.length === 0) return;

    isSyncing = true;
    console.log(`Attempting to sync ${pending.length} transactions...`);
    window.dispatchEvent(new CustomEvent('swiftpos-sync-start'));
    
    try {
      for (const txn of pending) {
        try {
          await dexieDb.pendingTransactions.update(txn.id!, { status: 'syncing' });
          
          const path = txn.path;
          const data = txn.data;
          const method = txn.method;

          console.log(`Syncing item ${txn.id}: ${method} ${path}`);

          // Handle path and prefix matching
          if (path === "/transactions" && method === "POST") {
            const txnRef = doc(firestore, "transactions", data.id);
            const batch = writeBatch(firestore);
            
            // Set main transaction (include items directly)
            batch.set(txnRef, { ...data, created_at: data.created_at || new Date().toISOString() });
            
            // Still keep subcollection for future-proofing/backups if necessary, but primary is in document
            if (data.items && Array.isArray(data.items)) {
              for (const item of data.items) {
                const itemRef = doc(collection(txnRef, "items"));
                batch.set(itemRef, item);

                // Deduct stock on Firestore during sync
                const pId = item.productId || item.id;
                const qty = item.qty || item.quantity || 0;
                if (pId) {
                  const productRef = doc(firestore, "products", pId);
                  batch.update(productRef, {
                    stock: increment(-qty)
                  });
                }
              }
            }
            await batch.commit();
          } else if (path === "/sos_credits" && method === "POST") {
            const recordRef = doc(firestore, "sos_credits", data.id);
            const batch = writeBatch(firestore);
            batch.set(recordRef, data);

            if (data.items && Array.isArray(data.items)) {
              for (const item of data.items) {
                const pId = item.productId || item.id;
                const qty = item.qty || item.quantity || 0;
                if (pId) {
                  const productRef = doc(firestore, "products", pId);
                  batch.update(productRef, {
                    stock: increment(-qty)
                  });
                }
              }
            }
            await batch.commit();
          } else if ((path === "/products" || path.startsWith("/products/")) && (method === "POST" || method === "PUT")) {
            const docId = data.id || path.split("/").pop();
            await setDoc(doc(firestore, "products", docId), data);
          } else if (path === "/categories" && method === "POST") {
            await setDoc(doc(firestore, "categories", data.name), data);
          } else if ((path === "/credits" || path.startsWith("/credits/")) && (method === "POST" || method === "PUT")) {
            const docId = data.id || path.split("/").pop();
             await setDoc(doc(firestore, "credits", docId), data);
          } else if (path === "/printing" && method === "POST") {
             await setDoc(doc(firestore, "printing_records", data.id), data);
          } else if (path === "/printing_expenses" && method === "POST") {
             await setDoc(doc(firestore, "printing_expenses", data.id), data);
          } else if (path === "/order_expenses" && method === "POST") {
             await setDoc(doc(firestore, "order_expenses", data.id), data);
          } else if (path === "/customers" && method === "POST") {
            await setDoc(doc(firestore, "customers", data.id), data);
          } else if (path === "/staff" && method === "POST") {
            await setDoc(doc(firestore, "staff", data.id || data.name), data);
          } else if (path === "/attendance" && (method === "POST" || method === "PUT")) {
            const docId = data.id || `attendance_${new Date(data.time_in).getTime()}_${data.user_id}`;
            await setDoc(doc(firestore, "attendance", String(docId)), data);
          } else if (path === "/gcash" && (method === "POST" || method === "PUT")) {
            await setDoc(doc(firestore, "gcash_transactions", data.id), data);
          } else if (path === "/gcash_accounts" && (method === "POST" || method === "PUT")) {
            await setDoc(doc(firestore, "gcash_accounts", data.id), data);
          } else if (path === "/orders" && (method === "POST" || method === "PUT")) {
            await setDoc(doc(firestore, "orders", data.id), data);
          } else {
            console.warn(`No sync handler for ${method} ${path}`);
          }

          await dexieDb.pendingTransactions.delete(txn.id!);
          console.log(`Record for ${txn.path} synced successfully`);
          window.dispatchEvent(new CustomEvent('swiftpos-sync-success', { detail: txn.id }));
        } catch (err) {
          console.error(`Failed to sync ${txn.path}:`, err);
          await dexieDb.pendingTransactions.update(txn.id!, { status: 'pending' });
          window.dispatchEvent(new CustomEvent('swiftpos-sync-error'));
          break; // Stop syncing if one fails (might still be offline)
        }
      }
      window.dispatchEvent(new CustomEvent('sync-complete'));
    } catch (err) {
      console.error("Critical Sync Error:", err);
      window.dispatchEvent(new CustomEvent('swiftpos-sync-error'));
    } finally {
      isSyncing = false;
      window.dispatchEvent(new CustomEvent('sync-finished')); // Extra event just in case
    }
  },

  async get(path: string, params?: Record<string, any>) {
    try {
      let result: any = null;

      if (path === "/products") {
        let products: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "products"));
            products = snap.docs.map(d => this.sanitizeData(d.data()));
            // Sort locally to handle documents missing the field
            products.sort((a, b) => (b.id || "").localeCompare(a.id || ""));
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, "products");
        }

        if (products.length === 0) {
          const cached = await dexieDb.products.toArray();
          products = cached.length > 0 ? cached : [];
        }

        result = { data: products };
        if (result.data.length > 0) {
          await dexieDb.products.clear();
          await dexieDb.products.bulkPut(result.data);
        }
      } else if (path === "/categories") {
        let categories: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "categories"));
            categories = snap.docs.map(d => d.data().name);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, "categories");
        }

        if (categories.length === 0) {
          const cached = await dexieDb.categories.toArray();
          categories = cached.map(c => c.name);
        }

        result = { data: categories };
        if (result.data.length > 0) {
          await dexieDb.categories.clear();
          await dexieDb.categories.bulkPut(result.data.map((name: string) => ({ name })));
        }
      } else if (path === "/settings/business" || path === "/business") {
        let bizData: any = null;
        try {
          if (navigator.onLine) {
            const docSnap = await getDoc(doc(firestore, "business_info", "1"));
            bizData = docSnap.exists() ? this.sanitizeData(docSnap.data()) : null;
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, "business_info/1");
        }
        
        if (!bizData) {
          try {
            const resp = await fetch("/business.json").catch(() => fetch("/data.json"));
            const staticData = await resp.json();
            bizData = staticData.business || staticData;
          } catch (e) {
            console.warn("Could not load static business data:", e);
            bizData = Storage.get("businessInfo");
          }
        }
        
        result = { data: bizData };
        if (bizData) Storage.set("businessInfo", bizData);
      } else if (path === "/printing") {
        let printing: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "printing_records"));
            printing = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, created_at: new Date().toISOString(), ...d.data() }));
            printing.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          }
        } catch (e) { 
          handleFirestoreError(e, OperationType.GET, "printing_records");
        }
        
        if (printing.length === 0) {
          printing = Storage.get("cached_printing") || [];
        }
        result = { data: printing };
        if (printing.length > 0) Storage.set("cached_printing", printing);
      } else if (path === "/printing_expenses") {
        let expenses: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "printing_expenses"));
            expenses = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            expenses.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          }
        } catch (e) { 
          handleFirestoreError(e, OperationType.GET, "printing_expenses");
        }
        result = { data: expenses };
      } else if (path === "/order_expenses") {
        let expenses: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "order_expenses"));
            expenses = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            expenses.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          }
        } catch (e) { 
          handleFirestoreError(e, OperationType.GET, "order_expenses");
        }
        result = { data: expenses };
      } else if (path === "/transactions") {
        let txns: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "transactions"));
            txns = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            txns.sort((a, b) => (b.created_at || b.createdAt || "").localeCompare(a.created_at || a.createdAt || ""));
          }
        } catch (e) { 
          console.warn("Firestore transactions fetch failed:", e);
        }

        if (txns.length === 0) {
          txns = Storage.get("cached_transactions") || [];
        }

        result = { data: txns };
        if (txns.length > 0) Storage.set("cached_transactions", txns);
      } else if (path === "/customers") {
        let customers: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "customers"));
            customers = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            customers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          }
        } catch (e) {
          console.warn("Firestore customers fetch failed:", e);
        }

        if (customers.length === 0) {
          const cached = await dexieDb.customers.toArray();
          customers = cached.length > 0 ? cached : [];
        }

        result = { data: customers };
        if (customers.length > 0) {
          await dexieDb.customers.bulkPut(customers);
        }
      } else if (path === "/staff") {
        let staff: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "staff"));
            staff = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
          }
        } catch (e) {
          console.warn("Firestore staff fetch failed:", e);
        }

        if (staff.length === 0) {
          const cached = await dexieDb.staff.toArray();
          staff = cached.length > 0 ? cached : [];
        }

        result = { data: staff };
        if (staff.length > 0) {
          await dexieDb.staff.bulkPut(staff);
        }
      } else if (path === "/attendance") {
        let attendance: any[] = [];
        try {
          if (navigator.onLine) {
            let snap;
            if (params?.user_id) {
              const q = query(collection(firestore, "attendance"), where("user_id", "==", params.user_id));
              snap = await getDocs(q);
            } else {
              snap = await getDocs(collection(firestore, "attendance"));
            }
            attendance = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            attendance.sort((a, b) => (b.time_in || "").localeCompare(a.time_in || ""));
          }
        } catch (e) {
          console.warn("Firestore attendance fetch failed:", e);
        }

        if (attendance.length === 0) {
          const cached = await dexieDb.attendance.toArray();
          attendance = cached.length > 0 ? cached : [];
        }

        result = { data: attendance };
        if (attendance.length > 0) {
          await dexieDb.attendance.bulkPut(attendance);
        }
      } else if (path === "/credits") {
        let credits: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "credits"));
            credits = snap.docs.map(d => {
              const data = this.sanitizeData({ id: d.id, _id: d.id, ...d.data() });
              if (data.borrower_id) {
                data.borrower_id = data.borrower_id.replace(/^#/, "");
              }
              return data;
            });
            credits.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          }
        } catch (e) { 
          console.warn("Firestore credits fetch failed:", e);
        }

        if (credits.length === 0) {
          const cached = await dexieDb.credits.toArray();
          credits = cached.length > 0 ? cached : [];
        }

        result = { data: credits };
        if (credits.length > 0) {
          await dexieDb.credits.bulkPut(credits);
          Storage.set("cached_credits", credits);
        }
      } else if (path === "/dashboard/summary") {
        let txns: any[] = [];
        let printing: any[] = [];
        let products: any[] = [];
        let sosCredits: any[] = [];

        try {
          if (navigator.onLine) {
            const [txnsSnapResult, printingSnapResult, productsSnapResult, sosSnapResult] = await Promise.allSettled([
              getDocs(collection(firestore, "transactions")),
              getDocs(collection(firestore, "printing_records")),
              getDocs(collection(firestore, "products")),
              getDocs(collection(firestore, "sos_credits"))
            ]);
            
            if (txnsSnapResult.status === 'fulfilled') {
              txns = txnsSnapResult.value.docs.map(d => this.sanitizeData(d.data()));
            }
            if (printingSnapResult.status === 'fulfilled') {
              printing = printingSnapResult.value.docs.map(d => this.sanitizeData(d.data()));
            }
            if (productsSnapResult.status === 'fulfilled') {
              products = productsSnapResult.value.docs.map(d => this.sanitizeData(d.data()));
            }
            if (sosSnapResult.status === 'fulfilled') {
              sosCredits = sosSnapResult.value.docs.map(d => this.sanitizeData(d.data()));
            }
          }
        } catch (e) {
          console.warn("Dashboard summary fetch failed, using fallbacks:", e);
        }

        if (products.length === 0) {
          try {
            const cached = await dexieDb.products.toArray();
            products = cached;
          } catch (e) {}
        }

        if (txns.length === 0) {
          txns = Storage.get("cached_transactions") || [];
        }

        if (printing.length === 0) {
          printing = Storage.get("cached_printing") || [];
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Include SOS credits in calculations if status is completed
        const completedSOS = sosCredits.filter(s => s.paymentStatus === 'completed' && s.status !== 'voided');

        const activeTxns = txns.filter(t => t.status !== 'voided');
        const activePrinting = printing.filter(p => p.status !== 'voided');

        const todayTxns = activeTxns.filter(d => d.created_at?.startsWith(todayStr));
        const todayPrinting = activePrinting.filter(d => d.created_at?.startsWith(todayStr));
        const todaySOS = completedSOS.filter(s => s.completedAt?.startsWith(todayStr) || (s.paymentStatus === 'completed' && s.timestamp?.startsWith(todayStr)));

        const monthlyTxns = activeTxns.filter(d => {
          if (!d.created_at) return false;
          const date = new Date(d.created_at);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        });
        const monthlyPrinting = activePrinting.filter(d => {
          if (!d.created_at) return false;
          const date = new Date(d.created_at);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        });
        const monthlySOS = completedSOS.filter(s => {
          const dateStr = s.completedAt || s.timestamp;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        });

        const calculateProfit = (records: any[]) => {
          return records.reduce((acc, d) => {
            const revenue = d.total || 0;
            const cost = d.items?.reduce((sum: number, i: any) => sum + (i.cost || 0) * (i.qty || i.quantity || 0), 0) || 0;
            return acc + (revenue - cost);
          }, 0);
        };

        result = {
          data: {
            today: {
              totalSales: todayTxns.reduce((acc, d) => acc + (d.total || 0), 0) + todaySOS.reduce((acc, d) => acc + (d.total || 0), 0),
              totalTransactions: todayTxns.length + todaySOS.length,
              totalProfit: calculateProfit(todayTxns) + calculateProfit(todaySOS),
              printingSales: todayPrinting.reduce((acc, d) => acc + (d.total || 0), 0)
            },
            monthly: {
              totalSales: monthlyTxns.reduce((acc, d) => acc + (d.total || 0), 0) + monthlySOS.reduce((acc, d) => acc + (d.total || 0), 0),
              totalTransactions: monthlyTxns.length + monthlySOS.length,
              totalProfit: calculateProfit(monthlyTxns) + calculateProfit(monthlySOS),
              printingSales: monthlyPrinting.reduce((acc, d) => acc + (d.total || 0), 0)
            },
            allTime: {
              totalTransactions: activeTxns.length + completedSOS.length,
              totalProfit: calculateProfit(activeTxns) + calculateProfit(completedSOS),
              printingSales: activePrinting.reduce((acc, d) => acc + (d.total || 0), 0)
            },
            inventory: {
              lowStockCount: products.filter((p: any) => (p.stock || 0) < 10 && (p.stock || 0) > 0).length,
              outOfStockCount: products.filter((p: any) => (p.stock || 0) <= 0).length
            },
            recentTransactions: [...activeTxns, ...completedSOS].sort((a, b) => 
              (b.completedAt || b.created_at || b.timestamp || "").localeCompare(a.completedAt || a.created_at || a.timestamp || "")
            ).slice(0, 10),
            topProducts: []
          }
        };
      } else if (path === "/dashboard/chart") {
        let txns: any[] = [];
        let printing: any[] = [];
        let sosCredits: any[] = [];
        try {
          if (navigator.onLine) {
            const [tSnap, pSnap, sSnap] = await Promise.all([
              getDocs(collection(firestore, "transactions")),
              getDocs(collection(firestore, "printing_records")),
              getDocs(collection(firestore, "sos_credits"))
            ]);
            txns = tSnap.docs.map(d => d.data());
            printing = pSnap.docs.map(d => d.data());
            sosCredits = sSnap.docs.map(d => d.data());
          }
        } catch (e) {}
        
        const days = params?.days || 30;
        const chartData: Record<string, { date: string, total: number, printing: number }> = {};
        const now = new Date();
        for (let i = 0; i < days; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          chartData[dateStr] = { date: dateStr, total: 0, printing: 0 };
        }

        const safeDateStr = (val: any) => {
          if (!val) return null;
          if (typeof val === 'string') return val.split('T')[0];
          if (typeof val.toDate === 'function') return val.toDate().toISOString().split('T')[0];
          return null;
        };

        txns.forEach(data => {
          if (data.status === 'voided') return;
          const dateStr = safeDateStr(data.created_at) || safeDateStr(data.createdAt);
          if (dateStr && chartData[dateStr]) chartData[dateStr].total += (data.total || 0);
        });

        printing.forEach(data => {
          if (data.status === 'voided') return;
          const dateStr = safeDateStr(data.created_at);
          if (dateStr && chartData[dateStr]) chartData[dateStr].printing += (data.total || 0);
        });

        sosCredits.forEach(data => {
          if (data.paymentStatus === 'completed' && data.status !== 'voided') {
            const dateStr = safeDateStr(data.completedAt) || safeDateStr(data.timestamp);
            if (dateStr && chartData[dateStr]) chartData[dateStr].total += (data.total || 0);
          }
        });


        result = { data: Object.values(chartData).sort((a, b) => a.date.localeCompare(b.date)) };
      } else if (path === "/dashboard/payment-breakdown") {
        let txns: any[] = [];
        let sosCredits: any[] = [];
        try {
          if (navigator.onLine) {
            const [tSnap, sSnap] = await Promise.all([
              getDocs(collection(firestore, "transactions")),
              getDocs(collection(firestore, "sos_credits"))
            ]);
            txns = tSnap.docs.map(d => d.data());
            sosCredits = sSnap.docs.map(d => d.data());
          }
        } catch (e) {}

        const breakdown: Record<string, number> = {};
        txns.forEach(data => {
          if (data.status === 'voided') return;
          const method = (data.paymentMethod || "CASH").toLowerCase();
          breakdown[method] = (breakdown[method] || 0) + (data.total || 0);
        });

        sosCredits.forEach(data => {
          if (data.paymentStatus === 'completed' && data.status !== 'voided') {
            const method = "sos credit";
            breakdown[method] = (breakdown[method] || 0) + (data.total || 0);
          }
        });

        result = { data: Object.entries(breakdown).map(([method, total]) => ({ _id: method, total })) };
      } else if (path === "/dashboard/category-sales") {
        let txns: any[] = [];
        let sosCredits: any[] = [];
        let productsMap: any = {};
        try {
          if (navigator.onLine) {
            const [tSnap, sSnap, pSnap] = await Promise.all([
              getDocs(collection(firestore, "transactions")),
              getDocs(collection(firestore, "sos_credits")),
              getDocs(collection(firestore, "products"))
            ]);
            txns = tSnap.docs.map(d => d.data());
            sosCredits = sSnap.docs.map(d => d.data());
            productsMap = pSnap.docs.reduce((acc, d) => ({ ...acc, [d.data().id]: d.data() }), {} as any);
          }
        } catch (e) {}

        const catSales: Record<string, number> = {};
        const processItems = (records: any[]) => {
          records.forEach(data => {
            data.items?.forEach((item: any) => {
              const pId = item.productId || item.id;
              const cat = productsMap[pId]?.category || "Other";
              catSales[cat] = (catSales[cat] || 0) + (item.price * (item.qty || item.quantity || 0));
            });
          });
        };

        processItems(txns.filter(t => t.status !== 'voided'));
        processItems(sosCredits.filter(s => s.paymentStatus === 'completed' && s.status !== 'voided'));

        result = { data: Object.entries(catSales).map(([name, value]) => ({ name, value })) };
      } else if (path === "/gcash") {
        let gcash: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "gcash_transactions"));
            gcash = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            gcash.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          }
        } catch (e) {
          console.warn("Firestore gcash fetch failed:", e);
        }

        if (gcash.length === 0) {
          const cached = await dexieDb.gcash.toArray();
          gcash = cached.length > 0 ? cached : [];
        }

        result = { data: gcash };
        if (gcash.length > 0) {
          await dexieDb.gcash.bulkPut(gcash);
        }
      } else if (path === "/gcash_accounts") {
        let accounts: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "gcash_accounts"));
            accounts = snap.docs.map(d => this.sanitizeData({ id: d.id, ...d.data() }));
          }
        } catch (e) {
          console.warn("Firestore gcash_accounts fetch failed:", e);
        }

        if (accounts.length === 0) {
          const cached = await dexieDb.gcashAccounts.toArray();
          accounts = cached.length > 0 ? cached : [];
        }

        result = { data: accounts };
        if (accounts.length > 0) {
          await dexieDb.gcashAccounts.bulkPut(accounts);
        }
      } else if (path === "/orders") {
        let orders: any[] = [];
        try {
          if (navigator.onLine) {
            const snap = await getDocs(collection(firestore, "orders"));
            orders = snap.docs.map(d => this.sanitizeData({ id: d.id, _id: d.id, ...d.data() }));
            orders.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          }
        } catch (e) {
          console.warn("Firestore orders fetch failed:", e);
        }

        if (orders.length === 0) {
          const cached = await dexieDb.orders.toArray();
          orders = cached.length > 0 ? cached : [];
        }

        result = { data: orders };
        if (orders.length > 0) {
          await dexieDb.orders.bulkPut(orders);
        }
      } else {
        result = { data: [] };
      }
      
      return result;
    } catch (err: any) {
      console.error("API Get General Failure:", err);
      return { data: [], error: err.message };
    }
  },

  async getPayMongoBalance() {
    try {
      const response = await axios.get("/api/paymongo-balance");
      return { data: response.data };
    } catch (err: any) {
      console.error("API Get PayMongo Balance Failure:", err);
      return { error: err.response?.data?.error || err.message, data: null };
    }
  },

  async post(path: string, body: any) {
    const tempId = body.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();
    let dataWithId = { 
      ...body, 
      id: tempId,
      created_at: body.created_at || now 
    };
    
    // Sanitize borrower_id
    if (dataWithId.borrower_id) {
      dataWithId.borrower_id = dataWithId.borrower_id.replace(/^#/, "");
    }

    // Deduct stock locally in Dexie immediately (Offline-First approach)
    if (path === "/transactions" || path === "/sos_credits") {
      try {
        if (dataWithId.items && Array.isArray(dataWithId.items)) {
          for (const item of dataWithId.items) {
            const pId = item.productId || item.id;
            const qty = item.qty || item.quantity || 0;
            if (pId) {
              await dexieDb.products.where("id").equals(pId).modify(p => {
                p.stock = Math.max(0, (p.stock || 0) - qty);
              });
            }
          }
        }
      } catch (err) {
        console.warn("Local stock deduction failed:", err);
      }
    }

    try {
      if (!navigator.onLine) {
        throw new Error("offline");
      }

      if (path === "/transactions") {
        const txnRef = doc(firestore, "transactions", tempId);
        const batch = writeBatch(firestore);
        
        // Include items in main document
        batch.set(txnRef, { ...dataWithId, created_at: dataWithId.created_at || new Date().toISOString() });
        
        // Deduct stock from products on Firestore and prepare subcollection items
        for (const item of dataWithId.items) {
          const itemRef = doc(collection(txnRef, "items"));
          batch.set(itemRef, item);
          
          if (item.productId) {
            const productRef = doc(firestore, "products", item.productId);
            batch.update(productRef, {
              stock: increment(-(item.qty || 0))
            });
          }
        }
        
        await batch.commit();
      } else if (path === "/sos_credits") {
        const recordRef = doc(firestore, "sos_credits", tempId);
        const batch = writeBatch(firestore);
        batch.set(recordRef, dataWithId);

        if (dataWithId.items && Array.isArray(dataWithId.items)) {
          for (const item of dataWithId.items) {
            const pId = item.productId || item.id;
            const qty = item.qty || item.quantity || 0;
            if (pId) {
              const productRef = doc(firestore, "products", pId);
              batch.update(productRef, {
                stock: increment(-qty)
              });
            }
          }
        }
        await batch.commit();
      } else if (path === "/products") {
        await setDoc(doc(firestore, "products", tempId), dataWithId);
      } else if (path === "/categories") {
        await setDoc(doc(firestore, "categories", body.name), body);
      } else if (path === "/credits") {
        await setDoc(doc(firestore, "credits", tempId), dataWithId);
      } else if (path === "/printing") {
        await setDoc(doc(firestore, "printing_records", tempId), dataWithId);
      } else if (path === "/printing_expenses") {
        await setDoc(doc(firestore, "printing_expenses", tempId), dataWithId);
      } else if (path === "/order_expenses") {
        await setDoc(doc(firestore, "order_expenses", tempId), dataWithId);
      } else if (path === "/customers") {
        await setDoc(doc(firestore, "customers", tempId), dataWithId);
      } else if (path === "/staff") {
        await setDoc(doc(firestore, "staff", tempId), dataWithId);
      } else if (path === "/attendance") {
        const docId = tempId;
        await setDoc(doc(firestore, "attendance", String(docId)), dataWithId);
      } else if (path === "/gcash") {
        await setDoc(doc(firestore, "gcash_transactions", tempId), dataWithId);
        await dexieDb.gcash.put(dataWithId);
      } else if (path === "/gcash_accounts") {
        await setDoc(doc(firestore, "gcash_accounts", tempId), dataWithId);
        await dexieDb.gcashAccounts.put(dataWithId);
      } else if (path === "/orders") {
        await setDoc(doc(firestore, "orders", tempId), dataWithId);
        await dexieDb.orders.put(dataWithId);
      }

      return { data: dataWithId };
    } catch (err: any) {
      // Queue for offline
      const offlineCompatible = ["/transactions", "/sos_credits", "/printing", "/printing_expenses", "/products", "/categories", "/credits", "/customers", "/staff", "/attendance", "/gcash", "/orders"];
      if (offlineCompatible.includes(path)) {
        await dexieDb.pendingTransactions.add({
          path,
          method: 'POST',
          data: dataWithId,
          status: 'pending',
          timestamp: Date.now()
        });
        // Trigger background sync attempt
        this.syncPendingTransactions().catch(console.error);
        return { data: dataWithId, source: 'offline' };
      }
      throw err;
    }
  },

  async put(path: string, body: any) {
    const parts = path.split("/");
    const collectionName = parts[1];
    const id = parts[2];
    const action = parts[3];

    // Sanitize borrower_id
    if (body.borrower_id) {
      body.borrower_id = body.borrower_id.replace(/^#/, "");
    }

    try {
      if (!navigator.onLine) {
        throw new Error("offline");
      }

      const collectionMap: Record<string, string> = {
        'gcash': 'gcash_transactions',
        'printing': 'printing_records'
      };

      const actualCollection = collectionMap[collectionName] || collectionName;

      if ((actualCollection === "transactions" || actualCollection === "sos_credits") && action === "void") {
        const collectionToUse = actualCollection;
        const docRef = doc(firestore, collectionToUse, id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          throw new Error("Record not found");
        }

        const data = docSnap.data();
        if (data.status === "voided") {
          return { data };
        }

        const batch = writeBatch(firestore);
        
        // Mark as voided
        batch.update(docRef, { 
          status: "voided", 
          voidedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Return stock
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            const pId = item.productId || item.id;
            const q = item.qty || item.quantity || 0;
            if (pId) {
              const productRef = doc(firestore, "products", pId);
              batch.update(productRef, {
                stock: increment(q)
              });
            }
          }
        }

        await batch.commit();

        // Also update local stock if cached
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            const pId = item.productId || item.id;
            const q = item.qty || item.quantity || 0;
            if (pId) {
              await dexieDb.products.where("id").equals(pId).modify(p => {
                p.stock = (p.stock || 0) + q;
              });
            }
          }
        }

        return { data: { ...data, status: "voided" } };
      }

      const docRef = doc(firestore, actualCollection, id);
      // Remove internal _id if present before sending to Firestore
      const { _id, ...cleanBody } = body;
      await updateDoc(docRef, cleanBody);

      // Update local storage if needed
      if (actualCollection === "gcash_transactions") {
        await dexieDb.gcash.put({ ...cleanBody, id });
      } else if (actualCollection === "gcash_accounts") {
        await dexieDb.gcashAccounts.put({ ...cleanBody, id });
      } else if (actualCollection === "orders") {
        await dexieDb.orders.put({ ...cleanBody, id });
      }
      
      return { data: { ...cleanBody, id } };
    } catch (err: any) {
      const offlineCompatiblePrefixes = ["/products", "/credits", "/attendance", "/staff", "/customers", "/gcash", "/gcash_accounts", "/orders"];
      const isCompatible = offlineCompatiblePrefixes.some(prefix => path.startsWith(prefix));

      if (isCompatible) {
        await dexieDb.pendingTransactions.add({
          path,
          method: 'PUT',
          data: body,
          status: 'pending',
          timestamp: Date.now()
        });
        // Trigger background sync attempt
        this.syncPendingTransactions().catch(console.error);
        return { data: body, source: 'offline', queued: true };
      }
      throw err;
    }
  },

  async delete(path: string) {
    const parts = path.split("/");
    const id = parts[parts.length - 1];
    const collectionName = parts[1];

    try {
      if (!navigator.onLine) {
        throw new Error("requires_online");
      }

      const collectionMap: Record<string, string> = {
        'gcash': 'gcash_transactions',
        'printing': 'printing_records'
      };

      const actualCollection = collectionMap[collectionName] || collectionName;

      await deleteDoc(doc(firestore, actualCollection, id));

      // Handle local deletion for specific collections
      if (actualCollection === "gcash_transactions") {
        await dexieDb.gcash.delete(id);
      } else if (actualCollection === "gcash_accounts") {
        await dexieDb.gcashAccounts.delete(id);
      } else if (actualCollection === "orders") {
        await dexieDb.orders.delete(id);
      } else if (actualCollection === "products") {
        await dexieDb.products.delete(id);
      } else if (actualCollection === "customers") {
        await dexieDb.customers.delete(id);
      } else if (actualCollection === "staff") {
        await dexieDb.staff.delete(id);
      } else if (actualCollection === "credits") {
        await dexieDb.credits.delete(id);
      }
      
      return { success: true };
    } catch (err: any) {
      this.handleError(err);
    }
  },
};
