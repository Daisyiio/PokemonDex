import { readFileSync } from 'fs';

// 我们数据库的道具
const ourNames = ['除虫喷雾', '白银喷雾', '黄金喷雾', '木箱', '高级球', '超级球', '精灵球', '大师球', '伤药', '好伤药', '万灵药'];

const res = await fetch('https://pokeapi.co/api/v2/item?limit=100&offset=0');
const data = await res.json();
console.log('PokeAPI 道具总数:', data.count);

let matched = 0;
for (const s of data.results) {
  const r = await fetch(s.url);
  const item = await r.json();
  const zh = item.names.find(n => n.language.name === 'zh-hans')?.name || '';
  if (ourNames.includes(zh)) {
    console.log(`✓ ${item.id} ${zh} <-> 匹配(我们的数据库也有)`);
    matched++;
  }
}
console.log('在前100个中匹配到我们的:', matched);