import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);

const mainTable = $('table.roundy').first();
let found = 0;
mainTable.find('tr').each((i, tr) => {
  const th = $(tr).find('th').first().text().trim();
  const td = $(tr).find('td').first().text().trim();
  if (th === 'Ｚ纯晶') found++;
  if (th === 'Ｚ招式') found++;
  if (th === '威力' && found > 0) found++;
});
console.log('found:', found);