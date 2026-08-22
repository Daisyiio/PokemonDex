// 测试：从52poke抓取一个招式页面的数据
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function testScrape() {
  // 测试招式：拍击（第一代，简单的招式）
  const moveName = '拍击';
  const url = `https://wiki.52poke.com/api.php?action=parse&page=${encodeURIComponent(moveName + '（招式）')}&prop=text&format=json&redirects=1`;

  console.log(`Fetching: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PokemonDex/1.0 (learning project)' },
    });
    const data = await res.json();
    if (data.error) {
      console.error('API error:', data.error);
      return;
    }
    const html = data.parse.text['*'];
    // 保存原始HTML以供分析
    writeFileSync(join(__dirname, '..', 'temp', 'test-move.html'), html, 'utf-8');
    console.log('HTML saved, length:', html.length);
    console.log('Page title:', data.parse.title);
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

testScrape();