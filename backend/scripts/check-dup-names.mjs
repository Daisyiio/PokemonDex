import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.pokemon.findFirst({ where: { id: '0001' }, select: { detail: true } });
const d = JSON.parse(r.detail);
for (const em of (d.egg_moves || [])) {
  for (const m of (em.data || [])) {
    const nameMap = new Map();
    for (const par of (m.parents || [])) {
      const key = par.name;
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key).push(par.id);
    }
    for (const [name, ids] of nameMap) {
      if (ids.length > 1) {
        console.log(`move: ${m.name} | parent: ${name} | ids: ${ids.join(', ')}`);
      }
    }
  }
}
await p.$disconnect();
