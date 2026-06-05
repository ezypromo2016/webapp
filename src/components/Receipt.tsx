import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';

interface ReceiptProps {
  txn: any;
  businessInfo?: any;
  onPrintDone?: () => void;
}

export default function Receipt({ txn, businessInfo, onPrintDone }: ReceiptProps) {
  const [isReady, setIsReady] = React.useState(false);
  const [printStatus, setPrintStatus] = React.useState("Preparing...");

  React.useEffect(() => {
    if (txn) {
      const timer = setTimeout(() => {
        setIsReady(true);
        setPrintStatus("Ready");
        if (window === window.parent) {
          setTimeout(() => {
            try {
              window.focus();
              window.print();
            } catch (e) {
              console.error("Print blocked", e);
            }
          }, 1000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [txn]);

  const isIframe = window !== window.parent;

  if (!txn) return null;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(n);

  const receiptDate = new Date(txn.createdAt);
  const formattedDate = receiptDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = receiptDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return createPortal(
    <div
      id="print-root-container"
      className="fixed inset-0 z-[9999] bg-slate-200 flex flex-col items-center overflow-y-auto print:bg-white print:p-0 print:static"
    >
      {/* HUD Controls */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex justify-center print:hidden w-full max-w-sm px-4">
        <button
          onClick={onPrintDone}
          className="bg-white text-slate-700 w-11 h-11 rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all border border-slate-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Iframe warning */}
      {isIframe && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 shadow text-center w-full max-w-sm mx-4 print:hidden">
          <div className="flex items-center justify-center gap-1.5 text-amber-600 mb-0.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Preview Mode</span>
          </div>
          <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
            Printing disabled in preview. Open in a new tab to print.
          </p>
        </div>
      )}

      {/* A4 Paper Container for Printing */}
      <div className="w-full max-w-[7.5in] print:w-[210mm] print:min-h-[297mm] bg-white print:bg-white flex flex-col items-center justify-start print:mx-auto transition-all duration-500">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm 10mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #print-root-container {
              background: white !important;
              padding: 0 !important;
              display: block !important;
              width: 100% !important;
              min-height: auto !important;
            }
            #print-root {
              box-shadow: none !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            /* Row break safety */
            .divide-y > div {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .summary-section {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-top: 10mm !important;
            }
            /* Ensure background colors and gradients are printed */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />
        
        {/* 7x5 Receipt Layout (Auto-growing height) */}
        <div id="print-root" 
          className={`bg-white text-slate-900 shadow-2xl relative overflow-hidden transition-all duration-500 transform ${isReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`} 
          style={{ 
            width: '7in', 
            minHeight: '5in',
            height: 'auto',
            fontFamily: "'Segoe UI', Arial, sans-serif"
          }}
        >
          {/* Background Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none z-0 text-center">
            <span className="text-[100px] font-black uppercase tracking-tighter -rotate-12">THANK YOU</span>
          </div>

          {/* Tiny top label */}
          <div className="text-center py-1 bg-slate-50 border-b border-slate-100 relative z-10">
            <span className="text-[7.5px] text-slate-400 font-bold tracking-[0.4em] uppercase">
              This is not an Official Receipt · Ref No. {txn.transactionNumber}
            </span>
          </div>

          {/* Premium Blue Header - Thinner */}
          <div className="relative bg-gradient-to-r from-[#1e293b] to-[#334155] text-white overflow-hidden z-10" style={{ height: '70px' }}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-blue-500/10 rounded-full -ml-8 -mb-8" />
            
            <div className="relative z-10 px-8 py-3 flex justify-between items-center h-full">
              <div>
                <h1 className="text-xl font-black tracking-tight uppercase leading-none text-blue-50">{txn.title || "TEMP RECEIPT"}</h1>
                <div className="flex items-center gap-2 mt-1 opacity-50">
                  <span className="text-[8px] font-bold uppercase tracking-widest leading-none">Customer's Copy</span>
                  <span className="w-1 h-1 rounded-full bg-blue-400" />
                  <span className="text-[8px] font-bold uppercase tracking-widest leading-none">POS-V16</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Timeline</div>
                <div className="text-xs font-bold text-white leading-none">{formattedTime}</div>
              </div>
            </div>
          </div>
          
          {/* Body */}
          <div className="px-8 py-4 relative z-10">
            {/* Branding Section */}
            <div className="relative flex items-center justify-center mb-5 pb-4 border-b border-slate-100">
              <div className="absolute left-0 top-0">
                {businessInfo?.logo ? (
                  <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 flex items-center justify-center">
                    <img src={businessInfo.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center ring-4 ring-blue-50">
                     <span className="text-xs font-black text-white">CBK</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
                  {businessInfo?.name || "CBK Apparel & School Supplies"}
                </h2>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-tight mb-1 opacity-80">
                  {businessInfo?.address || "Davao de Oro, Philippines"}
                </p>
                <div className="flex items-center justify-center">
                  <span className="text-[9px] text-blue-600/70 font-black tracking-widest uppercase">
                    TEL: {businessInfo?.phone || "09912091886"}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="flex justify-between items-start mb-5">
              <div className="text-left">
                <p className="text-[7.5px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Billed To</p>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5">{txn.customer?.name || "Walk-in Customer"}</span>
                  {txn.customer?.address && (
                    <span className="text-[7px] text-slate-400 font-bold uppercase tracking-tight leading-tight">{txn.customer.address}</span>
                  )}
                  {txn.customer?.contact && (
                    <span className="text-[7px] text-slate-400 font-bold uppercase tracking-tight leading-tight">{txn.customer.contact}</span>
                  )}
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-1 opacity-60">Client</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[7.5px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Print Date</p>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5">{formattedDate}</span>
                  <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest">ID: {txn.transactionNumber}</span>
                </div>
              </div>
            </div>

            {/* Premium Items Table - Refined Alignment */}
            <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[3fr_60px_90px_90px] bg-slate-50 border-b border-slate-200 px-6 py-3 text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                <span className="text-left">Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Amount</span>
              </div>
              
              <div className="divide-y divide-slate-100">
                {txn.items.map((item: any, i: number) => (
                  <div key={i} className={`grid grid-cols-[3fr_60px_90px_90px] px-6 py-3 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">{item.name}</span>
                      {item.notes && (
                        <span className="text-[8px] text-indigo-600 font-bold uppercase mt-0.5 italic leading-tight">Remarks: {item.notes}</span>
                      )}
                      <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter opacity-60">ID: {String(item.id || "").slice(-8).toUpperCase() || "ITEM-POS"}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[11px] font-black text-slate-600">{item.qty}</span>
                    </div>
                    <div className="text-right font-mono text-[11px] font-bold text-slate-500">
                      {item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-right font-mono text-[12px] font-black text-slate-900">
                      {(item.qty * item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary & Signature Section */}
            <div className="flex justify-between items-end gap-10 pt-2 summary-section">
              <div className="flex-1">
                <div className="flex items-center gapw-10 mb-6">
                  {/* Payment Details */}
                  <div className="bg-slate-50 rounded-lg px-4 py-2 border border-slate-100 inline-block">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Method</p>
                        <p className="text-[9px] font-black text-slate-700 uppercase leading-none">{txn.paymentMethod || "CASH"}</p>
                      </div>
                      <div className="w-[1px] h-5 bg-slate-200" />
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Status</p>
                        <p className="text-[9px] font-black text-emerald-600 uppercase leading-none">Completed</p>
                      </div>
                    </div>
                  </div>

                  {/* Signature Line */}
                  <div className="flex-1 max-w-[140px]">
                    <div className="h-8 border-b border-slate-300 w-full" />
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center">Authorized Signature</p>
                  </div>
                </div>

                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                  * All items sold are subject to quality audit. <br/>
                  * Thank you for choosing CBK Apparel.
                </div>
              </div>

              <div className="text-right space-y-4">
                {txn.total_loaned !== undefined && (
                  <div className="flex flex-col items-end pr-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Total Loaned</span>
                    <span className="text-xs font-black text-slate-700">{formatCurrency(txn.total_loaned)}</span>
                  </div>
                )}
                {txn.total_paid !== undefined && (
                  <div className="flex flex-col items-end pr-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Total Paid</span>
                    <div className="flex items-center gap-2">
                      {txn.paymentRemarks && (
                        <span className="text-[7px] text-slate-400 font-bold uppercase italic max-w-[150px] truncate">({txn.paymentRemarks})</span>
                      )}
                      <span className="text-xs font-black text-emerald-600">-{formatCurrency(txn.total_paid)}</span>
                    </div>
                  </div>
                )}
                <div className="inline-block bg-slate-900 text-white rounded-xl px-5 py-3 shadow-lg shadow-slate-200">
                  <p className="text-[8px] font-black text-blue-300 uppercase tracking-[0.3em] mb-1.5 leading-none text-center">Total Amount Due</p>
                  <div className="flex items-baseline justify-end gap-1">
                     <span className="text-[9px] font-black text-blue-400">PHP</span>
                     <span className="text-3xl font-black text-white tracking-tighter leading-none">
                       {formatCurrency(txn.total).replace('PHP', '').trim()}
                     </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Footer - Thinner */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 opacity-80" />
        </div>
      </div>
    </div>,
    document.body
  );
}