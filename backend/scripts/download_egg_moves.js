#!/usr/bin/env node
/**
 * 52poke 蛋招式数据批量下载脚本
 *
 * 安全策略:
 *   - MediaWiki API (api.php) 而非爬 HTML
 *   - 批量获取 50 页/请求
 *   - 每 5 秒 1 个请求
 *   - 总请求数 ~154, 总耗时 ~13 分钟
 *
 * 用法:
 *   node scripts/download_egg_moves.js           # 全量下载 Gen2-8
 *   node scripts/download_egg_moves.js --test   # 测试模式(仅 Gen2 前10页)
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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) {
        console.log('  429 限速, 等待 30s...');
        await sleep(30000);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt < 2) { console.log(`  重试(${attempt+1}/3): ${e.message}`); await sleep(10000); }
      else throw e;
    }
  }
}

async function apiPost(params) {
  const body = new URLSearchParams({ format: 'json', ...params });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (r.status === 429) {
        console.log('  429 限速, 等待 30s...');
        await sleep(30000);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt < 2) { console.log(`  重试(${attempt+1}/3): ${e.message}`); await sleep(10000); }
      else throw e;
    }
  }
}

/**
 * 解析 wikitext 蛋招式部分
 */
function parseEggMoves(content) {
  // 从 {{招式表间链接|小锯鳄|158|2|水|水}} 提取编号和名称
  const headerMatch = content.match(/\{\{招式表间链接\|([^|]+)\|(\d+)\|/);
  if (!headerMatch) return null;
  const nameZh = headerMatch[1].trim();
  const dexId = padId(headerMatch[2]);

  // 定位蛋招式区域
  const breedStart = content.indexOf('learnlist/breedh');
  const breedEnd = content.indexOf('learnlist/breedf');
  if (breedStart < 0 || breedEnd < 0) return { id: dexId, nameZh, eggMoves: [] };

  const section = content.substring(breedStart, breedEnd);
  const moves = [];

  for (const line of section.split('\n')) {
    // 匹配 breed2/breed3/... 行 (排除 breedh 和 breedf)
    if (!line.includes('learnlist/breed') || line.includes('breedh') || line.includes('breedf')) continue;

    // 提取 {{learnlist/breedN|...}} 的内容 (贪婪匹配到行尾的 }})
    const m = line.match(/\{\{learnlist\/breed[^|]*\|(.+)\}\}\s*$/);
    if (!m) continue;
    const inner = m[1];

    // 解析父方: {{MSP|001|妙蛙种子}} 或 {{MSPN|034\尼多王,104\卡拉卡拉,...}}
    let parents = [];
    const mspMatch = inner.match(/\{\{(MSPN?)\|([^}]*)\}\}/);
    if (mspMatch) {
      const mspType = mspMatch[1];
      const mspContent = mspMatch[2];
      if (mspType === 'MSP') {
        // 单只父方: 001|妙蛙种子 或 000(无名称=活动/特殊)
        const parts = mspContent.split('|').filter(p => p.trim());
        if (parts.length >= 2) {
          parents.push({ id: padId(parts[0]), name: parts[1].trim() });
        } else if (parts.length === 1 && padId(parts[0]) !== '0000') {
          parents.push({ id: padId(parts[0]), name: '' });
        }
      } else {
        // 多只父方: 034\尼多王,104\卡拉卡拉 或 182|美丽花
        for (const pair of mspContent.split(',')) {
          const seg = pair.split(/[\\|]/);
          if (seg.length >= 2 && seg[0].trim() && seg[1].trim()) {
            parents.push({ id: padId(seg[0]), name: seg[1].trim() });
          }
        }
      }
    }

    // 父方模板之后的部分: |招式名|类型|威力|命中|PP|...
    const afterParents = inner.substring(inner.indexOf('}}') + 2);
    const cleaned = afterParents.replace(/^(<br>)?\|?/, '');
    const fields = cleaned.split('|').map(s => s.trim()).filter(s => s && s !== "'''");

    if (fields.length >= 1) {
      moves.push({
        name: fields[0],
        type: fields[1] || '',
        power: fields[2] || '',
        accuracy: fields[3] || '',
        pp: fields[4] || '',
        parents,
      });
    }
  }

  return { id: dexId, nameZh, eggMoves: moves };
}

async function downloadGen(gen) {
  const genName = GEN_NAMES[gen];
  console.log(`\n=== ${genName} ===`);

  // 1. 分类 API 获取页面列表
  let allTitles = [];
  let cmcontinue = '';
  do {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:宝可梦招式表（${genName}）`,
      cmlimit: 'max',
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;
    const data = await apiGet(params);
    const members = data.query?.categorymembers || [];
    allTitles.push(...members.map(m => m.title));
    cmcontinue = data.continue?.cmcontinue || '';
    console.log(`  页面列表: ${allTitles.length} 页`);
    await sleep(DELAY_MS);
  } while (cmcontinue);

  if (TEST_MODE) allTitles = allTitles.slice(0, 10);

  // 2. 批量获取页面内容 (50页/请求, POST)
  const results = {};
  const totalBatches = Math.ceil(allTitles.length / BATCH_SIZE);
  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    const batch = allTitles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const data = await apiPost({
      action: 'query',
      titles: batch.join('|'),
      prop: 'revisions',
      rvprop: 'content',
    });

    const pages = data.query?.pages || {};
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      if (page.missing !== undefined || page.invalid !== undefined) continue;
      const content = page.revisions?.[0]?.['*'] || '';
      const parsed = parseEggMoves(content);
      if (parsed) results[parsed.id] = { nameZh: parsed.nameZh, eggMoves: parsed.eggMoves };
    }

    const eggTotal = Object.values(results).reduce((s, p) => s + p.eggMoves.length, 0);
    console.log(`  批次 ${batchNum}/${totalBatches}: 累计 ${Object.keys(results).length} 只, ${eggTotal} 招式`);
    await sleep(DELAY_MS);
  }

  return results;
}

async function main() {
  console.log('52poke 蛋招式批量下载');
  console.log(`模式: ${TEST_MODE ? '测试(前10页)' : '全量(Gen2-8)'}`);
  console.log(`策略: API批量获取, ${BATCH_SIZE}页/请求, ${DELAY_MS}ms间隔`);

  const allGens = {};
  for (const gen of GENS) {
    allGens[String(gen)] = await downloadGen(gen);
  }

  // 统计
  console.log('\n=== 汇总 ===');
  for (const gen of GENS) {
    const data = allGens[String(gen)];
    const count = Object.keys(data).length;
    const eggTotal = Object.values(data).reduce((s, p) => s + p.eggMoves.length, 0);
    console.log(`  Gen${gen}: ${count} 只, ${eggTotal} 条蛋招式`);
  }

  // 保存
  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'egg_moves_by_gen.json');
  fs.writeFileSync(outPath, JSON.stringify(allGens, null, 1), 'utf8');
  console.log(`\n保存到: ${outPath}`);
  console.log(`文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
}

main().catch(e => { console.error('致命错误:', e); process.exit(1); });
