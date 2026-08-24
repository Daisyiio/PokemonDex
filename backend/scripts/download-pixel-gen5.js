#!/usr/bin/env node
/**
 * 补充下载 `gen5/` 静态像素 PNG（正面 + 背面）
 * 命名规则: 英文名去掉横杠、小写
 * 输出: pixel-assets/pokemon/front|back/{id}-{name}.png
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const FRONT = path.join(__dirname, '..', '..', 'pixel-assets', 'pokemon', 'front-png');
const BACK = path.join(__dirname, '..', '..', 'pixel-assets', 'pokemon', 'back-png');
const UA = 'PokemonDex-Assets/1.0';
const BASE = 'https://play.pokemonshowdown.com/sprites';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dl(url, dest) {
  if (fs.existsSync(dest)) return 'skip';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) { await sleep(30000); continue; }
      if (!r.ok) return `err:${r.status}`;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) return 'err:empty';
      fs.writeFileSync(dest, buf);
      return 'ok';
    } catch (e) {
      if (i < 2) { await sleep(2000); continue; }
      return `err:${e.message}`;
    }
  }
  return 'err';
}

async function main() {
  for (const d of [FRONT, BACK]) fs.mkdirSync(d, { recursive: true });
  const rows = await prisma.pokemon.findMany({ orderBy: { id: 'asc' }, select: { id: true, nameZh: true, nameEn: true } });
  console.log(`共 ${rows.length} 只`);

  let okF = 0, okB = 0, fail = [];

  for (const p of rows) {
    const en = (p.nameEn || '').toLowerCase().replace(/[^a-z0-9]/g, ''); // 去掉横杠、空格、特殊字符
    if (!en) { console.log(`\n${p.id} ${p.nameZh}: 无英文名`); continue; }

    const fDest = path.join(FRONT, `${p.id}-${en}.png`);
    const bDest = path.join(BACK, `${p.id}-${en}.png`);

    if (fs.existsSync(fDest) && fs.existsSync(bDest)) { okF++; okB++; continue; }

    const fr = fs.existsSync(fDest) ? 'skip' : await dl(`${BASE}/gen5/${en}.png`, fDest);
    await sleep(300);
    const br = fs.existsSync(bDest) ? 'skip' : await dl(`${BASE}/gen5-back/${en}.png`, bDest);
    await sleep(300);

    if (fr === 'ok') okF++; else if (fr !== 'skip') fail.push(`${p.id} front:${fr}`);
    if (br === 'ok') okB++; else if (br !== 'skip') fail.push(`${p.id} back:${br}`);
    process.stdout.write(`\r${p.id} ${p.nameZh} 正:${okF} 背:${okB} 失败:${fail.length}`);
  }

  console.log(`\n完成! 正面=${okF} 背面=${okB} 失败=${fail.length}`);
  if (fail.length) console.log(fail.slice(0, 15).join('; '));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());