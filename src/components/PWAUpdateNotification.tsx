import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PWAUpdateNotification: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[10000] w-full max-w-sm"
        >
          <div className="bg-[#1c1d26] border border-indigo-500/30 rounded-3xl p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                needRefresh ? 'bg-indigo-600 text-white' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                {needRefresh ? <RefreshCw className="w-6 h-6" /> : <ArrowUpCircle className="w-6 h-6" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">
                  {needRefresh ? 'New Version Available' : 'Ready for Offline'}
                </h4>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-wider">
                  {needRefresh 
                    ? 'A new update is available. Refresh now to experience the latest features and fixes.' 
                    : 'System successfully cached for offline use. You can now use the app without internet.'}
                </p>
              </div>

              <button 
                onClick={close}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {needRefresh ? (
                <button
                  onClick={() => updateServiceWorker(true)}
                  className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Upgrade System
                </button>
              ) : (
                <button
                  onClick={close}
                  className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdateNotification;
