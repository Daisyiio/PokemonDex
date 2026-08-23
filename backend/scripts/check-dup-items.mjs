import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
const dups = [];

for (const r of all) {
  const d = JSON.parse(r.detail);
  function check(list) {
    for (const m of (list || [])) {
      if (!m.parents) continue;
      const items = m.parents.filter(p => p.type === 'item');
      const names = items.map(p => p.name);
      if (names.filter(n => n === '模仿香草').length > 1) {
        dups.push({ pokemonId: r.id, move: m.name, count: names.filter(n => n === '模仿香草').length });
      }
    }
  }
  for (const em of (d.egg_moves || [])) check(em.data);
  for (const f of (d.forms || [])) {
    for (const em of (f.egg_moves || [])) check(em.data);
  }
}

console.log('dups:', dups.length);
dups.slice(0, 20).forEach(d => console.log(`  ${d.pokemonId} ${d.move} x${d.count}`));
await p.$disconnect();
