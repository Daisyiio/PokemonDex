import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// 找一个有地区形态的宝可梦，比如呆呆兽 (0079)
const r = await p.pokemon.findFirst({ where: { id: '0079' }, select: { detail: true } });
const d = JSON.parse(r.detail);
console.log('forms count:', d.forms?.length);
d.forms?.forEach((f, i) => {
  console.log(`  form[${i}]: name=${f.name}, types=${f.types}`);
});
await p.$disconnect();
