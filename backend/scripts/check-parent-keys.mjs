import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.pokemon.findFirst({ where: { id: '0001' }, select: { detail: true } });
const d = JSON.parse(r.detail);
const em = d.egg_moves[0].data[0];
console.log('parent keys:', Object.keys(em.parents[0]));
console.log('sample:', JSON.stringify(em.parents[0]));
await p.$disconnect();
