import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'temp', 'pages');
const OUTPUT = join(__dirname, '..', 'data', 'moves_extra.json');

const DELAY_MS = 800;

mkdirSync(CACHE_DIR, { recursive: true });

async function getMoveList() {
  let all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`http://localhost:3000/api/moves?page=${page}&pageSize=200`);
    const data = await res.json();
    all = all.concat(data.items.map(m => ({ id: m.id, nameZh: m.nameZh })));
    if (data.items.length < 200) break;
    page++;
  }
  return all;
}

async function fetchMovePage(nameZh) {
  const cacheFile = join(CACHE_DIR, `${nameZh}.html`);
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, 'utf-8');
  }
  const url = `https://wiki.52poke.com/api.php?action=parse&page=${encodeURIComponent(nameZh + '（招式）')}&prop=text&format=json&redirects=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PokemonDex/1.0 (learning project)' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.error) return null;
    const html = data.parse.text['*'];
    writeFileSync(cacheFile, html, 'utf-8');
    return html;
  } catch {
    return null;
  }
}

function parseMoveData(html) {
  const $ = load(html);
  const result = {};

  // 1. 招式标志（去重）
  const flagSet = new Set();
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('接触类')) flagSet.add('接触');
    if (text.includes('受守住影响')) flagSet.add('受守住影响');
    if (text.includes('不受魔法反射影响')) flagSet.add('不受魔法反射影响');
    if (text.includes('不可以被抢夺')) flagSet.add('不可以被抢夺');
    if (text.includes('受鹦鹉学舌影响')) flagSet.add('受鹦鹉学舌影响');
    if (text.includes('受王者之证')) flagSet.add('受王者之证影响');
  });
  result.flags = [...flagSet];

  // 2. Z招式
  $('table').each((_, tbl) => {
    const html = $(tbl).html() || '';
    if (html.includes('Z纯晶') || html.includes('Ｚ純晶')) {
      const rows = $(tbl).find('tr');
      let zCrystal = null, zMove = null, zPower = null;
      rows.each((i, tr) => {
        const cells = $(tr).find('td, th');
        const text = cells.first().text().trim();
        if (text.includes('纯晶') || text.includes('純晶')) zCrystal = cells.eq(1).text().trim();
        if (text.includes('招式')) zMove = cells.eq(1).text().trim();
        if (text.includes('威力') || text.includes('威')) {
          const p = cells.eq(1).text().trim().match(/\d{2,3}/);
          if (p) zPower = p[0];
        }
      });
      if (zCrystal || zMove) result.z = { crystal: zCrystal || null, move: zMove || null, power: zPower || null };
    }
  });

  // 3. 极巨招式
  $('th:contains("极巨招式")').each((_, th) => {
    const tr = $(th).closest('tr');
    let maxMove = tr.find('td').first().text().trim();
    if (!maxMove || maxMove === '未知') {
      const nextTr = tr.next('tr');
      if (nextTr.length) {
        maxMove = nextTr.find('td').first().text().trim();
        const powerTd = nextTr.find('td').eq(1).text().trim().match(/\d{2,3}/);
        if (maxMove) result.max = { move: maxMove, power: powerTd ? powerTd[0] : null };
      }
    }
  });

  // 4. 华丽大赛
  $('table').each((_, tbl) => {
    const html = $(tbl).html() || '';
    if (html.includes('华丽大赛') || html.includes('華麗大賽')) {
      const rows = $(tbl).find('tr');
      let contestType = null, contestAppeal = null, contestJam = null;
      rows.each((i, tr) => {
        const cells = $(tr).find('td');
        const text = cells.first().text().trim();
        if (text.includes('类别') || text.includes('類別')) contestType = cells.eq(1).text().trim();
        if (text.includes('表演')) contestAppeal = cells.eq(1).text().trim().match(/[\d♥❤]/)?.[0] || cells.eq(1).text().trim();
        if (text.includes('妨害')) contestJam = cells.eq(1).text().trim().match(/[\d]/)?.[0] || cells.eq(1).text().trim();
      });
      if (contestType) result.contest = { type: contestType, appeal: contestAppeal, jam: contestJam };
    }
  });

  // 5. 招式附加效果
  const effectSection = $('#招式附加效果');
  if (effectSection.length) {
    let effectText = '';
    let el = effectSection.parent().next();
    while (el.length && !el.is('h2') && !el.is('h3')) {
      const tag = el.prop('tagName').toLowerCase();
      if (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'dl') {
        effectText += el.text() + '\n';
      } else if (tag === 'div' && el.attr('class')?.includes('toc')) {
        // skip
      } else if (tag === 'h2' || tag === 'h3') {
        break;
      }
      el = el.next();
    }
    result.effect = effectText.trim();
  }

  // 6. 各版本说明
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
  result.descriptions = descriptions;

  return result;
}

async function main() {
  console.log('Fetching move list...');
  const moves = await getMoveList();
  console.log(`Total moves: ${moves.length}`);

  // 检查已有结果
  let results = {};
  if (existsSync(OUTPUT)) {
    try { results = JSON.parse(readFileSync(OUTPUT, 'utf-8')); } catch {}
  }
  console.log(`Already scraped: ${Object.keys(results).length}`);

  const toScrape = moves.filter(m => !results[m.id]);
  console.log(`Remaining: ${toScrape.length}`);

  for (let i = 0; i < toScrape.length; i++) {
    const move = toScrape[i];
    console.log(`[${i + 1}/${toScrape.length}] ${move.nameZh} (${move.id})...`);
    const html = await fetchMovePage(move.nameZh);
    if (html) {
      try {
        const data = parseMoveData(html);
        results[move.id] = data;
        console.log(`  flags=${data.flags?.length || 0} z=${data.z ? 'yes' : 'no'} max=${data.max ? 'yes' : 'no'}`);
      } catch (e) {
        console.error(`  Parse error: ${e.message}`);
      }
    } else {
      console.log(`  No page`);
      results[move.id] = { error: 'no_page' };
    }

    if ((i + 1) % 10 === 0) {
      writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`  Saved checkpoint (${Object.keys(results).length})`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nDone! Saved ${Object.keys(results).length} results to ${OUTPUT}`);
}

main().catch(console.error);