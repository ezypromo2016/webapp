const fs = require('fs');
const path = './src/pages/SendMoney.tsx';
let code = fs.readFileSync(path, 'utf8');

const renderTabs = `
          {/* Tabs */}
          <div className="flex bg-[#111218]/50 border border-white/5 rounded-2xl p-1 mb-8">
            <button
              onClick={() => { setActiveTab("send-money"); setStatus("idle"); setErrorMessage(""); }}
              className={\`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all \${activeTab === "send-money" ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}
            >
              Send Money
            </button>
            <button
              onClick={() => { setActiveTab("e-load"); setStatus("idle"); setErrorMessage(""); }}
              className={\`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all \${activeTab === "e-load" ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}
            >
              E-Loading
            </button>
          </div>
`;

const eloadForm = `
        {activeTab === "e-load" && (
          <motion.form
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleEload}
            className="bg-[#111218] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-8"
          >
            {!isOnline && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                <Wifi className="w-5 h-5 text-rose-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-rose-600 dark:text-rose-400">Connection Lost</h4>
                  <p className="text-xs text-rose-500 dark:text-rose-300 font-bold mt-1">E-loading requires live internet validation. Please reconnect.</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Phone Input */}
              <div className="space-y-1.5 relative">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Mobile Number
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 border-r border-slate-200 dark:border-white/10 text-slate-600 group-focus-within:text-indigo-500 font-black text-sm">
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
                    className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-16 pr-4 text-white text-lg font-black placeholder-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                    required
                    disabled={!isOnline}
                  />
                </div>
              </div>

              {/* Network Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Network Provider
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {["SMART", "GLOBE", "DITO"].map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setEloadNetwork(net)}
                      className={\`py-4 rounded-xl border text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 \${eloadNetwork === net ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-inner" : "bg-white/5 border-white/5 text-slate-500 hover:border-white/20"}\`}
                    >
                      <Radio className={\`w-3.5 h-3.5 \${eloadNetwork === net ? 'text-indigo-500' : 'text-slate-500'}\`} />
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              {/* Package Type Tabs */}
              <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                <button type="button" onClick={() => setEloadPackageType('regular')} className={\`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all \${eloadPackageType === 'regular' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}\`}>
                  Regular Load
                </button>
                <button type="button" onClick={() => setEloadPackageType('promo')} className={\`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all \${eloadPackageType === 'promo' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}\`}>
                  Promo Packages
                </button>
              </div>

              {/* Value Inputs */}
              {eloadPackageType === 'regular' ? (
                 <div className="space-y-1.5 relative">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Load Amount (PHP)
                    </label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="number"
                        value={eloadAmount}
                        onChange={(e) => setEloadAmount(e.target.value)}
                        placeholder="100.00"
                        className="w-full bg-[#15161d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-lg font-black placeholder-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                        required={eloadPackageType === 'regular'}
                        disabled={!isOnline}
                      />
                    </div>
                 </div>
              ) : (
                 <div className="space-y-1.5 relative">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Promo Code
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {["GIGA99", "GO50", "UNLI299", "ALLIN99"].map((promo) => (
                         <button
                            key={promo}
                            type="button"
                            onClick={() => setEloadPromo(promo)}
                            className={\`py-4 rounded-xl border text-xs font-black uppercase tracking-[0.2em] transition-all \${eloadPromo === promo ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-inner' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}\`}
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
              className={\`w-full py-4 \${isPadalaOnlyUser ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-white hover:bg-white/90 text-slate-900'} rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all font-sans disabled:opacity-50 flex items-center justify-center gap-2\`}
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

          </motion.form>
        )}
`;

const wrapperStart = `
        ${renderTabs}
        
        {activeTab === "send-money" && (
          <motion.form
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}`;

code = code.replace(/<motion\.form\s*initial=\{\{\s*y:\s*20,\s*opacity:\s*0\s*\}\}\s*animate=\{\{\s*y:\s*0,\s*opacity:\s*1\s*\}\}/, wrapperStart);

// We need to close the `activeTab === "send-money" && (` condition at the end of the form.
const formEndMarker = `              </button>
            </motion.form>
`;
code = code.replace(/<\/form>/, `</motion.form>\n        )}\n\n        ${eloadForm}`);

fs.writeFileSync(path, code);
console.log("Applied E-Load UI tabs successfully.");
