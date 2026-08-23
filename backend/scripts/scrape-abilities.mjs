import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'temp', 'pages');
const OUTPUT = join(__dirname, '..', 'data', 'abilities_extra.json');
const DELAY_MS = 800;

mkdirSync(CACHE_DIR, { recursive: true });

async function getAbilityList() {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`http://localhost:3000/api/abilities?page=${page}&pageSize=200`);
    const data = await res.json();
    all.push(...data.items.map(m => ({ id: m.id, nameZh: m.nameZh })));
    if (data.items.length < 200) break;
    page++;
  }
  return all;
}

async function fetchAbilityPage(nameZh) {
  const cacheFile = join(CACHE_DIR, `${nameZh}.html`);
  if (existsSync(cacheFile)) return readFileSync(cacheFile, 'utf-8');
  const url = `https://wiki.52poke.com/api.php?action=parse&page=${encodeURIComponent(nameZh + '（特性）')}&prop=text&format=json&redirects=1`;
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

function parseAbilityData(html) {
  const $ = load(html);
  const result = {};

  // 效果描述（从 infobox 下方的段落找）
  let effectText = '';
  $('p').each((_, p) => {
    const text = $(p).text().trim();
    if (text.length > 10 && !text.includes('（英文') && !text.includes('（日文') && !text.startsWith('神奇宝贝百科')) {
      effectText += text + '\n';
    }
  });
  const cleaned = effectText.split('\n').filter(l => l.length > 10 && !l.includes('浏览')).join('\n').trim();
  if (cleaned.length > 20) result.effect = cleaned;

  // 各版本说明
  const descriptions = {};
  $('table').each((_, tbl) => {
    if ($(tbl).find('th').first().text().includes('游戏版本')) {
      $(tbl).find('tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length >= 2) {
          const game = $(tds[0]).text().trim();
          const desc = $(tds[1]).text().trim();
          if (game && desc && game.length < 30) descriptions[game] = desc;
        }
      });
    }
  });
  if (Object.keys(descriptions).length) result.descriptions = descriptions;

  return result;
}

async function main() {
  console.log('Getting ability list...');
  const abilities = await getAbilityList();
  console.log(`Total abilities: ${abilities.length}`);

  let results = {};
  if (existsSync(OUTPUT)) {
    try { results = JSON.parse(readFileSync(OUTPUT, 'utf-8')); } catch {}
  }
  console.log(`Already scraped: ${Object.keys(results).length}`);

  const toScrape = abilities.filter(m => !results[m.id]);
  console.log(`Remaining: ${toScrape.length}`);

  for (let i = 0; i < toScrape.length; i++) {
    const a = toScrape[i];
    console.log(`[${i + 1}/${toScrape.length}] ${a.nameZh} (${a.id})...`);
    const html = await fetchAbilityPage(a.nameZh);
    if (html) {
      try {
        results[a.id] = parseAbilityData(html);
      } catch (e) {
        results[a.id] = { error: e.message };
      }
    } else {
      results[a.id] = { error: 'no_page' };
    }
    if ((i + 1) % 20 === 0) {
      writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`  Checkpoint (${Object.keys(results).length})`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Done! ${Object.keys(results).length} abilities saved.`);
}

main().catch(console.error);