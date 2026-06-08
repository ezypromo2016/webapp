const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'pages');

for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.tsx')) {
    const fullPath = path.join(srcDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Fix backdrop visibility
    if (content.includes('z-40 md:hidden')) {
      content = content.replace(/z-40 md:hidden/g, 'z-40 lg:hidden');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`Updated backdrop in ${file}`);
    }
  }
}
