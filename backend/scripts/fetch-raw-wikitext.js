const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DELAY_MS = 1500;
const API_BASE = 'https://wiki.52poke.com/api.php';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'raw-wikitext.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWikitext(pokemonName) {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(pokemonName)}&prop=wikitext&format=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.parse?.wikitext?.['*'] || '';
}

async function main() {
  const pokemonList = await prisma.pokemon.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, nameZh: true, nameEn: true },
  });

  console.log(`Total Pokemon: ${pokemonList.length}`);

  // Resume from existing checkpoint
  let results = {};
  let completed = 0;
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      completed = Object.keys(results).length;
      console.log(`Resuming from checkpoint: ${completed} Pokemon already fetched`);
    } catch (e) {
      console.log('Invalid checkpoint file, starting fresh');
    }
  }

  let failed = 0;

  for (const p of pokemonList) {
    if (results[p.id]) {
      completed++;
      continue;
    }
    completed++;
    const pct = ((completed / pokemonList.length) * 100).toFixed(1);
    process.stdout.write(`[${completed}/${pokemonList.length} ${pct}%] ${p.id} ${p.nameZh}... `);

    try {
      const wikitext = await fetchWikitext(p.nameZh);
      results[p.id] = wikitext;
      console.log(`OK (${wikitext.length} chars)`);
    } catch (err) {
      failed++;
      console.log(`FAILED: ${err.message}`);
      results[p.id] = '';
    }

    if (completed % 50 === 0) {
      fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
      console.log(`  [checkpoint saved]`);
    }

    await sleep(DELAY_MS);
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nDone! ${completed} total, ${failed} failed. Saved to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());