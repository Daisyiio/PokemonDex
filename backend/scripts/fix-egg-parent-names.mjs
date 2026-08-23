import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const SUFFIX_REGION = { G: '伽勒尔', H: '洗翠', A: '阿罗拉' };
const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
let fixCount = 0;

for (const r of all) {
  const d = JSON.parse(r.detail);
  let changed = false;

  function fixParents(list) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        if (par.id && /^[A-Z]$/.test(par.id.slice(-1))) {
          const suffix = par.id.slice(-1);
          const region = SUFFIX_REGION[suffix];
          if (region && !par.name.includes(region)) {
            par.name = `${region}${par.name}`;
            fixCount++;
            changed = true;
          }
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
