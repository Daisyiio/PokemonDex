const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const FILE = path.join(__dirname, '..', 'data', 'moves_by_gen.json');

function norm(value, fallback = '—') {
  if (value === undefined || value === null) return fallback;
  let v = String(value).trim();
  v = v.replace(/&mdash;/g, '—');
  if (v === '' || v === '-') return fallback;
  return v;
}

function isLevelLike(value) {
  const v = String(value).trim().replace(/&mdash;/g, '—');
  return v === '—' || v === '-' || /^\d+$/.test(v) || v === '无' || v === '进化' || v === '';
}

async function main() {
  const moves = await prisma.move.findMany({ select: { nameZh: true, type: true, category: true, power: true, accuracy: true, pp: true } });
  const byName = new Map();
  for (const m of moves) byName.set(m.nameZh, m);
  console.log(`Move DB loaded: ${moves.length}`);

  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let fixed = 0, dropped = 0, kept = 0;

  for (const [gen, species] of Object.entries(data)) {
    for (const [id, info] of Object.entries(species)) {
      // learnable
      if (Array.isArray(info.learnable)) {
        const out = [];
        for (const m of info.learnable) {
          const nameCand = m.type;   // corrupted rows put move name here
          const nameCand2 = m.name;
          const move = byName.get(String(nameCand).trim().replace(/&mdash;/g, '—')) || byName.get(String(nameCand2).trim().replace(/&mdash;/g, '—'));
          if (!move) { dropped++; continue; }
          const nameFromType = byName.has(String(nameCand).trim().replace(/&mdash;/g, '—'));
          const level = isLevelLike(m.name) ? norm(m.name) : (isLevelLike(m.level) ? norm(m.level) : '—');
          out.push({
            name: move.nameZh,
            type: move.type || '—',
            category: move.category || '—',
            power: move.power ? String(move.power) : '—',
            accuracy: move.accuracy ? String(move.accuracy) : '—',
            pp: move.pp ? String(move.pp) : '—',
            level,
          });
          fixed++;
        }
        info.learnable = out;
      }
      // machine
      if (Array.isArray(info.machine)) {
        const out = [];
        for (const m of info.machine) {
          const nameCand = String(m.name || '').trim().replace(/&mdash;/g, '—') || '';
          const move = byName.get(nameCand);
          if (!move) { const alt = byName.get(String(m.tm || '').trim()); if (alt) { out.push({ name: alt.nameZh, type: alt.type||'—', category: alt.category||'—', power: alt.power?String(alt.power):'—', accuracy: alt.accuracy?String(alt.accuracy):'—', pp: alt.pp?String(alt.pp):'—', tm: m.tm }); fixed++; } else { dropped++; } continue; }
          out.push({
            name: move.nameZh,
            type: move.type || '—',
            category: move.category || '—',
            power: move.power ? String(move.power) : '—',
            accuracy: move.accuracy ? String(move.accuracy) : '—',
            pp: move.pp ? String(move.pp) : '—',
            tm: norm(m.tm, 'TM'),
          });
          fixed++;
        }
        info.machine = out;
      }
      // egg
      if (Array.isArray(info.egg)) {
        const out = [];
        for (const m of info.egg) {
          const nameCand = String(m.name || '').trim().replace(/&mdash;/g, '—') || '';
          const move = byName.get(nameCand);
          if (!move) { dropped++; continue; }
          out.push({
            name: move.nameZh,
            type: move.type || '—',
            category: move.category || '—',
            power: move.power ? String(move.power) : '—',
            accuracy: move.accuracy ? String(move.accuracy) : '—',
            pp: move.pp ? String(move.pp) : '—',
            parents: m.parents || [],
          });
          fixed++;
        }
        info.egg = out;
      }
      // tutor
      if (Array.isArray(info.tutor)) {
        const out = [];
        for (const m of info.tutor) {
          const nameCand = String(m.name || '').trim().replace(/&mdash;/g, '—') || '';
          const move = byName.get(nameCand);
          if (!move) { dropped++; continue; }
          out.push({
            name: move.nameZh,
            type: move.type || '—',
            category: move.category || '—',
            power: move.power ? String(move.power) : '—',
            accuracy: move.accuracy ? String(move.accuracy) : '—',
            pp: move.pp ? String(move.pp) : '—',
          });
          fixed++;
        }
        info.tutor = out;
      }
    }
  }

  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Done! fixed=${fixed}, dropped=${dropped}, kept=${kept}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());