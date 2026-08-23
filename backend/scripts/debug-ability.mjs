import { readFileSync, existsSync } from 'fs';
import { load } from 'cheerio';

const file = 'backend/temp/pages/恶臭（特性）.html';
if (!existsSync(file)) {
  console.log('file not found, fetching...');
  const res = await fetch('https://wiki.52poke.com/api.php?action=parse&page=恶臭（特性）&prop=text&format=json&redirects=1');
  const data = await res.json();
  if (data.error) { console.log('error:', data.error); process.exit(1); }
  const html = data.parse.text['*'];
  const $ = load(html);
  $('h2').each((i, h) => {
    const id = $(h).attr('id');
    if (id) console.log('h2:', id);
  });
} else {
  const html = readFileSync(file, 'utf-8');
  const $ = load(html);
  $('h2').each((i, h) => {
    const id = $(h).attr('id');
    if (id) console.log('h2:', id);
  });
}