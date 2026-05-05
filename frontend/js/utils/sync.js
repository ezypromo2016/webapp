/**
 * Offline Sync Utility
 * Syncs queued offline transactions when connection is restored
 */

const Sync = (() => {
  let isSyncing = false;

  const syncOfflineTransactions = async () => {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const pending = await OfflineDB.getPending();
      if (pending.length === 0) return;

      console.log(`[Sync] Syncing ${pending.length} offline transactions...`);
      Toast.show(`Syncing ${pending.length} offline transaction(s)...`, 'info');

      let successCount = 0;
      let failCount = 0;

      for (const txn of pending) {
        try {
          const { offlineId, synced, createdAt, ...txnData } = txn;
          await API.post('/transactions', { ...txnData, offlineId, isOffline: true });
          await OfflineDB.markSynced(offlineId);
          successCount++;
        } catch (err) {
          console.error('[Sync] Failed to sync transaction:', txn.offlineId, err);
          failCount++;
        }
      }

      if (successCount > 0) Toast.show(`✓ Synced ${successCount} transaction(s)`, 'success');
      if (failCount > 0) Toast.show(`${failCount} transaction(s) failed to sync`, 'error');

      // Update badge in sidebar
      window.App?.updateOfflineBadge?.();
    } catch (err) {
      console.error('[Sync] Sync error:', err);
    } finally {
      isSyncing = false;
    }
  };

  // Listen for online event
  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('pos:online'));
    setTimeout(syncOfflineTransactions, 1500);
  });

  // Listen for SW sync message
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_OFFLINE_TRANSACTIONS') {
      syncOfflineTransactions();
    }
  });

  return {
    sync: syncOfflineTransactions,
  };
})();

window.Sync = Sync;
