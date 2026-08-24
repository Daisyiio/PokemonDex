// 下载 PokeAPI 像素图标
// 每只宝可梦一张，以编号命名
// 目标：pixel-assets/pokemon/{id}.png

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, '..', '..', 'pixel-assets', 'pokemon');
const BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// 最大全国图鉴编号（目前到 1025）
const MAX_ID = 1025;

// 并发数
const CONCURRENCY = 3;
const DELAY_MS = 500;

function download(id, retries = 3) {
  return new Promise((resolve) => {
    const file = path.join(OUT_DIR, `${id}.png`);
    if (fs.existsSync(file)) { resolve(true); return; }

    const url = `${BASE_URL}/${id}.png`;
    const tryDownload = (attempt) => {
      https.get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode !== 200) {
          if (attempt < retries) {
            setTimeout(() => tryDownload(attempt + 1), 1000);
          } else {
            resolve(false);
          }
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length > 100) {
            fs.writeFileSync(file, buf);
            resolve(true);
          } else if (attempt < retries) {
            setTimeout(() => tryDownload(attempt + 1), 1000);
          } else {
            resolve(false);
          }
        });
      }).on('error', () => {
        if (attempt < retries) {
          setTimeout(() => tryDownload(attempt + 1), 1000);
        } else {
          resolve(false);
        }
      });
    };
    tryDownload(0);
  });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let success = 0;
  let fail = 0;
  const queue = [];

  for (let id = 1; id <= MAX_ID; id++) {
    queue.push(id);
  }

  console.log(`开始下载 ${queue.length} 只宝可梦的像素图标...`);

  // 分批并发下载
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(download));
    for (const ok of results) {
      if (ok) success++;
      else fail++;
    }
    const pct = Math.round((i + batch.length) / queue.length * 100);
    process.stdout.write(`\r进度: ${pct}% | 成功: ${success} | 失败: ${fail}`);
  }

  console.log(`\n完成！共成功 ${success} 张，失败 ${fail} 张`);
}

run().catch(console.error);