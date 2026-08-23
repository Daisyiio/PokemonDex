import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// 收集所有 null ID 的父母
const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
const nullParents = [];

for (const r of all) {
  const d = JSON.parse(r.detail);
  function check(list, pid) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        if (!par.id) {
          nullParents.push({ pokemonId: pid, move: m.name, parentName: par.name });
        }
      }
    }
  }
  for (const em of (d.egg_moves || [])) check(em.data, r.id);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) check(em.data, r.id);
  }
}

console.log('null ID parents:', nullParents.length);
nullParents.forEach(x => console.log(`  ${x.pokemonId} ${x.move} → ${x.parentName}`));
await p.$disconnect();
