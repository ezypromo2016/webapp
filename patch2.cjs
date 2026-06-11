const fs = require('fs');
let code = fs.readFileSync('src/pages/SendMoney.tsx', 'utf8');

code = code.replace(
  '<div className="flex justify-between items-start mb-4 bg-transparent">',
  '<div className="flex justify-between items-start mb-4 bg-transparent gap-2">'
);

code = code.replace(
  '<div className="relative">\\n                            <select ',
  '<div className="relative shrink-0">\\n                            <select '
);

fs.writeFileSync('src/pages/SendMoney.tsx', code);
