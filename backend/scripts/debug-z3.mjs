import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);

const mainTable = $('table.roundy').first();
let count = 0;
mainTable.find('tr').each((i, tr) => {
  const th = $(tr).find('th').first().text().trim();
  const td = $(tr).find('td').first().text().trim();
  if (th.startsWith('Z') || th.startsWith('Ｚ')) {
    count++;
    console.log(`[${count}] th="${th}" td="${td.substring(0, 50)}"`);
  }
});
console.log(`Total Z-related rows: ${count}`);