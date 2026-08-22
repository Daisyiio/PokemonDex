import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);
const mainTable = $('table.roundy').first();

// Count all tr elements
const allTrs = mainTable.find('tr');
console.log('Total tr elements:', allTrs.length);

// Check if the 3rd tr has a nested table
allTrs.each((i, tr) => {
  const nestedTables = $(tr).find('table');
  if (nestedTables.length > 0) {
    console.log(`tr[${i}] has ${nestedTables.length} nested tables`);
    const nestedTrs = nestedTables.first().find('tr');
    console.log(`  nested trs: ${nestedTrs.length}`);
    nestedTrs.each((j, ntr) => {
      const th = $(ntr).find('th').first().text().trim();
      const td = $(ntr).find('td').first().text().trim().substring(0, 30);
      console.log(`  nested tr[${j}]: th="${th}" td="${td}"`);
    });
  }
});