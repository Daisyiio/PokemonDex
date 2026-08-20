#!/usr/bin/env node
/**
 * 52poke 全招式数据批量下载脚本 (升级/学习器/蛋招式/教授招式)
 *
 * 安全策略: MediaWiki API + 批量50页/请求 + 5秒间隔
 *
 * 用法:
 *   node scripts/download_egg_moves.js          # 全量 Gen2-8
 *   node scripts/download_egg_moves.js --test   # 测试模式(Gen2前10页)
 */

const fs = require('fs');
const path = require('path');

const TEST_MODE = process.argv.includes('--test');
const GENS = TEST_MODE ? [2] : [2, 3, 4, 5, 6, 7, 8];
const BATCH_SIZE = TEST_MODE ? 2 : 50;
const DELAY_MS = 5000;
const UA = 'PokemonDex/1.0 (contact: 554091877@qq.com; personal project)';
const API = 'https://wiki.52poke.com/api.php';
const GEN_NAMES = {
  2: '第二世代', 3: '第三世代', 4: '第四世代',
  5: '第五世代', 6: '第六世代', 7: '第七世代', 8: '第八世代',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function padId(id) {
  const n = parseInt(String(id).replace(/\D/g, ''), 10);
  return isNaN(n) ? String(id) : String(n).padStart(4, '0');
}

async function apiGet(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', ...params }).toString();
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) { console.log('  429, 等待30s...'); await sleep(30000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i < 2) { console.log(`  重试: ${e.message}`); await sleep(10000); }
      else throw e;
    }
  }
}

async function apiPost(params) {
  const body = new URLSearchParams({ format: 'json', ...params });
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (r.status === 429) { console.log('  429, 等待30s...'); await sleep(30000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i < 2) { console.log(`  重试: ${e.message}`); await sleep(10000); }
      else throw e;
    }
  }
}

/**
 * 解析招式字段 (通用)
 * Gen2-4: name|type|power|accuracy|pp (无category)
 * Gen5+:  name|type|category|power|accuracy|pp
 */
function parseMoveFields(fields, hasCategory) {
  if (fields.length < 2) return null;
  const m = { name: fields[0].trim(), type: fields[1].trim() };
  if (hasCategory) {
    m.category = (fields[2] || '').trim();
    m.power = (fields[3] || '').trim();
    m.accuracy = (fields[4] || '').trim();
    m.pp = (fields[5] || '').trim();
  } else {
    m.category = '';
    m.power = (fields[2] || '').trim();
    m.accuracy = (fields[3] || '').trim();
    m.pp = (fields[4] || '').trim();
  }
  return m;
}

/**
 * 解析一个区域的所有行
 * sectionType: 'level' | 'tm' | 'tutor' | 'egg'
 */
function parseSection(content, sectionType, hasCategory) {
  // 定位区域: sectionType + 'h' 到 sectionType + 'f'
  const hTag = `learnlist/${sectionType}h`;
  const fTag = `learnlist/${sectionType}f`;
  const start = content.indexOf(hTag);
  const end = content.indexOf(fTag);
  if (start < 0 || end < 0) return [];

  const section = content.substring(start, end);
  const results = [];

  for (const line of section.split('\n')) {
    // 匹配 {{learnlist/sectionTypeN|CONTENT}}
    if (!line.includes(`learnlist/${sectionType}`) || line.includes(`${sectionType}h`) || line.includes(`${sectionType}f`)) continue;
    const m = line.match(/\{\{learnlist\/[^|]+\|(.+)\}\}\s*$/);
    if (!m) continue;
    const inner = m[1];

    if (sectionType === 'breed') {
      // 蛋招式: 先解析父方模板, 剩余是 move fields
      let parents = [];
      let lastEnd = 0;
      const mspRe = /\{\{(MSPN?)\|([^}]*)\}\}/g;
      let msp;
      while ((msp = mspRe.exec(inner)) !== null) {
        const [mspType, mspContent] = [msp[1], msp[2]];
        if (mspType === 'MSP') {
          const parts = mspContent.split('|').filter(p => p.trim());
          if (parts.length >= 2) parents.push({ id: padId(parts[0]), name: parts[1].trim() });
          else if (parts.length === 1 && padId(parts[0]) !== '0000') parents.push({ id: padId(parts[0]), name: '' });
        } else {
          for (const pair of mspContent.split(',')) {
            const seg = pair.split(/[\\|]/);
            if (seg.length >= 2 && seg[0].trim() && seg[1].trim()) parents.push({ id: padId(seg[0]), name: seg[1].trim() });
          }
        }
        lastEnd = msp.index + msp[0].length;
      }
      const afterParents = inner.substring(lastEnd).replace(/^(<br>)?\|?/, '');
      const fields = afterParents.split('|').map(s => s.trim()).filter(s => s && s !== "'''");
      const move = parseMoveFields(fields, hasCategory);
      if (move) { move.parents = parents; results.push(move); }
    } else if (sectionType === 'level' || sectionType === 'tm') {
      // 升级/学习器: 第一个字段是 level/tm, 剩余是 move fields
      const fields = inner.split('|').map(s => s.trim()).filter(s => s && s !== "'''");
      if (fields.length < 3) continue;
      const extra = fields[0]; // level or tm name
      const move = parseMoveFields(fields.slice(1), hasCategory);
      if (move) {
        if (sectionType === 'level') move.level = extra;
        else move.tm = extra;
        results.push(move);
      }
    } else {
      // 教授招式: 直接是 move fields
      const fields = inner.split('|').map(s => s.trim()).filter(s => s && s !== "'''");
      const move = parseMoveFields(fields, hasCategory);
      if (move) results.push(move);
    }
  }

  return results;
}

