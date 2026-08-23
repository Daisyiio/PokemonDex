import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.pokemon.findFirst({ where: { id: '0001' }, select: { detail: true } });
const d = JSON.parse(r.detail);
const eggMoves = d.egg_moves;
if (eggMoves && eggMoves[0] && eggMoves[0].data && eggMoves[0].data[0]) {
  const em = eggMoves[0].data[0];
  console.log('parents type:', typeof em.parents);
  console.log('is array:', Array.isArray(em.parents));
  console.log('first parent:', JSON.stringify(em.parents[0]));
} else {
  console.log('egg_moves structure:', JSON.stringify(eggMoves).slice(0, 500));
}
await p.$disconnect();
