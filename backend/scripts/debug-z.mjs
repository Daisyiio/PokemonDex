import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);

const mainTable = $('table.roundy').first();
mainTable.find('tr').each((i, tr) => {
  const th = $(tr).find('th').first().text().trim();
  const td = $(tr).find('td').first().text().trim();
  if (th.includes('纯晶') || th.includes('招式') || th.includes('威力')) {
    console.log(JSON.stringify(th), '→', JSON.stringify(td));
  }
});