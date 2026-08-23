import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// 查看蛋招式来源中带地区后缀的ID是否能在数据库中找到
const r = await p.pokemon.findFirst({ where: { id: '0001' }, select: { detail: true } });
const d = JSON.parse(r.detail);
const suffixIds = new Set();
for (const em of (d.egg_moves || [])) {
  for (const m of (em.data || [])) {
    for (const par of (m.parents || [])) {
      if (par.id && /[A-Z]$/.test(par.id)) {
        suffixIds.add(par.id);
      }
    }
  }
}

console.log('suffix IDs found:', [...suffixIds].sort());
// 检查这些 ID 能否在数据库中找到
for (const sid of [...suffixIds].slice(0, 10)) {
  const found = await p.pokemon.findFirst({ where: { id: sid }, select: { id: true, nameZh: true } });
  console.log(`  ${sid}: ${found ? found.id + ' ' + found.nameZh : 'NOT FOUND'}`);
}

// 也看看数据库里有没有带后缀的 ID
const withSuffix = await p.pokemon.findMany({
  where: { id: { matches: /\d[A-Z]$/ } },
  select: { id: true, nameZh: true },
  take: 20
});
console.log('\nDB entries with letter suffix:', withSuffix.length);
withSuffix.forEach(x => console.log(`  ${x.id} ${x.nameZh}`));

await p.$disconnect();
