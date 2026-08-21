const fs = require('fs');
const path = require('path');

const MARKERS_FILE = path.join(__dirname, '..', 'data', 'move_markers.json');
const MOVES_FILE = path.join(__dirname, '..', 'data', 'moves_by_gen.json');

const markers = JSON.parse(fs.readFileSync(MARKERS_FILE, 'utf8'));
const moves = JSON.parse(fs.readFileSync(MOVES_FILE, 'utf8'));

let applied = 0;
for (const [gen, genMarkers] of Object.entries(markers)) {
  for (const [id, markerMap] of Object.entries(genMarkers)) {
    const species = moves[gen]?.[id];
    if (!species || !Array.isArray(species.egg)) continue;
    for (const egg of species.egg) {
      if (egg.name in markerMap) {
        egg.marker = markerMap[egg.name];
        applied++;
      }
    }
  }
}

fs.writeFileSync(MOVES_FILE, JSON.stringify(moves, null, 0), 'utf8');
console.log(`Done! 应用标记到 ${applied} 条蛋招式`);