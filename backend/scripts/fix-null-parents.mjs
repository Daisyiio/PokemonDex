import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// 已知道具列表
const ITEMS = new Set(['模仿香草', '模仿香草（道具）', '电气球']);

// 建立名字→ID映射
const allPokemon = await p.pokemon.findMany({ select: { id: true, nameZh: true } });
const nameToId = new Map();
for (const pk of allPokemon) {
  nameToId.set(pk.nameZh, pk.id);
}

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
let fixCount = 0;
let itemFixCount = 0;
let notFound = new Map();

for (const r of all) {
  const d = JSON.parse(r.detail);
  let changed = false;

  function fixParents(list) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        if (!par.id) {
          // 道具：标记 type=item
          if (ITEMS.has(par.name)) {
            par.type = 'item';
            itemFixCount++;
            changed = true;
          } else {
            // 宝可梦：反查 ID
            const foundId = nameToId.get(par.name);
            if (foundId) {
              par.id = foundId;
              fixCount++;
              changed = true;
            } else {
              notFound.set(par.name, (notFound.get(par.name) || 0) + 1);
            }
          }
        }
      }
    }
  }

  for (const em of (d.egg_moves || [])) fixParents(em.data);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) fixParents(em.data);
  }

  if (changed) {
    await p.pokemon.update({ where: { id: r.id }, data: { detail: JSON.stringify(d) } });
  }
}

console.log('pokemon fixed:', fixCount);
console.log('items marked:', itemFixCount);
console.log('not found:', notFound.size);
for (const [name, count] of notFound) {
  console.log(`  ${count}x ${name}`);
}
await p.$disconnect();
