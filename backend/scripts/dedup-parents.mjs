import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
let dedupCount = 0;

for (const r of all) {
  const d = JSON.parse(r.detail);
  let changed = false;

  function dedup(list) {
    for (const m of (list || [])) {
      if (!m.parents) continue;
      const seen = new Set();
      const unique = [];
      for (const par of m.parents) {
        const key = `${par.id ?? ''}|${par.name}|${par.type ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(par);
        }
      }
      if (unique.length < m.parents.length) {
        dedupCount += m.parents.length - unique.length;
        m.parents = unique;
        changed = true;
      }
    }
  }

  for (const em of (d.egg_moves || [])) dedup(em.data);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) dedup(em.data);
  }

  if (changed) {
    await p.pokemon.update({ where: { id: r.id }, data: { detail: JSON.stringify(d) } });
  }
}

console.log('removed duplicates:', dedupCount);
await p.$disconnect();
