import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with settings for better network resilience
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
}, firebaseConfig.firestoreDatabaseId);

// Enable persistence for offline capability
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence status: Active in another tab');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence status: Browser not supported for offline mode');
    }
  });
} catch (e) {
  // Silent catch for initialization edge cases
}

// Test connection silently as per constraints
async function testConnection() {
  if (!navigator.onLine) return;
  
  try {
    // Attempt a lightweight server check
    await getDocFromServer(doc(db, '_health_', 'check'));
  } catch (error: any) {
    // Only log if it's a persistent config error, ignore transient network failures
    if (error?.code === 'permission-denied') {
      console.warn("Firestore access restricted (Permissions). This is normal for guests.");
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
