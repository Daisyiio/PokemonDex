import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.pokemon.findMany({ select: { id: true, detail: true } });
let mergeCount = 0;
let descCount = 0;

for (const r of all) {
  const d = JSON.parse(r.detail);
  let changed = false;

  function fixParents(list) {
    for (const m of (list || [])) {
      for (const par of (m.parents || [])) {
        // 合并两种模仿香草
        if (par.name === '模仿香草（道具）') {
          par.name = '模仿香草';
          mergeCount++;
          changed = true;
        }
        // 给电气球加描述
        if (par.name === '电气球' && !par.desc) {
          par.desc = '如果其一亲代拥有电气球，皮丘就会学会伏特攻击，伏特攻击不能通过培育学会。';
          descCount++;
          changed = true;
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

console.log('merged 模仿香草:', mergeCount);
console.log('desc added to 电气球:', descCount);
await p.$disconnect();
