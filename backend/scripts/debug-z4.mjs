import { readFileSync } from 'fs';
import { load } from 'cheerio';

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
      if (!inZ) {
        inZ = true;
        console.log('  Z start, td:', JSON.stringify(td.substring(0, 80)));
      }
      zCrystal = td;
      console.log('  Z crystal:', JSON.stringify(td.substring(0, 50)));
    }
    if (inZ && (th === 'Ｚ招式' || th === 'Z招式')) {
      zMove = td;
      console.log('  Z move:', JSON.stringify(td.substring(0, 50)));
    }
    if (inZ && th === '威力') {
      const p = td.match(/\d{2,3}/);
      console.log('  Z power td:', JSON.stringify(td.substring(0, 50)), 'match:', p);
      if (p) zPower = p[0];
      doneZ = true;
    }
  });

  console.log('Result:', { zCrystal, zMove, zPower, inZ, doneZ });
  if (zCrystal && zCrystal !== '[[（道具）|]]' && !zCrystal.includes('[[')) {
    result.z = { crystal: zCrystal, move: zMove || null, power: zPower || null };
  }
  return result;
}

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
console.log('Parsing 拍击...');
const r = parseMoveData(html);
console.log('Final:', JSON.stringify(r.z));