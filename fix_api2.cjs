const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/api.ts');
let content = fs.readFileSync(file, 'utf8');

// Undo the unintended replace in "/transactions"
content = content.replace(
  /let txns: any\[\] = \[\];\n        let pendingTxns: any\[\] = \[\];/,
  `let txns: any[] = [];`
);

content = content.replace(
  /if \(txns\.length === 0\) \{\n          txns = Storage\.get\("cached_transactions"\) \|\| \[\];\n        \}\n        \n        try \{\n          const pending = await dexieDb\.pendingTransactions\.where\('path'\)\.equals\('\/transactions'\)\.toArray\(\);\n          pendingTxns = pending\.map\(\(p: any\) => \(\{\n             \.\.\.p\.data,\n             _id: p\.data\.id \|\| p\.data\._id,\n             queued: true,\n             localId: p\.id\n          \}\)\);\n        \} catch\(e\) \{\}\n        \n        txns = \[\.\.\.pendingTxns, \.\.\.txns\];\n/,
  `if (txns.length === 0) {
          txns = Storage.get("cached_transactions") || [];
        }
`
);

// Now explicitly target "/dashboard/summary"
content = content.replace(
  /\} else if \(path === "\/dashboard\/summary"\) \{\n        let txns: any\[\] = \[\];/,
  `} else if (path === "/dashboard/summary") {
        let txns: any[] = [];
        let pendingTxns: any[] = [];`
);

content = content.replace(
  /if \(txns\.length === 0\) \{\n          txns = Storage\.get\("cached_transactions"\) \|\| \[\];\n        \}/g,
  (match, offset, string) => {
    // Only apply in dashboard/summary block (which should be around index 20000+, not 10000)
    // Actually we can check if it's the second match, or just use string index
    if (offset > 15000) {
      return `if (txns.length === 0) {
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
        
        txns = [...pendingTxns, ...txns];`;
    }
    return match;
  }
);

fs.writeFileSync(file, content);
console.log('Fixed src/lib/api.ts logic');
