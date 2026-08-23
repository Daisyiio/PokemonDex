import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
const nameCount = new Map();

for (const r of all) {
  const d = JSON.parse(r.detail);
  function check(list) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        if (!par.id) {
          nameCount.set(par.name, (nameCount.get(par.name) || 0) + 1);
        }
      }
    }
  }
  for (const em of (d.egg_moves || [])) check(em.data);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) check(em.data);
  }
}

const sorted = [...nameCount.entries()].sort((a, b) => b[1] - a[1]);
console.log('unique null ID names:', sorted.length);
sorted.forEach(([name, count]) => console.log(`  ${count}x ${name}`));
await p.$disconnect();
