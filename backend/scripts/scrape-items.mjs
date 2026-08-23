import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'temp', 'pages');
const OUTPUT = join(__dirname, '..', 'data', 'items_extra.json');
const DELAY_MS = 400;

async function getItemList() {
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

async function fetchItemPage(nameZh) {
  const cacheFile = join(CACHE_DIR, `${nameZh}.html`);
  if (existsSync(cacheFile)) return readFileSync(cacheFile, 'utf-8');
  const url = `https://wiki.52poke.com/api.php?action=parse&page=${encodeURIComponent(nameZh + '（道具）')}&prop=text&format=json&redirects=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PokemonDex/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.error) return null;
    const html = data.parse.text['*'];
    writeFileSync(cacheFile, html, 'utf-8');
    return html;
  } catch { return null; }
}

function parseItemData(html, nameZh) {
  const $ = load(html);
  const result = {};

  // 1. 效果：优先取 h3 "效果"，否则取描述段落
  let effect = null;
  $('h3').each((_, h) => {
    if (effect) return;
    const text = $(h).text().replace(/\[编辑[^\]]*\]/g, '').trim();
    if (text === '效果') {
      let el = $(h).next();
      while (el.length && !el.is('h3') && !el.is('h2')) {
        const tag = el.prop('tagName');
        if (tag === 'UL' || tag === 'P' || tag === 'DL') {
          const t = el.text().replace(/\s+/g, ' ').trim();
          if (t.length > 3 && t.length < 300) { effect = t; break; }
        }
        el = el.next();
      }
    }
  });
  // 如果没有效果章节，用描述 p
  if (!effect) {
    $('p').each((_, p) => {
      if (effect) return;
      const t = $(p).text().replace(/\s+/g, ' ').trim();
      if (t && !t.startsWith(nameZh + '（日文') && t.length > 8 && t.length < 300) {
        effect = t;
      }
    });
  }
  if (effect) result.effect = effect;

  // 2. 使用信息 (infobox 表)
  const usage = {};
  $('table').each((_, tbl) => {
    const h = $(tbl).html() || '';
    if (h.includes('使用场合') || h.includes('使用方式')) {
      $(tbl).find('tr').each((_, tr) => {
        const th = $(tr).find('th');
        const td = $(tr).find('td').first();
        if (th.length && td.length) {
          const key = th.first().text().replace(/\s+/g, '').trim();
          if (['使用场合', '口袋', '使用方式', '使用次数', '投掷'].includes(key)) {
            usage[key] = td.text().replace(/\s+/g, ' ').trim().split(' ').join(' ');
          }
        }
      });
    }
  });
  if (Object.keys(usage).length) result.usage = usage;

  // 3. 获取地点 (一次性获得 / 重复获得)
  const locations = [];
  $('h4, h3').each((_, h) => {
    const text = $(h).text().replace(/\[编辑[^\]]*\]/g, '').trim();
    if (text === '一次性获得' || text === '重复获得' || text === '获得方式') {
      const label = text;
      let el = $(h).next();
      while (el.length) {
        const tag = el.prop('tagName');
        const elText = el.text().replace(/\s+/g, ' ').trim();
        if (['H4', 'H3', 'H2'].includes(tag)) break;
        if (tag === 'TABLE') {
          el.find('tr').each((_, tr) => {
            const cells = $(tr).find('td, th').map((_, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
            if (cells.length >= 2 && cells[0].length > 1 && cells[0].length < 15 && cells[1]) {
              locations.push({ type: label, version: cells[0], location: cells.slice(1).join('，') });
            }
          });
        }
        el = el.next();
      }
    }
  });
  if (locations.length) result.locations = locations;

  return result;
}

async function main() {
  console.log('Getting item list...');
  const items = await getItemList();
  console.log(`Total items: ${items.length}`);

  let results = {};
  if (existsSync(OUTPUT)) {
    try { results = JSON.parse(readFileSync(OUTPUT, 'utf-8')); } catch {}
  }

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (results[a.id] && results[a.id]._done) continue;
    console.log(`[${i + 1}/${items.length}] ${a.nameZh} (${a.id})...`);
    const html = await fetchItemPage(a.nameZh);
    if (html) {
      try {
        results[a.id] = { ...parseItemData(html, a.nameZh), _done: true };
      } catch (e) {
        results[a.id] = { error: e.message, _done: true };
      }
    } else {
      results[a.id] = { error: 'no_page', _done: true };
    }
    if ((i + 1) % 40 === 0) {
      writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`  Checkpoint (${Object.keys(results).length})`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Done! ${Object.keys(results).length} items saved.`);
}

main().catch(console.error);