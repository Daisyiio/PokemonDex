import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
const bad = [];

for (const r of all) {
  const d = JSON.parse(r.detail);
  function check(list, pid) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        const sid = String(par.id);
        if (sid.length !== 4 || !/^\d{4}[A-Z]?$/.test(sid)) {
          bad.push({ pokemonId: pid, move: m.name, parentId: sid });
        }
      }
    }
  }
  for (const em of (d.egg_moves || [])) check(em.data, r.id);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) check(em.data, r.id);
  }
}

console.log('total bad:', bad.length);
if (bad.length) console.log('samples:', bad.slice(0, 5));
await p.$disconnect();
