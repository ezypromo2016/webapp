const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace allowed: true for dashboard
  content = content.replace(/\{ icon: LayoutDashboard, label: "Dashboard", id: "dashboard", allowed: true \}/g, '{ icon: LayoutDashboard, label: "Dashboard", id: "dashboard", allowed: !isPadalaOnlyUser }');

  fs.writeFileSync(filePath, content);
}
console.log('Done replacing dashboard allowed property');
