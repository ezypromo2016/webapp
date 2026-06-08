const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/api.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/if \(\(!\(\(d\.created_at \|\| d\.createdAt\)\) && !d\.createdAt\)\) return false;/g, "if (!d.created_at && !d.createdAt) return false;");
content = content.replace(/if \(\(!\(d\.created_at \|\| d\.createdAt\) && !d\.createdAt\)\) return false;/g, "if (!d.created_at && !d.createdAt) return false;");

fs.writeFileSync(file, content);
console.log('Fixed syntax in api.ts');
