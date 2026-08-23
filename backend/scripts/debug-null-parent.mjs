import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.pokemon.findFirst({ where: { id: '0025' }, select: { detail: true } });
const d = JSON.parse(r.detail);
for (const em of (d.egg_moves || [])) {
  for (const m of (em.data || [])) {
    for (const par of (m.parents || [])) {
      if (!par.id) {
        console.log('null parent:', JSON.stringify(par), 'move:', m.name);
      }
    }
  }
}
await p.$disconnect();
