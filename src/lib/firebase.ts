import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  CACHE_SIZE_UNLIMITED 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ✅ FIXED: Modern Firestore initialization utilizing multi-tab sync to stop persistence access lockouts
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
}, firebaseConfig.firestoreDatabaseId);

// Test connection silently as per constraints
async function testConnection() {
  if (!navigator.onLine) return;
  
  try {
    await getDocFromServer(doc(db, '_health_', 'check'));
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn("Firestore access restricted (Permissions). This is normal for guests.");
    } else if (error?.code === 'unavailable' || String(error).includes('offline')) {
      console.warn("Firestore running in offline mode. Connection unavailable.");
    }
  }
}
testConnection();

let storageInstance: any;
try {
  storageInstance = getStorage(app);
} catch (error) {
  console.warn("Firebase Storage is not available:", error);
}

export const storage = storageInstance;