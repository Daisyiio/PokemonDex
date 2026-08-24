const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, '..', '..', 'pixel-assets', 'pokemon');
const BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

const missing = [34, 38, 43, 46, 68, 80, 81, 82, 83, 85, 86, 88, 89, 91, 92, 94, 95, 586];

async function download(id) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const url = `${BASE_URL}/${id}.png`;
        https.get(url, { timeout: 15000 }, (res) => {
          if (res.statusCode !== 200) { reject(new Error('status ' + res.statusCode)); return; }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (buf.length > 100) {
              fs.writeFileSync(path.join(OUT_DIR, `${id}.png`), buf);
              resolve();
            } else { reject(new Error('too small')); }
          });
        }).on('error', reject);
      });
      console.log(`  ${id}.png OK`);
      return true;
    } catch (e) {
      console.log(`  ${id}.png 重试 ${attempt+1}/5: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return false;
}

async function run() {
  console.log(`重试下载 ${missing.length} 张缺失图标...`);
  let ok = 0;
  for (const id of missing) {
    if (await download(id)) ok++;
  }
  console.log(`成功: ${ok}, 失败: ${missing.length - ok}`);
}

run().catch(console.error);