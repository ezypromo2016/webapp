const fs = require('fs');
const path = './src/pages/SendMoney.tsx';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('activeTab')) {
    // Add lucide icons if missing: Smartphone, Wifi, Radio
    code = code.replace(/import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*"lucide-react";/, `import {\n  Smartphone,\n  Wifi,\n  Radio,\n$1\n} from "lucide-react";`);

    // Add Tabs state and E-Load states
    const statesToAdd = `
  const [activeTab, setActiveTab] = useState<"send-money" | "e-load">("send-money");

  // E-Load States
  const [eloadPhone, setEloadPhone] = useState("");
  const [eloadNetwork, setEloadNetwork] = useState("SMART");
  const [eloadPackageType, setEloadPackageType] = useState<"regular" | "promo">("regular");
  const [eloadAmount, setEloadAmount] = useState("");
  const [eloadPromo, setEloadPromo] = useState("");
  const [isEloading, setIsEloading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleEload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setErrorMessage("Connection lost. E-loading require live internet validation.");
      setStatus("error");
      return;
    }

    // Validation
    const phoneRegex = /^09\\d{9}$/;
    if (!phoneRegex.test(eloadPhone)) {
       setErrorMessage("Invalid phone number. Must start with 09 and be exactly 11 digits.");
       setStatus("error");
       return;
    }

    if (eloadPackageType === "regular" && !parseFloat(eloadAmount)) {
       setErrorMessage("Please enter a valid amount.");
       setStatus("error");
       return;
    }

    if (eloadPackageType === "promo" && !eloadPromo) {
       setErrorMessage("Please select a promo.");
       setStatus("error");
       return;
    }

    setIsEloading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const response = await axios.post('/api/buy-load', {
        phoneNumber: eloadPhone,
        telcoNetwork: eloadNetwork,
        amountOrPromoCode: eloadPackageType === "regular" ? eloadAmount : eloadPromo,
        senderId: user?.uid,
        senderName: user?.customUsername || user?.name || "User",
        senderEmail: user?.email
      });
      
      // Update balance if possible
      fetchBalance();
      fetchTransactions();
      setStatus("success");
      
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.response?.data?.message || err.message || "E-Loading failed");
    } finally {
      setIsEloading(false);
    }
  };
`;

    code = code.replace('const [sidebarOpen, setSidebarOpen] = useState(false);', statesToAdd + '\n  const [sidebarOpen, setSidebarOpen] = useState(false);');

    // Add Tabs UI above the form in the main view
    const renderTabs = `
          {/* Tabs */}
          <div className="flex bg-slate-200/50 dark:bg-white/5 rounded-2xl p-1 mb-8">
            <button
              onClick={() => { setActiveTab("send-money"); setStatus("idle"); setErrorMessage(""); }}
              className={\`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all \${activeTab === "send-money" ? "bg-white dark:bg-[#1a1b23] text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-700"}\`}
            >
              Send Money
            </button>
            <button
              onClick={() => { setActiveTab("e-load"); setStatus("idle"); setErrorMessage(""); }}
              className={\`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all \${activeTab === "e-load" ? "bg-white dark:bg-[#1a1b23] text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-700"}\`}
            >
              E-Loading
            </button>
          </div>
`;

    // Replace the opening form condition. Currently it just renders the send money form inside <div className="space-y-6"> maybe inside a card. Let's find it.
    code = code.replace(/\{status === "idle" && \([\s\S]*?<form onSubmit=\{handleTransfer\} className="space-y-6">/, `
        {/* Render Tabs Here */}
$1
        ${renderTabs}

        {status === "idle" && (activeTab === "send-money" ? (
          <form onSubmit={handleTransfer} className="space-y-6">
    `);

    // The SendMoney form ends at:
    const paymentFormEnd = `                <button
                  type="submit"
                  disabled={isSubmitting || loadingBalance}
                  className={\`w-full py-4 \${isPadalaOnlyUser ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-slate-900 hover:bg-indigo-600 dark:bg-white dark:text-slate-900'} text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all font-sans disabled:opacity-50 flex items-center justify-center gap-2\`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send to {provider.name}
                    </>
                  )}
                </button>
              </form>
            )`;

    const eloadForm = `
            ) : (
              <form onSubmit={handleEload} className="space-y-6">
                {!isOnline && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                    <Wifi className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <h4 className="text-sm font-black text-rose-600 dark:text-rose-400">Connection Lost</h4>
                      <p className="text-xs text-rose-500 dark:text-rose-300 font-bold mt-1">E-loading requires live internet validation. Please reconnect.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Phone Input */}
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                      Mobile Number
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 border-r border-slate-200 dark:border-white/10 text-slate-400 font-bold text-sm">
                        +63
                      </div>
                      <input
                        type="text"
                        value={eloadPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length <= 11) setEloadPhone(val);
                        }}
                        placeholder="09171234567"
                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-3.5 pl-14 pr-4 transition-all focus:outline-none focus:border-indigo-500 font-black text-slate-900 dark:text-white"
                        required
                        disabled={!isOnline}
                      />
                    </div>
                  </div>

                  {/* Network Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                      Network Provider
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {["SMART", "GLOBE", "DITO"].map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setEloadNetwork(net)}
                          className={\`py-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 \${eloadNetwork === net ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400" : "bg-white dark:bg-black/20 border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/20"}\`}
                        >
                          <Radio className={\`w-3.5 h-3.5 \${eloadNetwork === net ? 'text-indigo-500' : 'text-slate-400'}\`} />
                          {net}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Package Type Tabs */}
                  <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                    <button type="button" onClick={() => setEloadPackageType('regular')} className={\`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all \${eloadPackageType === 'regular' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}\`}>
                      Regular Load
                    </button>
                    <button type="button" onClick={() => setEloadPackageType('promo')} className={\`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all \${eloadPackageType === 'promo' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}\`}>
                      Promo Packages
                    </button>
                  </div>

                  {/* Value Inputs */}
                  {eloadPackageType === 'regular' ? (
                     <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                          Load Amount (PHP)
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="number"
                            value={eloadAmount}
                            onChange={(e) => setEloadAmount(e.target.value)}
                            placeholder="100.00"
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl py-3.5 pl-12 pr-4 transition-all focus:outline-none focus:border-indigo-500 font-black text-slate-900 dark:text-white"
                            required={eloadPackageType === 'regular'}
                            disabled={!isOnline}
                          />
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                          Promo Code
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {["GIGA99", "GO50", "UNLI299", "ALLIN99"].map((promo) => (
                             <button
                                key={promo}
                                type="button"
                                onClick={() => setEloadPromo(promo)}
                                className={\`py-3 rounded-xl border text-[11px] font-black uppercase tracking-[0.2em] transition-all \${eloadPromo === promo ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/5 text-slate-500'}\`}
                             >
                               {promo}
                             </button>
                          ))}
                        </div>
                     </div>
                  )}

                </div>

                <button
                  type="submit"
                  disabled={isEloading || !isOnline}
                  className={\`w-full py-4 \${isPadalaOnlyUser ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600 dark:bg-white dark:text-slate-900'} text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all font-sans disabled:opacity-50 flex items-center justify-center gap-2\`}
                >
                  {isEloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending E-Load...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-5 h-5" />
                      Buy Load
                    </>
                  )}
                </button>

              </form>
            ))}`;

    code = code.replace(paymentFormEnd, paymentFormEnd.replace('             )', '') + eloadForm);

    // Update success view logic to also show for e-load
    // Instead of saying "PHP X has been sent to Y", let's handle both
    const successViewContent = `
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
              {activeTab === "send-money" ? "Transfer Successful" : "E-Load Successful"}
            </h2>
            <p className="text-slate-500 text-sm font-bold">
              {activeTab === "send-money" 
                ? \`PHP \${parseFloat(amount).toLocaleString()} has been sent to \${accountName}.\` 
                : \`\${eloadPackageType === 'regular' ? '₱' + eloadAmount : eloadPromo} sent to \${eloadPhone}.\`
              }
            </p>
          </div>
`;
    // We replace the block from <div className="text-center mb-8"> to </div>
    const successOld = `<div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
              Transfer Successful
            </h2>
            <p className="text-slate-500 text-sm font-bold">
              PHP {parseFloat(amount).toLocaleString()} has been sent to{" "}
              {accountName}.
            </p>
          </div>`;

    code = code.replace(successOld, successViewContent);

    // Make Make Another ... button say Make Another Transfer or Buy Another Load
    const makeAnotherBtn = `<button
            onClick={() => {
              setStatus("idle");
              if (activeTab === "send-money") {
                setAmount("");
                setAccountName("");
                setAccountNumber("");
                setDescription("");
              } else {
                setEloadPhone("");
                setEloadAmount("");
                setEloadPromo("");
              }
              fetchBalance();
              fetchTransactions();
            }}
            className={\`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all font-sans \${isPadalaOnlyUser ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20' : 'bg-white/5 hover:bg-white/10 text-slate-300'}\`}
          >
            {activeTab === "send-money" ? "Make Another Transfer" : "Buy Another Load"}
          </button>`;
    
    // find Make Another Transfer button
    code = code.replace(/<button[\s\S]*?Make Another Transfer\s*<\/button>/, makeAnotherBtn);

    fs.writeFileSync(path, code);
    console.log("Updated SendMoney.tsx");
} else {
    console.log("Already updated");
}
