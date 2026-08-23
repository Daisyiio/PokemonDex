import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
const ITEMS = new Set(['模仿香草', '模仿香草（道具）', '电气球']);
const results = [];

for (const r of all) {
  const d = JSON.parse(r.detail);
  function check(list) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        if (!par.id && ITEMS.has(par.name)) {
          results.push({ pokemonId: r.id, pokemonName: d.name_zh || r.id, move: m.name, itemName: par.name });
        }
      }
    }
  }
  for (const em of (d.egg_moves || [])) check(em.data);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) check(em.data);
  }
}

// 按道具名分组
const grouped = new Map();
for (const r of results) {
  if (!grouped.has(r.itemName)) grouped.set(r.itemName, []);
  grouped.get(r.itemName).push(r);
}

for (const [itemName, entries] of grouped) {
  const pokemon = [...new Set(entries.map(e => `${e.pokemonId} ${e.pokemonName}`))];
  console.log(`\n${itemName} (${entries.length}次)`);
  console.log(`  出现在: ${pokemon.join(', ')}`);
}
await p.$disconnect();
