#!/usr/bin/env node
/**
 * 批量下载像素素材 (基于本地数据库英文名):
 *  - 宝可梦动画 GIF (正面 ani/ + 背面 ani-back/)  → pixel-assets/pokemon/front|back
 *  - 道具图标 → pixel-assets/items
 *  - 特殊素材(蛋/徽章等) → pixel-assets/misc
 * 安全: 350ms 间隔 + User-Agent + 失败重试 + 断点续传
 *
 * 用法:
 *   node backend/scripts/download-pixel-assets.js            # 全量
 *   node backend/scripts/download-pixel-assets.js --test     # 前15只
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ROOT = path.join(__dirname, '..', '..', 'pixel-assets');
const FRONT_DIR = path.join(ROOT, 'pokemon', 'front');
const BACK_DIR = path.join(ROOT, 'pokemon', 'back');
const ITEM_DIR = path.join(ROOT, 'items');
const MISC_DIR = path.join(ROOT, 'misc');

const UA = 'PokemonDex-Assets/1.0 (daisy personal project)';
const DELAY = 350;
const TEST = process.argv.includes('--test');
const LIMIT = TEST ? 15 : 0;
const BASE = 'https://play.pokemonshowdown.com/sprites';

const ITEMS = [
  'poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'friend-ball', 'heal-ball',
  'fast-ball', 'level-ball', 'lure-ball', 'heavy-ball', 'love-ball', 'moon-ball',
  'safari-ball', 'sport-ball', 'net-ball', 'nest-ball', 'repeat-ball', 'timer-ball',
  'quick-ball', 'dive-ball', 'luxury-ball', 'premier-ball', 'dream-ball', 'beast-ball',
  'cherish-ball', 'park-ball', 'super-potion', 'hyper-potion', 'max-potion',
  'full-restore', 'revive', 'max-revive', 'rare-candy', 'pp-up', 'exp-share',
  'fire-stone', 'water-stone', 'leaf-stone', 'moon-stone', 'sun-stone',
  'shiny-stone', 'dusk-stone', 'dawn-stone', 'oval-stone',
  'everstone', 'destiny-knot', 'soothe-bell', 'lucky-egg', 'focus-sash',
  'leftovers', 'choice-band', 'choice-scarf', 'choice-specs',
  'toxic-orb', 'flame-orb', 'life-orb', 'assault-vest', 'rocky-helmet', 'eviolite',
  'tm-fire', 'tm-water', 'tm-electric', 'tm-grass', 'tm-ice', 'tm-fighting',
  'tm-poison', 'tm-ground', 'tm-flying', 'tm-psychic', 'tm-bug', 'tm-rock',
  'tm-ghost', 'tm-dragon', 'tm-dark', 'tm-steel', 'tm-normal',
];

const MISC = ['egg'];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function download(url, dest) {
  if (fs.existsSync(dest)) return 'skip';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) { await sleep(30000); continue; }
      if (!r.ok) return `err:${r.status}`;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length === 0) return 'err:empty';
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
  for (const d of [FRONT_DIR, BACK_DIR, ITEM_DIR, MISC_DIR]) fs.mkdirSync(d, { recursive: true });

  console.log('从数据库获取英文名...');
  const pokes = await prisma.pokemon.findMany({ orderBy: { id: 'asc' }, select: { id: true, nameZh: true, nameEn: true } });
  console.log(`共 ${pokes.length} 只`);

  const list = LIMIT ? pokes.slice(0, LIMIT) : pokes;
  let okF = 0, okB = 0, fail = [], skipF = 0, skipB = 0, noEn = 0;

  for (const p of list) {
    const en = (p.nameEn || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!en) { noEn++; console.log(`\n${p.id} ${p.nameZh}: 无英文名,跳过`); continue; }

    const fDest = path.join(FRONT_DIR, `${p.id}-${en}.gif`);
    const bDest = path.join(BACK_DIR, `${p.id}-${en}.gif`);

    const fr = await download(`${BASE}/ani/${en}.gif`, fDest);
    await sleep(DELAY);
    const br = await download(`${BASE}/ani-back/${en}.gif`, bDest);
    await sleep(DELAY);

    if (fr === 'ok') okF++; else if (fr === 'skip') skipF++; else fail.push(`${p.id} ${en} front:${fr}`);
    if (br === 'ok') okB++; else if (br === 'skip') skipB++; else fail.push(`${p.id} ${en} back:${br}`);

    if (list.length > 15) {
      process.stdout.write(`\r${p.id} ${p.nameZh} 正:${okF} 背:${okB} 失败:${fail.length} 无英文名:${noEn}`);
    } else {
      console.log(`${p.id} ${p.nameZh} (${en}) 正:${fr} 背:${br}`);
    }
  }

  console.log(`\n宝可梦: 正面ok=${okF} 背面ok=${okB} 跳过=${skipF + skipB} 失败=${fail.length}`);
  if (fail.length) console.log('失败样例:', fail.slice(0, 10).join('; '));

  // 道具
  let itOk = 0, itFail = [];
  for (const item of ITEMS) {
    const dest = path.join(ITEM_DIR, `${item}.png`);
    const r = await download(`${BASE}/itemicons/${item}.png`, dest);
    if (r === 'ok') itOk++; else if (r !== 'skip') itFail.push(`${item}:${r}`);
    await sleep(DELAY);
  }
  console.log(`道具: ok=${itOk} 失败=${itFail.length} ${itFail.slice(0, 8).join('; ')}`);

  // 特殊素材
  for (const m of MISC) {
    await download(`${BASE}/itemicons/${m}.png`, path.join(MISC_DIR, `${m}.png`));
    await sleep(DELAY);
  }

  console.log('完成!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());