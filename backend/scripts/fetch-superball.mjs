import { writeFileSync } from 'fs';

const res = await fetch('https://wiki.52poke.com/api.php?action=parse&page=' + encodeURIComponent('超级球（道具）') + '&prop=text&format=json&redirects=1', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const data = await res.json();
writeFileSync('backend/temp/superball.html', data.parse.text['*'], 'utf-8');
console.log('saved, length:', data.parse.text['*'].length);