import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { load } from 'cheerio';

const CACHE_DIR = 'backend/temp/pages';
const OUTPUT = 'backend/data/moves_extra.json';

async function getIdMap() {
  const map = {};
  let page = 1;
  while (true) {
    const res = await fetch(`http://localhost:3000/api/moves?page=${page}&pageSize=200`);
    const data = await res.json();
    for (const m of data.items) map[m.nameZh] = m.id;
    if (data.items.length < 200) break;
    page++;
  }
  return map;
}

function parseMoveData(html) {
  const $ = load(html);
  const result = {};

  // 1. 招式标志
  const flagSet = new Set();
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('接触类')) flagSet.add('接触类招式');
    if (text.includes('受守住影响')) flagSet.add('受守住影响');
    if (text.includes('魔法反射')) flagSet.add('不受魔法反射影响');
    if (text.includes('不可以被抢夺')) flagSet.add('不可以被抢夺');
    if (text.includes('鹦鹉学舌')) flagSet.add('受鹦鹉学舌影响');
    if (text.includes('王者之证')) flagSet.add('受王者之证影响');
  });
  if (flagSet.size) result.flags = [...flagSet];

  // 2. Z招式
  let zCrystal = null, zMove = null, zPower = null;
  let inZ = false, doneZ = false;

  $('table.roundy').first().find('tr').each((_, tr) => {
    if (doneZ) return;
    const th = $(tr).find('th').first().text().trim();
    const td = $(tr).find('td').first().text().trim();
    if (th === 'Ｚ纯晶' || th === 'Z纯晶') {
      if (!inZ) inZ = true;
      zCrystal = td;
    }
    if (inZ && (th === 'Ｚ招式' || th === 'Z招式')) {
      zMove = td;
    }
    if (inZ && th === '威力') {
      const p = td.match(/\d{2,3}/);
      if (p) zPower = p[0];
      doneZ = true;
    }
  });

  if (zCrystal && zCrystal !== '[[（道具）|]]' && !zCrystal.includes('[[')) {
    result.z = { crystal: zCrystal, move: zMove || null, power: zPower || null };
  }

  // 极巨招式
  result.max = null;
  $('th').each((_, th) => {
    const text = $(th).text().trim();
    if (text === '极巨招式' || text === '極巨招式') {
      const tr = $(th).closest('tr');
      const tds = tr.find('td');
      if (tds.length) {
        const maxMove = tds.first().text().trim();
        if (maxMove && maxMove !== '未知') {
          const p = tds.first().text().match(/\d{2,3}/);
          result.max = { move: maxMove, power: p ? p[0] : null };
        }
      }
    }
  });

  // 华丽大赛
  const contestList = [];
  const seenContest = new Set();
  $('table').each((_, tbl) => {
    const h = $(tbl).html() || '';
    if (!h.includes('华丽大赛') && !h.includes('華麗大賽')) return;
    const $tbl = $(tbl);
    // 跳过容器表（找第一个非空th，如果不是类别/表演/妨害就跳过）
    const nonEmptyTh = $tbl.find('th').filter((_, th) => $(th).text().trim()).first().text().trim();
    if (!nonEmptyTh.includes('类别') && !nonEmptyTh.includes('表演') && !nonEmptyTh.includes('妨害')) return;
    const items = {};
    $tbl.find('tr').each((_, tr) => {
      const th = $(tr).find('th').first().text().trim();
      const td = $(tr).find('td').first().text().trim();
      if (th.includes('类别') || th.includes('類別')) items.type = td;
      if (th.includes('表演')) items.appeal = td.replace(/\s+/g, '');
      if (th.includes('妨害')) items.jam = td.replace(/\s+/g, '');
    });
    // 找世代
    let gen = null;
    const genMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
    $tbl.find('tr').each((_, tr) => {
      if (gen) return;
      const td = $(tr).find('td').first().text().trim();
      const m = td.match(/([一二三四五六七八九])[世世代]/);
      if (m && genMap[m[1]]) gen = genMap[m[1]];
    });
    // 去重
    const key = items.type + items.appeal + items.jam + (gen || '');
    if (items.type && !seenContest.has(key)) {
      seenContest.add(key);
      contestList.push({ ...items, gen: gen ? Number(gen) : undefined });
    }
  });
  if (contestList.length) result.contest = contestList;

  // 出现游戏
  const games = [];
  $('table').each((_, tbl) => {
    const firstTh = $(tbl).find('th').first().text().trim();
    if (firstTh.includes('第一世代') || firstTh.includes('第二世代')) {
      $(tbl).find('th').each((_, th) => {
        const text = $(th).text().trim();
        const m = text.match(/(第[一二三四五六七八九]世代)/);
        if (m) games.push(m[1]);
      });
    }
  });
  if (games.length) result.games = [...new Set(games)];

  // 招式附加效果
  const effectSection = $('#招式附加效果');
  if (effectSection.length) {
    let effectText = '';
    let el = effectSection.parent().next();
    while (el.length && !el.is('h2') && !el.is('h3')) {
      const tag = el.prop('tagName').toLowerCase();
      if (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'dl') {
        effectText += el.text() + '\n';
      } else if (tag === 'h2' || tag === 'h3') break;
      el = el.next();
    }
    if (effectText.trim()) result.effect = effectText.trim();
  }

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
  console.log('Getting ID map...');
  const idMap = await getIdMap();
  console.log(`Total moves: ${Object.keys(idMap).length}`);

  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.html'));
  console.log(`Cached pages: ${files.length}`);

  const results = {};
  let ok = 0, fail = 0, noMatch = 0, zCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const nameZh = file.replace(/\.html$/, '');
    const id = idMap[nameZh];
    if (!id) { noMatch++; continue; }

    const html = readFileSync(`${CACHE_DIR}/${file}`, 'utf-8');
    try {
      const data = parseMoveData(html);
      results[id] = data;
      if (data.z) zCount++;
      ok++;
    } catch (e) {
      results[id] = { error: e.message };
      fail++;
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nDone! OK: ${ok}, Fail: ${fail}, No match: ${noMatch}, Z-moves: ${zCount}`);
}

main().catch(console.error);