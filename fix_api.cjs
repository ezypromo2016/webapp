const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/api.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace todayStr generation with something we don't strictly need, but we'll use Date object directly
content = content.replace(
  /const now = new Date\(\);\s*const todayStr = now\.toISOString\(\)\.split\('T'\)\[0\];\s*const currentYear = now\.getFullYear\(\);\s*const currentMonth = now\.getMonth\(\);/,
  `const now = new Date();\n        const currentYear = now.getFullYear();\n        const currentMonth = now.getMonth();\n        const currentDate = now.getDate();`
);

// We need to fetch pending transactions as well in /dashboard/summary!
// Let's modify the place where txns is defined.
content = content.replace(
  /let txns: any\[\] = \[\];/,
  `let txns: any[] = [];\n        let pendingTxns: any[] = [];`
);

// Add pending txns fetch to offline
content = content.replace(
  /if \(txns\.length === 0\) \{\s*txns = Storage\.get\("cached_transactions"\) \|\| \[\];\s*\}/,
  `if (txns.length === 0) {
          txns = Storage.get("cached_transactions") || [];
        }
        
        try {
          const pending = await dexieDb.pendingTransactions.where('path').equals('/transactions').toArray();
          pendingTxns = pending.map((p: any) => ({
             ...p.data,
             _id: p.data.id || p.data._id,
             queued: true,
             localId: p.id
          }));
        } catch(e) {}
        
        txns = [...pendingTxns, ...txns];
`
);

content = content.replace(
  /const todayTxns = activeTxns\.filter\(d => d\.created_at\?\.startsWith\(todayStr\)\);/,
  `const todayTxns = activeTxns.filter(d => {
          if (!d.created_at) return false;
          const date = new Date(d.created_at);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth && date.getDate() === currentDate;
        });`
);

content = content.replace(
  /const todayPrinting = activePrinting\.filter\(d => d\.created_at\?\.startsWith\(todayStr\)\);/,
  `const todayPrinting = activePrinting.filter(d => {
          if (!d.created_at) return false;
          const date = new Date(d.created_at);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth && date.getDate() === currentDate;
        });`
);

content = content.replace(
  /const todaySOS = completedSOS\.filter\(s => s\.completedAt\?\.startsWith\(todayStr\) \|\| \(s\.paymentStatus === 'completed' && s\.timestamp\?\.startsWith\(todayStr\)\)\);/,
  `const todaySOS = completedSOS.filter(s => {
          const dateStr = s.completedAt || s.timestamp;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth && date.getDate() === currentDate;
        });`
);

content = content.replace(
  /const calculateProfit = \(records: any\[\]\) => \{[\s\S]*?\}, 0\);\s*\};/,
  `const calculateProfit = (records: any[]) => {
          return records.reduce((acc, txn) => {
            if (!txn.items) return acc;
            return acc + txn.items.reduce((sum: number, item: any) => sum + ((item.qty || item.quantity || 0) * ((item.price || 0) - (item.cost || 0))), 0);
          }, 0);
        };`
);

fs.writeFileSync(file, content);
console.log("Replaced!")
