const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/api.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/!d\.created_at/g, "(!d.created_at && !d.createdAt)");
content = content.replace(/d\.created_at/g, "(d.created_at || d.createdAt)");

fs.writeFileSync(file, content);
console.log('Fixed api.ts');
