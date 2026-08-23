import { writeFileSync } from 'fs';

// 超级球的 PokeAPI 接口
const res = await fetch('https://pokeapi.co/api/v2/item/3/', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const data = await res.json();
writeFileSync('backend/temp/pokeapi-item.json', JSON.stringify(data, null, 2), 'utf-8');

console.log('=== 名称 ===');
console.log('en:', data.name);
console.log('names:', data.names.map(n => `${n.language.name}: ${n.name}`).join(', '));

console.log('\n=== 分类 ===');
console.log('category:', data.category.name);

console.log('\n=== 效果 ===');
for (const e of data.effect_entries) {
  console.log(`${e.language.name}: ${e.short_effect}`);
}

console.log('\n=== 购买价格 ===');
console.log('cost:', data.cost);

console.log('\n=== 属性 ===');
console.log('attributes:', data.attributes.map(a => a.name).join(', '));

console.log('\n=== 口袋(bool) ===');
console.log(data.pocket ? data.pocket.name.split('-').join(' ') : '');

console.log('\n=== 抓取机器 (玩偶/机) ===');
console.log(data.machines.map(m => `${m.machine.name}`).join(', '));

console.log('\n=== 繁殖/进化内容 ===');
console.log('fling: ', data.fling_power || '无');

// 中文名 (见 names)
console.log('\n=== 中文名 ===');
const zh = data.names.find(n => n.language.name === 'zh-Hans') || data.names.find(n => n.language.name === 'zh-Hant');
if (zh) console.log(zh.name);