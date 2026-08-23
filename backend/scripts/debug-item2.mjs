import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/除虫喷雾.html', 'utf-8');
const $ = load(html);

// 表0 或包含基本信息的表格
console.log('=== 前3个表格 ===');
$('table').slice(0, 3).each((i, tbl) => {
  const t = $(tbl).text().replace(/\s+/g, ' ').trim();
  console.log(`表${i} (${t.length}字): ${t.substring(0, 400)}`);
  console.log('---');
});

// 顶部描述文字
console.log('=== 正文段落 ===');
$('p').slice(0, 3).each((i, p) => {
  const t = $(p).text().replace(/\s+/g, ' ').trim();
  if (t.length > 10) console.log(`p[${i}]: ${t.substring(0, 200)}`);
});