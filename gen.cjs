const fs = require("fs");

const text = fs.readFileSync('promos.txt', 'utf8');

const lines = text.split('\n');
let currentCategory = '';
let promos = [];

for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'Keyword,Description') continue;

    if (!trimmed.startsWith('"')) {
        currentCategory = trimmed;
    } else {
        const parts = trimmed.split('","');
        let keyword = parts[0].replace(/^"|"$/g, '');
        let desc = parts.length > 1 ? parts[1].replace(/^"|"$/g, '') : '';
        
        // Fix for multiple numbers in a line
        if (keyword.includes('-') || keyword.includes(',')) {
            // we will just assign a base price of 0 (open amount)
        }

        const priceMatch = keyword.match(/\d+$/);
        const price = priceMatch ? parseInt(priceMatch[0], 10) : 0;

        promos.push({
            id: currentCategory + '_' + keyword,
            name: keyword,
            keyword: keyword,
            network: currentCategory,
            price: price,
            desc: desc
        });
    }
}

const fileContent = "export interface PromoPackage {\n  id: string;\n  name: string;\n  keyword: string;\n  network?: string;\n  price: number;\n  desc?: string;\n}\n\nexport const DAFOX_PROMOS: PromoPackage[] = " + JSON.stringify(promos, null, 2) + ";\n";

fs.writeFileSync('src/lib/dafoxPromos.ts', fileContent);
console.log('done');
