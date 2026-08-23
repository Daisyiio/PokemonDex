import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
let fixCount = 0;

for (const r of all) {
  const d = JSON.parse(r.detail);
  let changed = false;

  function fixParents(list) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        const sid = String(par.id);
        const m = sid.match(/^(\d+)([A-Z]?)$/);
        if (m && m[1].length < 4) {
          par.id = m[1].padStart(4, '0') + m[2];
          fixCount++;
          changed = true;
        }
      }
    }
  }

  for (const em of (d.egg_moves || [])) fixParents(em.data);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) fixParents(em.data);
  }

  if (changed) {
    await p.pokemon.update({ where: { id: r.id }, data: { detail: JSON.stringify(d) } });
  }
}

console.log('fixed:', fixCount);
await p.$disconnect();
