import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.pokemon.findFirst({ where: { id: '0001' }, select: { detail: true } });
const d = JSON.parse(r.detail);
for (const em of (d.egg_moves || [])) {
  for (const m of (em.data || [])) {
    if (m.name === '咒术') {
      console.log(`move: ${m.name}`);
      for (const par of (m.parents || [])) {
        console.log(`  ${par.id} → ${par.name}`);
      }
    }
  }
}
await p.$disconnect();
