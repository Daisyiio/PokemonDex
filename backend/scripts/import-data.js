const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const DATASET_PATH = process.env.DATASET_PATH || path.join(__dirname, '..', '..', 'pokemon-dataset-zh-main');
const prisma = new PrismaClient();

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(DATASET_PATH, rel), 'utf8'));
}

function str(v) {
  if (v == null) return null;
  return Array.isArray(v) ? String(v[0]) : String(v);
}

async function main() {
  console.log('Dataset path:', DATASET_PATH);

  // 1. Pokemon: combine simple_pokedex + national + full detail
  const simple = readJson('data/simple_pokedex.json');
  const national = readJson('data/pokedex/national.json');
  const nationalMap = new Map(national.map((e) => [e.id, e]));

  const pokemonFiles = fs.readdirSync(path.join(DATASET_PATH, 'data/pokemon')).filter((f) => f.endsWith('.json'));
  console.log('Pokemon files:', pokemonFiles.length);

  const pokemonData = [];
  for (const file of pokemonFiles) {
    const detail = JSON.parse(fs.readFileSync(path.join(DATASET_PATH, 'data/pokemon', file), 'utf8'));
    const id = detail.pokedex_id;
    const nat = nationalMap.get(id);
    const firstForm = detail.forms && detail.forms[0];
    pokemonData.push({
      id,
      nameZh: detail.name_zh,
      nameJa: detail.name_ja || null,
      nameEn: detail.name_en || null,
      types: JSON.stringify(firstForm ? firstForm.types : []),
      gen: nat ? nat.gen : null,
      filter: nat ? nat.filter : null,
      icon: nat ? nat.icon : null,
      image: firstForm ? firstForm.image : null,
      detail: JSON.stringify(detail),
    });
  }

  pokemonData.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  await prisma.pokemon.deleteMany();
  await prisma.pokemon.createMany({ data: pokemonData });
  console.log('Pokemon inserted:', pokemonData.length);

  // 2. Pokedex (national + regions)
  const dexFiles = fs.readdirSync(path.join(DATASET_PATH, 'data/pokedex')).filter((f) => f.endsWith('.json'));
  await prisma.pokedex.deleteMany();
  for (const file of dexFiles) {
    const name = file.replace(/\.json$/, '');
    const data = readJson(`data/pokedex/${file}`);
    await prisma.pokedex.create({ data: { name, data: JSON.stringify(data) } });
  }
  console.log('Pokedex inserted:', dexFiles.length);

  // 3. Moves
  const moves = readJson('data/move_list.json');
  await prisma.move.deleteMany();
  let zSeq = 1;
  await prisma.move.createMany({
    data: moves.map((m) => ({
      id: /^\d+$/.test(String(m.id)) ? String(m.id) : `z-${zSeq++}`,
      nameZh: m.name_zh,
      nameJa: m.name_jp || null,
      nameEn: m.name_en || null,
      type: m.type || null,
      category: m.category || null,
      power: m.power != null ? String(m.power) : null,
      accuracy: m.accuracy != null ? String(m.accuracy) : null,
      pp: m.pp != null ? String(m.pp) : null,
      description: m.description || null,
      generation: m.generation || null,
      isZ: m.is_z != null ? String(m.is_z) : null,
    })),
  });
  console.log('Moves inserted:', moves.length);

  // 4. Abilities
  const abilities = readJson('data/ability_list.json');
  await prisma.ability.deleteMany();
  const seenAbilityIds = new Set();
  await prisma.ability.createMany({
    data: abilities.map((a) => {
      let id = String(a.id);
      let n = 2;
      while (seenAbilityIds.has(id)) id = `${a.id}-${n++}`;
      seenAbilityIds.add(id);
      return {
        id,
        nameZh: a.name_zh,
        nameJa: a.name_ja || null,
        nameEn: a.name_en || null,
        description: a.description || null,
        commonCount: a.common_count != null ? Number(a.common_count) : null,
        hiddenCount: a.hidden_count != null ? Number(a.hidden_count) : null,
        generation: a.generation || null,
      };
    }),
  });
  console.log('Abilities inserted:', abilities.length);

  // 5. Items (flatten category tree)
  const itemsTree = readJson('data/item_list.json');
  await prisma.item.deleteMany();
  const items = [];
  let seq = 1;
  function walk(node, parentCategory) {
    for (const child of node) {
      if (child.type === 'category') {
        items.push({
          id: seq++,
          nameZh: child.name,
          nameJa: null,
          nameEn: null,
          type: 'category',
          category: parentCategory || null,
          description: null,
          icon: null,
        });
        walk(child.children || [], child.name);
      } else {
        items.push({
          id: seq++,
          nameZh: child.name_zh,
          nameJa: child.name_ja || null,
          nameEn: child.name_en || null,
          type: 'item',
          category: parentCategory || null,
          description: str(child.description),
          icon: str(child.icon),
        });
      }
    }
  }
  walk(itemsTree, null);
  await prisma.item.createMany({ data: items });
  console.log('Items inserted:', items.length);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());