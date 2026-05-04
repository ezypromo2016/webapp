/**
 * Storage Utility
 * Wraps localStorage + IndexedDB for offline transaction queue
 */

const Storage = (() => {
  const PREFIX = 'swiftpos_';

  return {
    get: (key) => {
      try {
        const val = localStorage.getItem(PREFIX + key);
        return val ? JSON.parse(val) : null;
      } catch { return null; }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.warn('Storage set failed:', err);
        return false;
      }
    },

    remove: (key) => {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch {}
    },

    clear: () => {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(PREFIX))
          .forEach(k => localStorage.removeItem(k));
      } catch {}
    },

    // Cache data with TTL (in seconds)
    cache: (key, value, ttlSeconds = 300) => {
      Storage.set(`cache_${key}`, {
        data: value,
        expires: Date.now() + (ttlSeconds * 1000),
      });
    },

    getCache: (key) => {
      const cached = Storage.get(`cache_${key}`);
      if (!cached) return null;
      if (Date.now() > cached.expires) {
        Storage.remove(`cache_${key}`);
        return null;
      }
      return cached.data;
    },
  };
})();

/**
 * IndexedDB for offline transaction queue
 */
const OfflineDB = (() => {
  let db = null;
  const DB_NAME = 'swiftpos_offline';
  const DB_VERSION = 1;
  const STORE_NAME = 'transactions';

  const open = () => new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'offlineId' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });

  return {
    /**
     * Queue a transaction when offline
     */
    queueTransaction: async (txnData) => {
      const database = await open();
      const offlineId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const record = { ...txnData, offlineId, createdAt: new Date().toISOString(), synced: false };

      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add(record);
        tx.oncomplete = () => resolve(offlineId);
        tx.onerror = () => reject(tx.error);
      });
    },

    /**
     * Get all unsynced transactions
     */
    getPending: async () => {
      const database = await open();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result.filter(r => !r.synced));
        req.onerror = () => reject(req.error);
      });
    },

    /**
     * Mark a transaction as synced
     */
    markSynced: async (offlineId) => {
      const database = await open();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(offlineId);
        req.onsuccess = () => {
          const record = req.result;
          if (record) { record.synced = true; store.put(record); }
          resolve();
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = resolve;
      });
    },

    /**
     * Get count of pending transactions
     */
    getPendingCount: async () => {
      const pending = await OfflineDB.getPending();
      return pending.length;
    },
  };
})();