function parsePage(title, content) {
  const headerMatch = content.match(/\{\{招式表间链接\|([^|]+)\|(\d+)\|/);
  if (!headerMatch) return null;
  const nameZh = headerMatch[1].trim();
  const dexId = padId(headerMatch[2]);

  // 检测模板版本 (level2=Gen2, level5=Gen5, etc.)
  const lvMatch = content.match(/learnlist\/level(\d)/);
  const version = lvMatch ? parseInt(lvMatch[1]) : 5;
  const hasCategory = version >= 5;

  return {
    id: dexId,
    nameZh,
    learnable: parseSection(content, 'level', hasCategory),
    machine: parseSection(content, 'tm', hasCategory),
    egg: parseSection(content, 'breed', hasCategory),
    tutor: parseSection(content, 'tutor', hasCategory),
  };
}

async function downloadGen(gen) {
  const genName = GEN_NAMES[gen];
  console.log(`\n=== ${genName} ===`);

  let allTitles = [];
  let cmcontinue = '';
  do {
    const params = { action: 'query', list: 'categorymembers', cmtitle: `Category:宝可梦招式表（${genName}）`, cmlimit: 'max' };
    if (cmcontinue) params.cmcontinue = cmcontinue;
    const data = await apiGet(params);
    const members = data.query?.categorymembers || [];
    allTitles.push(...members.map(m => m.title));
    cmcontinue = data.continue?.cmcontinue || '';
    console.log(`  页面列表: ${allTitles.length} 页`);
    await sleep(DELAY_MS);
  } while (cmcontinue);

  if (TEST_MODE) allTitles = allTitles.slice(0, 10);

  const results = {};
  const totalBatches = Math.ceil(allTitles.length / BATCH_SIZE);
  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    const batch = allTitles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const data = await apiPost({ action: 'query', titles: batch.join('|'), prop: 'revisions', rvprop: 'content' });
    const pages = data.query?.pages || {};
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      if (page.missing !== undefined || page.invalid !== undefined) continue;
      const content = page.revisions?.[0]?.['*'] || '';
      const parsed = parsePage(page.title, content);
      if (parsed) results[parsed.id] = { nameZh: parsed.nameZh, learnable: parsed.learnable, machine: parsed.machine, egg: parsed.egg, tutor: parsed.tutor };
    }
    const eggTotal = Object.values(results).reduce((s, p) => s + p.egg.length, 0);
    console.log(`  批次 ${batchNum}/${totalBatches}: ${Object.keys(results).length} 只, ${eggTotal} 蛋招式`);
    await sleep(DELAY_MS);
  }

  return results;
}

async function main() {
  console.log(`52poke 全招式批量下载 (${TEST_MODE ? '测试' : '全量 Gen2-8'})`);

  const allGens = {};
  for (const gen of GENS) allGens[String(gen)] = await downloadGen(gen);

  console.log('\n=== 汇总 ===');
  for (const gen of GENS) {
    const data = allGens[String(gen)];
    const count = Object.keys(data).length;
    const lv = Object.values(data).reduce((s, p) => s + p.learnable.length, 0);
    const tm = Object.values(data).reduce((s, p) => s + p.machine.length, 0);
    const egg = Object.values(data).reduce((s, p) => s + p.egg.length, 0);
    const tu = Object.values(data).reduce((s, p) => s + p.tutor.length, 0);
    console.log(`  Gen${gen}: ${count}只 | 升级${lv} 学习器${tm} 蛋招式${egg} 教授${tu}`);
  }

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'moves_by_gen.json');
  fs.writeFileSync(outPath, JSON.stringify(allGens, null, 1), 'utf8');
  console.log(`\n保存: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

main().catch(e => { console.error('致命错误:', e); process.exit(1); });
