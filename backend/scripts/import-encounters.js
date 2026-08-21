const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ENCOUNTERS_FILE = path.join(__dirname, '..', 'data', 'encounters.json');

async function main() {
  if (!fs.existsSync(ENCOUNTERS_FILE)) {
    console.error('encounters.json not found. Run scrape-encounters.js first.');
    process.exit(1);
  }

  const encounters = JSON.parse(fs.readFileSync(ENCOUNTERS_FILE, 'utf8'));
  const entries = Object.entries(encounters);
  console.log(`Found ${entries.length} Pokemon with encounter data`);

  let updated = 0;
  for (const [id, data] of entries) {
    const json = JSON.stringify(data);
    await prisma.pokemon.update({
      where: { id },
      data: { encounters: json },
    });
    updated++;
    if (updated % 100 === 0) {
      console.log(`  Updated ${updated}/${entries.length}`);
    }
  }

  console.log(`Done! Updated ${updated} Pokemon with encounter data`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
