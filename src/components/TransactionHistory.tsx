import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Transaction } from '../types';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, Info, ChevronRight, Search, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  userId: string;
  limit?: number;
  userName?: string | null;
}

export default function TransactionHistory({ userId, limit, userName }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexError, setIndexError] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const qSender = query(
      collection(db, 'transactions'),
      where('senderId', '==', userId)
    );

    const qRecipient = query(
      collection(db, 'transactions'),
      where('recipientId', '==', userId)
    );

    let senderDocs: Transaction[] = [];
    let recipientDocs: Transaction[] = [];

    const handleSync = () => {
      const merged = [...(senderDocs || []), ...(recipientDocs || [])];
      const unique = Array.from(new Map(merged.filter(item => item && item.id).map(item => [item.id, item])).values());
      
      const sorted = unique.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val instanceof Date) return val.getTime();
          if (val.seconds) return val.seconds * 1000;
          if (typeof val === 'number') return val;
          return new Date(val).getTime() || 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });

      setTransactions(limit ? sorted.slice(0, limit) : sorted);
      setLoading(false);
      setIndexError(false);
    };

    const unsubSender = onSnapshot(qSender, (snapshot) => {
      senderDocs = (snapshot?.docs || []).map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      handleSync();
    }, (err: any) => {
      console.error("Firestore sender onSnapshot error:", err);
      if (err.code === 'failed-precondition' && err.message?.includes('index')) {
        setIndexError(true);
        setLoading(false);
      }
    });

    const unsubRecipient = onSnapshot(qRecipient, (snapshot) => {
      recipientDocs = (snapshot?.docs || []).map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      handleSync();
    }, (err: any) => {
      console.error("Firestore recipient onSnapshot error:", err);
    });

    return () => {
      unsubSender();
      unsubRecipient();
    };
  }, [userId, limit]);

  const uniqueUsers = Array.from(new Map<string, { id: string, name: string }>(
    transactions
      .filter(tx => tx.type === 'transfer')
      .map(tx => {
        const otherId = tx.senderId === userId ? tx.recipientId : tx.senderId;
        const otherName = tx.senderId === userId ? tx.recipientName : tx.senderName;
        return [otherId, { id: otherId, name: otherName || 'External User' }];
      })
  ).values());

  const filteredTransactions = transactions.filter(tx => {
    const otherName = tx.senderId === userId ? tx.recipientName : tx.senderName;
    const matchesSearch = !searchQuery || (otherName || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedUser) {
      const isUserMatch = tx.senderId === selectedUser || tx.recipientId === selectedUser;
      return matchesSearch && isUserMatch;
    }
    
    return matchesSearch;
  });

  if (loading) {
    return <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 glass rounded-[2rem] animate-pulse border-white/5" />
      ))}
    </div>;
  }

  if (indexError) {
    return (
      <div className="bg-amber-500/10 rounded-[2.5rem] p-8 border border-amber-500/20 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mb-2">
          <Info className="w-6 h-6" />
        </div>
        <p className="text-amber-100 font-black uppercase tracking-widest text-[10px]">Maintenance Required</p>
        <p className="text-amber-200/60 text-sm font-medium leading-relaxed max-w-xs">
          A dynamic index is powering this view. Please follow the setup link in your console to activate real-time tracking.
        </p>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="glass rounded-[2.5rem] p-12 text-center border-dashed border-white/10 flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-white/20" />
        </div>
        <p className="text-white/30 font-bold uppercase tracking-[0.2em] text-[10px]">No wallet activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!limit && (
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {uniqueUsers.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
              <button
                onClick={() => setSelectedUser(null)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                  !selectedUser ? 'bg-white text-slate-900 border-white' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10'
                }`}
              >
                All Use
              </button>
              {uniqueUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                    selectedUser === user.id ? 'bg-white text-slate-900 border-white' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-3 h-3 rounded-full" alt="" />
                  {user.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredTransactions.map((tx, index) => {
            const isSender = tx.senderId === userId;
            const isExpanded = expandedTx === tx.id;
            
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                key={tx.id}
                onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                className={`p-4 glass rounded-[1.5rem] border transition-all cursor-pointer group mb-2 ${
                  isExpanded ? 'border-blue-500/50 bg-white/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg ${
                      isSender ? 'bg-white/10 text-white' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {isSender ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm tracking-tight mb-1">
                        {tx.type === 'top-up' ? 'Wallet Top Up' : (isSender ? tx.recipientName || 'External Fund Transfer' : tx.senderName || 'Merchant Deposit')}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : tx.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                           {tx.status}
                        </span>
                        <span className="text-[10px] secondary-label font-medium uppercase tracking-tight">
                          {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Processing'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-lg tracking-tighter ${isSender ? 'text-white' : 'text-green-400'}`}>
                      {isSender ? '-' : '+'}{ (tx.amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }
                    </p>
                    <p className="text-[10px] secondary-label font-bold tracking-widest uppercase leading-none">PHP</p>
                  </div>
                </div>

                {isExpanded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-8 pt-8 border-t border-white/5 space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                      <DetailItem label="Reference Code" value={tx.id.slice(0, 10).toUpperCase()} />
                      <DetailItem label="Timestamp" value={tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'} />
                      <DetailItem label="Username" value={userName || 'Internal Operative'} />
                      {tx.metadata?.name && <DetailItem label="Account Name" value={tx.metadata.name} />}
                      {(tx.metadata?.account || tx.metadata?.phone) && <DetailItem label="Account / Number" value={tx.metadata.account || tx.metadata.phone} />}
                      {tx.metadata?.network && <DetailItem label="Network" value={tx.metadata.network} />}
                      {(tx.metadata?.bic || tx.metadata?.bank) && <DetailItem label="Bank/BIC" value={tx.metadata.bic || tx.metadata.bank} />}

                      {tx.status === 'failed' && tx.metadata?.failureMessage && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/20 p-4 rounded-xl mt-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mb-1.5">Failure Reason</p>
                          <p className="text-xs font-bold text-red-200 leading-tight">
                            {tx.metadata.failureMessage} {tx.metadata.failureCode ? `(${tx.metadata.failureCode})` : ''}
                          </p>
                        </div>
                      )}
                      
                      <DetailItem label="Base Amount" value={`₱${(tx.amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                      {tx.type === 'payout' && <DetailItem label="Network Fee" value={`₱${(tx.metadata?.networkFee || 10).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />}
                      <DetailItem label="Profit / Margin" value={tx.feeAmount ? `₱${(tx.feeAmount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00'} />
                    </div>
                    
                    {tx.totalAmount && (
                      <div className="bg-white/5 p-6 rounded-2xl flex justify-between items-center border border-white/5 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-white/30 relative z-10">Total Settle Amount</span>
                         <span className="font-black text-white text-xl relative z-10">₱{(tx.totalAmount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                       <button className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white/60 transition-all border border-white/5">
                          Download PDF
                       </button>
                       {tx.paymongoLinkId && (
                         <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                           Official Receipt
                         </button>
                       )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
          {filteredTransactions.length === 0 && (
            <div className="py-20 text-center glass rounded-3xl border border-dashed border-white/5">
              <p className="text-white/20 font-bold text-[10px] uppercase tracking-widest">No matching history for this use</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1.5">{label}</p>
      <p className="text-xs font-bold text-white leading-tight">{value}</p>
    </div>
  );
}
