import { writeFileSync } from 'fs';

const res = await fetch('https://wiki.52poke.com/wiki/超级球（道具）?action=raw', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const text = await res.text();
writeFileSync('backend/temp/superball.wikitext', text, 'utf-8');
console.log('length:', text.length);
// 显示前 3000 字符看结构
console.log('---前3000字符---');
console.log(text.substring(0, 3000));