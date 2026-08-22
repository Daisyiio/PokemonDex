import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);

// Find the Z-crystal td
const td = $('a[title*="Z（道具）"], a[title*="Ｚ（道具）"]').first().parent();
const text = td.text().trim();
console.log('td text:', JSON.stringify(text));
console.log('char codes:', [...text].map(c => c.charCodeAt(0)));
console.log('trimmed:', JSON.stringify(text.trim()));
console.log('trimmed length:', text.trim().length);
console.log('equals 一般Ｚ:', text.trim() === '一般Ｚ');