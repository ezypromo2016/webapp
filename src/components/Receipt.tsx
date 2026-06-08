import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Printer, Usb } from 'lucide-react';
import { ThermalPrinter } from '../lib/thermalPrinter';

interface ReceiptProps {
  txn: any;
  businessInfo?: any;
  onPrintDone?: () => void;
}

export default function Receipt({ txn, businessInfo, onPrintDone }: ReceiptProps) {
  const [isReady, setIsReady] = React.useState(false);
  const [printStatus, setPrintStatus] = React.useState("Preparing...");
  const [printerType, setPrinterType] = React.useState<"A4" | "THERMAL">("THERMAL"); // default to thermal for 58mm
  const [isAutoPrinting, setIsAutoPrinting] = React.useState(true);

  React.useEffect(() => {
    if (txn) {
      setIsReady(true);
      setPrintStatus("Ready");
      
      // Auto-print attempt for browser
      if (window === window.parent && printerType === "A4") {
        setIsAutoPrinting(false);
        setTimeout(() => {
          try {
            window.focus();
            window.print();
          } catch (e) {
            console.error("Print blocked", e);
          }
        }, 1000);
      }

      // Auto print to authorized USB thermal printer
      if (printerType === "THERMAL" && 'usb' in navigator) {
        setTimeout(async () => {
          try {
            const devs = await (navigator as any).usb.getDevices();
            if (devs && devs.length > 0) {
              const res = await ThermalPrinter.printReceipt(txn, businessInfo, "usb", devs[0]);
              if (res.success && onPrintDone) {
                onPrintDone();
                return;
              }
            }
          } catch (err) {
            console.error("Auto USB print failed", err);
          }
          setIsAutoPrinting(false);
        }, 50);
      } else {
        setIsAutoPrinting(false);
      }
    }
  }, [txn, printerType, onPrintDone]);

  const handleDirectUSBPrint = async () => {
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      const res = await ThermalPrinter.printReceipt(txn, businessInfo, "usb", device);
      if (!res.success) {
        if (res.error?.includes("No device selected") || res.error?.includes("user")) return;
        alert(res.error || "Could not connect.");
      }
    } catch (e: any) {
      if (e.name === 'NotFoundError' || e.message?.includes("No device selected")) return;
      alert("USB Print Failed:\n" + e.message);
    }
  };

  const handleDirectSerialPrint = async () => {
    try {
      const res = await ThermalPrinter.printReceipt(txn, businessInfo, "serial");
      if (!res.success) {
        if (res.error?.includes("No port selected") || res.error?.includes("user")) return;
        alert(res.error || "Could not connect to Serial printer.");
      }
    } catch (e: any) {
      if (e.name === 'NotFoundError' || e.message?.includes("No port selected")) return;
      alert("Print failed: " + e.message);
    }
  };

  const isIframe = window !== window.parent;

  const handleWebPrint = () => {
    if (isIframe) {
      alert("Browser printing is blocked inside this preview window. \n\nPlease click the '↗' icon at the very top right of this panel (or use the link from the assistant) to open the app in a new tab. Then click 'WEB' here again.");
    } else {
      alert("To print via Web:\n1. In the Print Dialog, make sure the destination is set to your 'OJ-58K' printer.\n2. Set Paper Size to 58mm (or Roll Paper 58x297mm).\n3. Set Margins to 'None' or 'Minimum'.\n\nClick OK to open the print dialog.");
      window.print();
    }
  };

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
      className={`fixed inset-0 z-[9999] bg-slate-200 flex flex-col items-center overflow-y-auto print:bg-white print:p-0 print:static ${isAutoPrinting ? 'opacity-0 pointer-events-none' : ''}`}
    >
      {/* HUD Controls */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 justify-center print:hidden w-full max-w-sm px-4">
        <div className="flex gap-2 w-full">
          <button
            onClick={() => setPrinterType("A4")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-lg border transition-all ${
              printerType === "A4" 
                ? "bg-indigo-600 text-white border-indigo-500" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            A4 Print
          </button>
          <button
            onClick={() => setPrinterType("THERMAL")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-lg border transition-all ${
              printerType === "THERMAL" 
                ? "bg-indigo-600 text-white border-indigo-500" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            OJ-58K (Web)
          </button>
          <button
            onClick={onPrintDone}
            className="bg-white text-slate-700 w-10 h-10 rounded-xl flex-shrink-0 shadow-lg flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all border border-slate-200 leading-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 w-full">
          {printerType === "THERMAL" ? (
            <>
              <button
                onClick={handleDirectUSBPrint}
                className="flex-1 bg-blue-600 text-white h-10 rounded-xl shadow-lg flex items-center justify-center gap-1.5 hover:bg-blue-500 active:scale-95 transition-all border border-blue-500 font-bold text-[9px] uppercase tracking-widest px-2"
                title="Direct USB Print (ESC/POS)"
              >
                <Usb className="w-3.5 h-3.5" /> USB
              </button>
              <button
                onClick={async () => {
                   try {
                     const res = await ThermalPrinter.printReceipt(txn, businessInfo, "bluetooth");
                     if (!res.success) {
                        if (res.error?.includes("user")) return;
                        alert(res.error || "Could not connect to Bluetooth printer.");
                     }
                   } catch(e:any) {
                     alert("Bluetooth Error: " + e.message);
                   }
                }}
                className="flex-1 bg-sky-500 text-white h-10 rounded-xl shadow-lg flex items-center justify-center gap-1.5 hover:bg-sky-400 active:scale-95 transition-all border border-sky-400 font-bold text-[9px] uppercase tracking-widest px-2"
                title="Bluetooth Print (ESC/POS)"
              >
                 Bluetooth
              </button>
              <button
                onClick={handleDirectSerialPrint}
                className="flex-1 bg-indigo-600 text-white h-10 rounded-xl shadow-lg flex items-center justify-center gap-1.5 hover:bg-indigo-500 active:scale-95 transition-all border border-indigo-500 font-bold text-[9px] uppercase tracking-widest px-2 hidden"
                title="Serial Print (ESC/POS)"
              >
                 Serial
              </button>
              <button
                onClick={handleWebPrint}
                className="flex-1 bg-emerald-600 text-white h-10 rounded-xl shadow-lg flex items-center justify-center gap-1.5 hover:bg-emerald-500 active:scale-95 transition-all border border-emerald-500 text-[9px] uppercase font-bold tracking-widest px-2"
                title="Browser Dialog Print"
              >
                <Printer className="w-3.5 h-3.5" /> Web
              </button>
            </>
          ) : (
            <button
              onClick={handleWebPrint}
              className="w-full bg-emerald-600 text-white h-10 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-500 active:scale-95 transition-all border border-emerald-500 font-bold text-[10px] uppercase tracking-widest"
              title="Print Now"
            >
              <Printer className="w-4 h-4" /> Print Now
            </button>
          )}
        </div>
      </div>



      {printerType === 'A4' ? (
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
                      {((txn.paymentMethod || "cash").toLowerCase() === "cash" && txn.cashTendered !== undefined) && (
                        <>
                          <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Tendered</p>
                            <p className="text-[9px] font-black text-slate-700 uppercase leading-none">{formatCurrency(txn.cashTendered)}</p>
                          </div>
                          <div className="w-[1px] h-5 bg-slate-200" />
                          <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Change</p>
                            <p className="text-[9px] font-black text-slate-700 uppercase leading-none">{formatCurrency(txn.change || 0)}</p>
                          </div>
                          <div className="w-[1px] h-5 bg-slate-200" />
                        </>
                      )}
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
      ) : (
      <div className="w-full max-w-[58mm] bg-white print:bg-white flex flex-col items-center justify-start print:mx-auto transition-all duration-500 font-mono text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: white !important;
              color: black !important;
              font-family: monospace !important;
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
          }
        `}} />
        <div id="print-root" 
          className={`w-full max-w-[300px] print:max-w-none print:w-[58mm] bg-white text-black p-4 py-8 shadow-2xl print:shadow-none print:p-2 min-h-[500px] border border-slate-200 print:border-none relative overflow-hidden transition-all duration-500 transform ${isReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`} 
          style={{ 
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.2"
          }}
        >
          <div className="text-center mb-4">
            <h2 className="text-base font-bold uppercase mb-1">
              {businessInfo?.name || "CBK Apparel & School Supplies"}
            </h2>
            <div className="text-[10px] break-words px-4">
              {businessInfo?.address || "Davao de Oro, Philippines"}
            </div>
            <div className="text-[10px] mt-1">
              TEL: {businessInfo?.phone || "09912091886"}
            </div>
          </div>

          <div className="text-[10px] text-center mb-3 pb-2 border-b border-black border-dashed">
            <div className="font-bold text-xs uppercase mb-1">{txn.title || "POS RECEIPT"}</div>
            <div>REF: {txn.transactionNumber}</div>
            <div>DATE: {formattedDate} {formattedTime}</div>
            <div>CUSTOMER: {txn.customer?.name || "WALK-IN"}</div>
          </div>

          <table className="w-full text-[10px] mb-3">
            <thead>
              <tr className="border-b border-black border-dashed">
                <th className="text-left font-normal py-1">QTY</th>
                <th className="text-left font-normal py-1">DESC</th>
                <th className="text-right font-normal py-1">AMT</th>
              </tr>
            </thead>
            <tbody>
              {txn.items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-1 align-top">{item.qty}</td>
                  <td className="py-1 align-top pr-1">{item.name}</td>
                  <td className="py-1 align-top text-right truncate">{(item.qty * item.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-black border-dashed pt-2 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] uppercase">TOTAL</span>
              <span className="text-sm font-bold">{formatCurrency(txn.total)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span>METHOD</span>
              <span className="uppercase">{txn.paymentMethod || "CASH"}</span>
            </div>
            {((txn.paymentMethod || "cash").toLowerCase() === "cash" && txn.cashTendered !== undefined) && (
              <>
                <div className="flex justify-between items-center text-[10px]">
                  <span>TENDERED</span>
                  <span>{formatCurrency(txn.cashTendered)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span>CHANGE</span>
                  <span>{formatCurrency(txn.change || 0)}</span>
                </div>
              </>
            )}
            {(txn.total_paid !== undefined || txn.total_loaned !== undefined) && (
               <div className="mt-2 space-y-1">
                 {txn.total_loaned !== undefined && (
                   <div className="flex justify-between text-[10px]">
                     <span>LOANED:</span>
                     <span>{formatCurrency(txn.total_loaned)}</span>
                   </div>
                 )}
                 {txn.total_paid !== undefined && (
                   <div className="flex justify-between text-[10px]">
                     <span>PAID:</span>
                     <span>{formatCurrency(txn.total_paid)}</span>
                   </div>
                 )}
               </div>
            )}
          </div>

          <div className="text-center text-[9px] mt-4 pt-2 border-t border-black border-dotted">
            <div>THANK YOU FOR CHOOSING US</div>
            <div>PLEASE COME AGAIN</div>
            <div className="mt-2 text-[8px]">
              THIS IS NOT AN OFFICIAL RECEIPT
            </div>
            <div className="mt-4 mb-4 font-bold text-[8px]">OJ-58K</div>
          </div>
        </div>
      </div>
      )}
    </div>,
    document.body
  );
}