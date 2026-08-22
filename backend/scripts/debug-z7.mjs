import { readFileSync, existsSync, readdirSync } from 'fs';
import { load } from 'cheerio';

const CACHE_DIR = 'backend/temp/pages';

// Test parseMoveData directly
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

// Test a few files
const files = ['拍击.html', '连环巴掌.html', '火焰拳.html'];
for (const file of files) {
  if (!existsSync(`${CACHE_DIR}/${file}`)) {
    console.log(`${file}: NOT FOUND`);
    continue;
  }
  const html = readFileSync(`${CACHE_DIR}/${file}`, 'utf-8');
  const result = parseMoveData(html);
  console.log(`${file}: z=${result.z ? JSON.stringify(result.z) : 'NONE'}`);
}