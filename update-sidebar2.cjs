const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'pages');

for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.tsx')) {
    const fullPath = path.join(srcDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Make sure we inject the definitions of isPadalaUser right before sidebarItems
    const sidebarRegex = /const sidebarItems \= \[\s+([\s\S]+?)\];/;
    
    if (sidebarRegex.test(content)) {
      const match = content.match(sidebarRegex);
      
      const isSettingsIcon = content.includes('SettingsIcon');
      const settingsVar = isSettingsIcon ? 'SettingsIcon' : 'Settings';
      
      const newSidebar = `
  const isGCashRestricted = user?.email === 'user@mariz.com';
  const isPadalaOnlyUser = Boolean(user?.email?.startsWith('user@') && !isAdmin && !isGCashRestricted);

  const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", allowed: true },
    { icon: Clock, label: "Attendance", id: "attendance", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: ShoppingCart, label: "Cashier", id: "pos", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: ClipboardList, label: "Orders", id: "orders", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: SmartphoneNfc, label: "GCash Tracker", id: "gcash", allowed: !isPadalaOnlyUser },
    { icon: Package, label: "Inventory", id: "inventory", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: History, label: "Transactions", id: "transactions", allowed: !isPadalaOnlyUser && !isGCashRestricted },
    { icon: Users, label: "SUKICARD MEMBERS", id: "customers", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: IdCard, label: "SUKICARD Generator", id: "generator", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: Printer, label: "Printing Sales", id: "printing", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: CreditCard, label: "Credit Tracker", id: "credit-tracker", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: Briefcase, label: "SOS CREDIT", id: "sos-credit", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser },
    { icon: SmartphoneNfc, label: "Pera Padala", id: "send-money", allowed: !isGCashRestricted },
    { icon: ${settingsVar}, label: "Settings", id: "settings", allowed: isAdmin && !isGCashRestricted && !isPadalaOnlyUser }
  ];`;
      const modifiedContent = content.replace(sidebarRegex, newSidebar.trim());
      fs.writeFileSync(fullPath, modifiedContent);
      console.log(`Updated ${file}`);
    }
  }
}
