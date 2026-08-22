import { readFileSync, existsSync, readdirSync } from 'fs';
import { load } from 'cheerio';

const CACHE_DIR = 'backend/temp/pages';

function parseMoveData(html) {
  const $ = load(html);
  const result = {};

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
  return result;
}

// 直接从缓存目录读取所有文件，不依赖ID映射
const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.html'));
let zCount = 0;
for (const file of files) {
  const html = readFileSync(`${CACHE_DIR}/${file}`, 'utf-8');
  const result = parseMoveData(html);
  if (result.z) zCount++;
}
console.log(`Z-moves: ${zCount} / ${files.length}`);