const fs = require('fs');
let code = fs.readFileSync('src/pages/SendMoney.tsx', 'utf8');

code = code.replace(
  '<div className="font-black text-sm uppercase text-white truncate pr-2 max-w-[140px] tracking-widest"',
  '<div className="font-black text-sm uppercase text-white truncate min-w-0 pr-2 tracking-widest flex-1"'
);

// Add Remitted Badge
const replaceTarget = `{tx.type} •{" "}
                          {tx.metadata?.bic || tx.metadata?.account || "-"}
                        </p>
                      </div>`;

const badgeCode = `{tx.type} •{" "}
                          {tx.metadata?.bic || tx.metadata?.account || "-"}
                        </p>
                        {remittanceStatus[tx.metadata?.senderUsername || "Unknown"] === "remitted" && (
                           <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                             Collected
                           </span>
                        )}
                      </div>`;

code = code.replace(replaceTarget, badgeCode);
fs.writeFileSync('src/pages/SendMoney.tsx', code);
