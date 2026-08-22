import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);
let c = 0;
$('li').each((i, el) => {
  const t = $(el).text();
  if (t.includes('接触') || t.includes('守住') || t.includes('魔法') || t.includes('抢夺') || t.includes('鹦鹉') || t.includes('王者')) {
    c++;
    console.log(`li[${i}]:`, t.trim().substring(0, 60));
  }
});
console.log('total:', c);