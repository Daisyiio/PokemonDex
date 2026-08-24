import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const where = {
  AND: ['草', '毒'].map((t) => ({ types: { contains: t } })),
};
console.log('AND query:', JSON.stringify(where));

const res = await p.pokemon.findMany({
  where,
  take: 5,
  select: { id: true, nameZh: true, types: true },
});
console.log('results:', res.length);
res.forEach((r) => console.log(`  ${r.id} ${r.nameZh} ${r.types}`));

// Also test single contains
const res2 = await p.pokemon.findMany({
  where: { types: { contains: '草' } },
  take: 3,
  select: { id: true, nameZh: true, types: true },
});
console.log('single grass:', res2.length);
res2.forEach((r) => console.log(`  ${r.id} ${r.nameZh} ${r.types}`));

await p.$disconnect();