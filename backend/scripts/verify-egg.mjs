import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// 验证几个宝可梦的蛋招式来源ID
for (const id of ['0001', '0025', '0131', '0384', '0930']) {
  const r = await p.pokemon.findFirst({ where: { id }, select: { detail: true } });
  if (!r) continue;
  const d = JSON.parse(r.detail);
  const allIds = [];
  for (const em of (d.egg_moves || [])) {
    for (const m of (em.data || [])) {
      for (const par of (m.parents || [])) {
        allIds.push(par.id);
      }
    }
  }
  const bad = allIds.filter(i => !/^\d{4}[A-Z]?$/.test(i));
  console.log(`${id}: ${allIds.length} parents, bad: ${bad.length}`, bad.length ? bad.slice(0, 3) : '');
}

await p.$disconnect();
