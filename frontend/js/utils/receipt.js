/**
 * Receipt Utility
 * Generates printable HTML receipts and PDF exports
 */

const Receipt = (() => {
  const formatCurrency = (amount) =>
    '₱' + parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  };

  /**
   * Build receipt HTML string
   */
  const buildHTML = (transaction, businessInfo = {}) => {
    const biz = {
      name: businessInfo.name || 'SwiftPOS Store',
      address: businessInfo.address || '',
      phone: businessInfo.phone || '',
      tin: businessInfo.tin || '',
      ...businessInfo,
    };

    const itemRows = transaction.items.map(item => `
      <tr>
        <td style="padding:2px 0;">${item.productName}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${formatCurrency(item.unitPrice)}</td>
        <td style="text-align:right;">${formatCurrency(item.total)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${transaction.transactionNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; background: white; }
    .receipt { width: 300px; margin: 0 auto; padding: 20px 16px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    .solid { border-top: 1px solid #333; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { padding: 4px 0; text-align: left; font-weight: bold; font-size: 10px; border-bottom: 1px dashed #999; }
    th:not(:first-child) { text-align: center; }
    th:last-child { text-align: right; }
    .totals { margin-top: 4px; }
    .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    .total-row.grand { font-weight: bold; font-size: 13px; padding-top: 4px; margin-top: 2px; }
    .total-row.grand { border-top: 1px solid #333; }
    .change-row { background: #f0f0f0; padding: 4px; margin-top: 4px; border-radius: 2px; }
    .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #666; }
    .barcode { font-family: monospace; font-size: 9px; letter-spacing: 0.1em; color: #999; }
    @media print {
      body { background: white; }
      .receipt { width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
<div class="receipt">
  <div class="center">
    <div class="bold" style="font-size:14px;">${biz.name}</div>
    ${biz.address ? `<div>${biz.address}</div>` : ''}
    ${biz.phone ? `<div>Tel: ${biz.phone}</div>` : ''}
    ${biz.tin ? `<div>TIN: ${biz.tin}</div>` : ''}
  </div>
  
  <hr class="divider">
  
  <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;">
    <span>${formatDate(transaction.createdAt)}</span>
    <span>${transaction.transactionNumber}</span>
  </div>
  <div style="font-size:10px;margin-bottom:4px;">Cashier: ${transaction.cashierName || transaction.cashier?.name || '-'}</div>
  ${transaction.customerName ? `<div style="font-size:10px;">Customer: ${transaction.customerName}</div>` : ''}
  
  <hr class="divider">
  
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>
  
  <hr class="divider">
  
  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${formatCurrency(transaction.subtotal)}</span>
    </div>
    ${transaction.discountAmount > 0 ? `
    <div class="total-row" style="color:#16a34a;">
      <span>Discount</span>
      <span>-${formatCurrency(transaction.discountAmount)}</span>
    </div>` : ''}
    ${transaction.taxAmount > 0 ? `
    <div class="total-row">
      <span>VAT (${(transaction.taxRate * 100).toFixed(0)}%)</span>
      <span>${formatCurrency(transaction.taxAmount)}</span>
    </div>` : ''}
    <div class="total-row grand">
      <span>TOTAL</span>
      <span>${formatCurrency(transaction.total)}</span>
    </div>
    ${transaction.paymentMethod === 'cash' ? `
    <div class="total-row" style="margin-top:4px;">
      <span>Cash</span>
      <span>${formatCurrency(transaction.amountTendered)}</span>
    </div>
    <div class="total-row change-row bold">
      <span>CHANGE</span>
      <span>${formatCurrency(transaction.change)}</span>
    </div>` : `
    <div class="total-row" style="margin-top:4px;">
      <span>Payment</span>
      <span>${transaction.paymentMethod?.toUpperCase()}</span>
    </div>
    ${transaction.paymentReference ? `<div class="total-row"><span>Ref#</span><span>${transaction.paymentReference}</span></div>` : ''}`}
  </div>
  
  <hr class="divider">
  
  <div class="footer">
    <div>*** Thank You! ***</div>
    <div>Please come again</div>
    <div style="margin-top:8px;" class="barcode">${transaction.transactionNumber}</div>
  </div>
</div>
</body>
</html>`;
  };

  /**
   * Print receipt in new window
   */
  const print = (transaction, businessInfo) => {
    const html = buildHTML(transaction, businessInfo);
    const win = window.open('', '_blank', 'width=350,height=600');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  /**
   * Export receipt as PDF using jsPDF
   */
  const exportPDF = (transaction, businessInfo = {}) => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: [80, 220], orientation: 'portrait' });
      const biz = { name: 'SwiftPOS Store', ...businessInfo };

      let y = 8;
      const lineH = 4.5;
      const center = 40;
      const left = 5;
      const right = 75;

      const text = (str, x, yPos, opts = {}) => {
        doc.setFontSize(opts.size || 8);
        doc.setFont('courier', opts.bold ? 'bold' : 'normal');
        doc.text(str, x, yPos, opts);
      };

      const dashed = (yPos) => {
        doc.setLineDashPattern([1, 1], 0);
        doc.setDrawColor(150);
        doc.line(left, yPos, right, yPos);
        y += 2;
      };

      // Header
      text(biz.name, center, y, { align: 'center', bold: true, size: 10 }); y += lineH;
      if (biz.address) { text(biz.address, center, y, { align: 'center', size: 7 }); y += lineH; }
      if (biz.phone) { text(`Tel: ${biz.phone}`, center, y, { align: 'center', size: 7 }); y += lineH; }

      dashed(y); y += 2;

      text(formatDate(transaction.createdAt), left, y, { size: 7 }); y += lineH;
      text(`TXN#: ${transaction.transactionNumber}`, left, y, { size: 7 }); y += lineH;
      text(`Cashier: ${transaction.cashierName || '-'}`, left, y, { size: 7 }); y += lineH;

      dashed(y); y += 2;

      // Items header
      text('Item', left, y, { bold: true, size: 7 });
      text('Qty', 48, y, { bold: true, size: 7 });
      text('Price', 58, y, { bold: true, size: 7 });
      text('Total', right, y, { align: 'right', bold: true, size: 7 });
      y += lineH;
      dashed(y); y += 2;

      // Items
      transaction.items.forEach(item => {
        const name = item.productName.length > 18 ? item.productName.substring(0, 18) + '..' : item.productName;
        text(name, left, y, { size: 7 });
        text(String(item.quantity), 50, y, { align: 'center', size: 7 });
        text(formatCurrency(item.unitPrice), 60, y, { size: 7 });
        text(formatCurrency(item.total), right, y, { align: 'right', size: 7 });
        y += lineH;
      });

      dashed(y); y += 2;

      // Totals
      const totalRow = (label, value, bold = false) => {
        text(label, left, y, { bold, size: bold ? 9 : 7 });
        text(value, right, y, { align: 'right', bold, size: bold ? 9 : 7 });
        y += lineH;
      };

      totalRow('Subtotal', formatCurrency(transaction.subtotal));
      if (transaction.discountAmount > 0) totalRow('Discount', '-' + formatCurrency(transaction.discountAmount));
      if (transaction.taxAmount > 0) totalRow(`VAT (${(transaction.taxRate * 100).toFixed(0)}%)`, formatCurrency(transaction.taxAmount));
      totalRow('TOTAL', formatCurrency(transaction.total), true);

      if (transaction.paymentMethod === 'cash') {
        totalRow('Cash', formatCurrency(transaction.amountTendered));
        totalRow('Change', formatCurrency(transaction.change), true);
      } else {
        totalRow('Payment', transaction.paymentMethod?.toUpperCase());
      }

      dashed(y); y += 2;

      // Footer
      text('*** Thank You! ***', center, y, { align: 'center', bold: true, size: 8 }); y += lineH;
      text('Please come again', center, y, { align: 'center', size: 7 });

      doc.save(`receipt-${transaction.transactionNumber}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      Toast.show('PDF export failed. Printing instead...', 'error');
      Receipt.print(transaction, businessInfo);
    }
  };

  const openCashDrawer = () => {
    if (window.AndroidBridge && typeof window.AndroidBridge.openCashDrawer === 'function') {
      window.AndroidBridge.openCashDrawer();
      Toast.show('Opening cash drawer...', 'success');
      return true;
    }

    if (window.AndroidBridge && window.AndroidBridge.openCashDrawer) {
      // Some WebView JavaScript bridges expose methods differently.
      window.AndroidBridge.openCashDrawer();
      Toast.show('Opening cash drawer...', 'success');
      return true;
    }

    Toast.show('Cash drawer not available in this browser. Use Android native mode or add hardware bridge.', 'warning');
    return false;
  };

  return { print, exportPDF, buildHTML, openCashDrawer };
})();
