# SwiftPOS Offline/Online Features

## Overview
SwiftPOS now supports full offline operation with automatic synchronization when connection is restored.

## Features

### 1. **Offline Login**
- Users and admins can login with cached credentials when offline
- Credentials are securely stored (base64 encoded) for offline access
- First login must be online to establish the session

### 2. **Offline POS Operations**
- Create transactions completely offline
- Add items to cart, apply discounts, select payment methods
- All transactions are queued in IndexedDB when offline
- Works seamlessly with both online and offline modes

### 3. **Automatic Data Caching**
- All GET requests are automatically cached for 1 hour
- Products, categories, inventory data available offline
- Cached data used as fallback when network unavailable
- Fresh data fetched and cached when online

### 4. **Automatic Synchronization**
- Pending transactions automatically sync when connection restored
- Real-time sync on online event
- Auto-sync check every 30 seconds if online
- Clear success/failure notifications

### 5. **Network Status Indicator**
- Online/Offline indicator in topbar (green when online, orange when offline)
- Visual feedback on connection changes
- Toast notifications when connection state changes
- Auto-sync notifications show progress

## How It Works

### Login Flow (Offline)
1. User enters email and password
2. If offline and credentials match cached account → login allowed
3. If offline and no match → login denied with error
4. First login always requires internet connection

### Transaction Flow (Offline)
1. User creates transaction while offline
2. Transaction is queued to IndexedDB with unique offline ID
3. Receipt is generated locally
4. Toast shows "Saved offline. Will sync when online."
5. When online, automatically syncs to server

### Data Caching Strategy
- **GET requests**: Cached for 1 hour, used as fallback
- **Failed requests**: Automatically fall back to cached data
- **Cache key**: `api_${endpoint}` stored in localStorage
- **TTL**: Configurable per request (default 3600 seconds)

### Sync Behavior
1. **On Connection Restored**
   - Immediate sync triggered
   - 1.5 second delay to ensure stable connection
   - Auto-sync every 30 seconds while offline items pending

2. **Retry Logic**
   - Failed transactions marked as failed
   - User notified of failures
   - Can retry manually later

3. **Notifications**
   - Success: "✓ Synced X transaction(s)"
   - Failures: "X transaction(s) failed to sync"
   - In-progress: "Syncing X offline transaction(s)..."

## Technical Details

### Storage Architecture
- **localStorage**: Tokens, user data, credentials, cached API responses
- **IndexedDB**: Offline transaction queue (survives browser restart)
- **SessionStorage**: Temporary UI state

### Service Worker
- Caches static assets on install
- Network-First strategy for API calls
- Cache-First strategy for images and static assets
- Automatic cache cleanup on updates

### Files Modified
- `frontend/js/utils/api.js` - Added GET request caching
- `frontend/js/utils/storage.js` - Already supports offline DB
- `frontend/js/utils/sync.js` - Auto-sync on online
- `frontend/js/modules/auth.js` - Offline login support
- `frontend/js/modules/pos.js` - Already queues offline transactions
- `frontend/js/app.js` - Network status management
- `frontend/index.html` - App initialization & service worker registration

## Configuration

### Cache TTL (Time To Live)
Default: 3600 seconds (1 hour)

To change, edit `api.js`:
```javascript
Storage.cache(`api_${endpoint}`, json, 3600); // Change 3600 to desired seconds
```

### Auto-sync Interval
Default: 30 seconds

To change, edit `index.html` startup script:
```javascript
setInterval(async () => { ... }, 30000); // Change 30000 to desired milliseconds
```

### Offline Login Credentials
Encrypted with base64 (for demo, should use proper encryption in production)

To disable offline login, modify `auth.js`:
```javascript
// Remove the cached credentials fallback logic
```

## Best Practices

1. **First Login**: Always ensure users login online to establish initial session
2. **Testing**: Test offline by:
   - Using DevTools Network tab → "Offline" checkbox
   - Disconnecting WiFi/network
   - Using throttling to simulate slow connection
3. **Monitoring**: Check browser console for `[Sync]` and `[Network]` logs
4. **Production**: Consider enabling proper credentials encryption

## Troubleshooting

### Transactions Not Syncing
1. Check if device is actually online (check topbar indicator)
2. Open browser console for `[Sync]` debug logs
3. Check if pending transactions exist: `await OfflineDB.getPending()`
4. Verify server endpoint `/api/transactions` is working

### Login Failed Offline
1. Ensure you've logged in at least once while online
2. Email must match the cached account exactly
3. Check if offline credentials are stored: `localStorage.swiftpos_login_credentials`

### Data Not Loading Offline
1. Verify products were loaded while online (cache is populated)
2. Check IndexedDB in DevTools → IndexedDB → swiftpos_offline
3. Try refreshing the page to trigger cache

### Manual Sync
Run in browser console:
```javascript
await Sync.sync();
```

## Future Enhancements
- Proper credential encryption (bcrypt or similar)
- Conflict resolution for offline edits
- Background sync using Background Sync API
- Offline analytics tracking
- Periodic cache refresh
