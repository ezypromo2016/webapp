import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ── SAFE CONFIGURATION LOADING ────────────────────────────────────────────────
let firebaseConfig: any;

try {
  // We use Vite's dynamic glob import pattern to search for the asset silently.
  // This completely stops Vite from crashing during the build phase if the file is missing.
  const configModules = import.meta.glob("../../firebase-applet-config.json", { eager: true });
  const configPath = "../../firebase-applet-config.json";
  
  if (configModules[configPath]) {
    firebaseConfig = (configModules[configPath] as any).default || configModules[configPath];
    console.log("[CONFIG] Successfully imported configuration from local JSON file asset.");
  } else {
    throw new Error("File not found in bundle tree context");
  }
} catch (e) {
  console.log("[CONFIG] Configuration JSON file unresolvable. Falling back to Environment Variables context...");
  
  // Safe production fallback pulling from your active environment configurations
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cbkapparel-shop",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: "(default)"
  };
}
// ───────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with settings for better network resilience
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
}, firebaseConfig.firestoreDatabaseId || "(default)");

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