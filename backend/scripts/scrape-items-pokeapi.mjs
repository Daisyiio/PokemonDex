import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'data', 'items_pokeapi.json');
const DELAY = 120;

// 从我们数据库加载道具中文名
async function getOurItems() {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`http://localhost:3000/api/items?page=${page}&pageSize=200`);
    const data = await res.json();
    all.push(...data.items.map(m => ({ id: String(m.id), nameZh: m.nameZh })));
    if (data.items.length < 200) break;
    page++;
  }
  return all;
}

// 抓取 PokeAPI 道具
async function fetchPokeItem(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/item/${id}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

function pickZh(namedList) {
  const n = namedList.find(x => x.language.name === 'zh-hans') || namedList.find(x => x.language.name === 'zh-Hant') || namedList.find(x => x.language.name === 'zh-hant');
  return n ? n.name : null;
}

async function main() {
  console.log('获取我们道具列表...');
  const ourItems = await getOurItems();
  const zhToId = new Map(ourItems.map(it => [it.nameZh, it.id]));
  console.log(`我们的道具: ${ourItems.length}`);

  // 获取 PokeAPI 所有道具 id
  const listRes = await fetch('https://pokeapi.co/api/v2/item?limit=2223');
  const listData = await listRes.json();
  console.log(`PokeAPI 道具: ${listData.count}`);

  let results = {};
  if (existsSync(OUTPUT)) {
    try { results = JSON.parse(readFileSync(OUTPUT, 'utf-8')); } catch {}
  }

  // 先建立 PokeAPI id -> 中文名 -> 我们 id 的匹配
  let matchedCount = 0;
  for (let i = 0; i < listData.results.length; i++) {
    const listItem = listData.results[i];
    const pokeId = i + 1;

    // 已有结果跳过
    if (results[pokeId]) continue;

    const item = await fetchPokeItem(pokeId);
    if (!item) continue;

    const zh = pickZh(item.names || []);
    const ourId = zh ? zhToId.get(zh) : null;

    // 只保存能匹配到我们数据库的道具
    if (ourId) {
      results[pokeId] = {
        ourId,
        nameZh: zh,
        nameEn: item.name,
        category: item.category?.name || null,
        effect: (item.effect_entries?.find(e => e.language.name === 'en')?.effect || '').split('\n')[0],
        attributes: (item.attributes || []).map(a => a.name),
        cost: item.cost || null,
        prices: (item.prices || []).slice(0, 20).map(p => ({
          game: p.version_group?.name || '',
          buy: p.purchase_price,
          sell: p.sell_price,
        })),
      };
      matchedCount++;
      if (matchedCount % 20 === 0) console.log(`已匹配 ${matchedCount} 个...`);
    }

    if ((i + 1) % 50 === 0) {
      writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
    }
    await new Promise(r => setTimeout(r, DELAY));
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`完成！共匹配 ${matchedCount} 个道具`);
}

main().catch(console.error);