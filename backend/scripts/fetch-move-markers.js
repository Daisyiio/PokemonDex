#!/usr/bin/env node
/**
 * 从 52poke 招式表页面批量抓取蛋招式标记字段 (* ‡ ^)
 * 输出: data/move_markers.json  { gen: { id: { moveName: marker } } }
 *
 * 安全策略: 批量25页/请求 + 4秒间隔 + 遇到429等待60s + 断点续传
 */

const fs = require('fs');
const path = require('path');
const TEST_MODE = process.argv.includes('--test');

const API = 'https://wiki.52poke.com/api.php';
const UA = 'PokemonDex/1.0 (contact: 554091877@qq.com; personal project)';
const GEN_NAMES = {
  2: '第二世代', 3: '第三世代', 4: '第四世代',
  5: '第五世代', 6: '第六世代', 7: '第七世代', 8: '第八世代',
};
const BATCH_SIZE = TEST_MODE ? 2 : 25;
const DELAY_MS = TEST_MODE ? 500 : 4000;
const OUT_FILE = path.join(__dirname, '..', 'data', 'move_markers.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiPost(params) {
  const body = new URLSearchParams({ format: 'json', ...params });
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (r.status === 429) { console.log('  429, 等待60s...'); await sleep(60000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i < 2) { console.log(`  重试: ${e.message}`); await sleep(15000); }
      else throw e;
    }
  }
}

/** 拆分模板参数，正确跳过嵌套 {{ }} */
function splitArgs(content) {
  const inner = content.slice(content.indexOf('|') + 1, content.lastIndexOf('}}'));
  const args = [];
  let depth = 0, cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '{' && inner[i + 1] === '{') { depth++; cur += '{{'; i++; }
    else if (c === '}' && inner[i + 1] === '}') { depth--; cur += '}}'; i++; }
    else if (c === '|' && depth === 0) { args.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

/** 解析一个招式表页面内容，返回 { id, markers: {moveName: marker} } */
function parsePage(content) {
  const headerMatch = content.match(/\{\{招式表间链接\|([^|]+)\|(\d+)\|/);
  if (!headerMatch) return null;
  const dexId = String(parseInt(headerMatch[2], 10)).padStart(4, '0');
  const markers = {};
  const lines = content.split('\n').filter((l) => l.includes('{{learnlist/breed') && !l.includes('breedh') && !l.includes('breedf'));
  for (const line of lines) {
    const start = line.indexOf('{{learnlist/breed');
    const after = line.indexOf('|', start);
    const end = line.lastIndexOf('}}');
    if (after < 0 || end < 0) continue;
    const body = line.substring(start, end + 2);
    const args = splitArgs(body);
    if (args.length < 3) continue;
    const moveName = args[1].trim();
    let marker = '';
    for (const a of args) {
      const t = a.trim();
      if (t === '‡' || t === '*' || t === '^') marker = t;
    }
    markers[moveName] = marker;
  }
  return { id: dexId, markers };
}

async function listCategoryMembers(category, cmcontinue) {
  const params = { action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: 'max' };
  if (cmcontinue) params.cmcontinue = cmcontinue;
  const data = await apiPost(params);
  return {
    titles: (data.query?.categorymembers || []).map((m) => m.title),
    cmcontinue: data.continue?.cmcontinue || '',
  };
}

async function fetchGen(gen) {
  const genName = GEN_NAMES[gen];
  console.log(`\n=== ${genName} ===`);
  let allTitles = [];
  let cmcontinue = '';
  do {
    const r = await listCategoryMembers(`宝可梦招式表（${genName}）`, cmcontinue);
    allTitles.push(...r.titles);
    cmcontinue = r.cmcontinue;
    console.log(`  页面列表: ${allTitles.length} 页`);
    await sleep(DELAY_MS);
  } while (cmcontinue);

  if (TEST_MODE) allTitles = allTitles.slice(0, 5);

  const markersByPoke = {};
  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    const batch = allTitles.slice(i, i + BATCH_SIZE);
    const data = await apiPost({ action: 'query', titles: batch.join('|'), prop: 'revisions', rvprop: 'content' });
    const pages = data.query?.pages || {};
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      if (page.missing !== undefined || page.invalid !== undefined) continue;
      const content = page.revisions?.[0]?.['*'] || '';
      const parsed = parsePage(content);
      if (parsed && Object.keys(parsed.markers).length) {
        markersByPoke[parsed.id] = parsed.markers;
      }
    }
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allTitles.length / BATCH_SIZE);
    console.log(`  批次 ${batchNum}/${totalBatches}: 已提取 ${Object.keys(markersByPoke).length} 只`);
    fs.writeFileSync(OUT_FILE + '.tmp', JSON.stringify(markersByPoke, null, 0), 'utf8');
    await sleep(DELAY_MS);
  }
  return markersByPoke;
}

async function main() {
  console.log(`52poke 蛋招式标记抓取 (${TEST_MODE ? '测试' : '全量 Gen2-8'})`);
  const allGens = {};
  for (const gen of [2, 3, 4, 5, 6, 7, 8]) {
    allGens[String(gen)] = await fetchGen(gen);
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(allGens, null, 0), 'utf8');
  fs.rmSync(OUT_FILE + '.tmp', { force: true });
  console.log(`\n保存: ${OUT_FILE}`);
}

main().catch((e) => { console.error('致命错误:', e); process.exit(1); });