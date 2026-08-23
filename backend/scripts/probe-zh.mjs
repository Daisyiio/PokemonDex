import { writeFileSync } from 'fs';

const res = await fetch('https://pokeapi.co/api/v2/item/2/');
const item = await res.json();
console.log('item2 name:', item.name);
console.log('names:');
for (const n of item.names) {
  console.log(`  ${n.language.name}: ${n.name}`);
}
writeFileSync('backend/temp/item2.json', JSON.stringify(item.names, null, 2), 'utf-8');