const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'pages');

for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.tsx')) {
    const fullPath = path.join(srcDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Fix sidebar visibility
    if (content.includes('md:translate-x-0 md:static')) {
      content = content.replace(/md:translate-x-0 md:static/g, 'lg:translate-x-0 lg:static');
      modified = true;
    }
    
    // Fix hamburger visibility
    // The hamburger is usually `md:hidden p-2 hover:bg-slate-100` replacing with `lg:hidden` but need to be precise 
    // it can be `className="md:hidden ... "`
    // Replace `md:hidden` when it's on a button toggling `setSidebarOpen(true)`
    if (/onClick=\{\s*\(\)\s*=>\s*setSidebarOpen\(true\)\s*\}/.test(content)) {
      content = content.replace(/(onClick=\{\s*\(\)\s*=>\s*setSidebarOpen\(true\)\s*\}[\s\S]*?)className="md:hidden/g, '$1className="lg:hidden');
      // also reverse order where className comes first:
      content = content.replace(/className="md:hidden([^"]*)"\s*onClick=\{\s*\(\)\s*=>\s*setSidebarOpen\(true\)\s*\}/g, 'className="lg:hidden$1" onClick={() => setSidebarOpen(true)}');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`Updated ${file}`);
    }
  }
}
