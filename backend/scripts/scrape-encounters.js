const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DELAY_MS = 1500;
const API_BASE = 'https://wiki.52poke.com/api.php';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'encounters.json');

const GAME_NAMES = {
  R: '红', G: '绿', B: '蓝', Y: '黄',
  RG: '红/绿', RB: '红/蓝', RGB: '红/绿/蓝',
  GS: '金/银', GSC: '金/银/水晶',
  RSE: '红宝石/蓝宝石/绿宝石', RS: '红宝石/蓝宝石', E: '绿宝石',
  FRLG: '火红/叶绿',
  DP: '钻石/珍珠', DPPt: '钻石/珍珠/白金', Pt: '白金', PPt: '钻石/珍珠/白金',
  HGSS: '心金/魂银', HG: '心金', SS: '魂银',
  BW: '黑/白', W: '白', B2W2: '黑2/白2',
  XY: 'X/Y',
  ORAS: '欧米伽红宝石/阿尔法蓝宝石', OR: '欧米伽红宝石', AS: '阿尔法蓝宝石',
  SM: '太阳/月亮',
  USUM: '究极之日/究极之月', MUM: '究极之日', SUS: '究极之月',
  LPLE: '皮卡丘/伊布',
  SWSH: '剑/盾', SW: '剑', SH: '盾',
  SWSHE: '剑/盾DLC', SwShE: '剑/盾DLC',
  BDSP: '晶灿钻石/明亮珍珠', BD: '晶灿钻石', SP: '明亮珍珠',
  LA: '传说 阿尔宙斯',
  SV: '朱/紫', S: '朱', V: '紫', ST: '蓝DLC',
  SVT: '朱/紫DLC',
  ZA: '传说 Z-A', ZAM: '传说 Z-A DLC',
};

const EXTRA_GAME_NAMES = {
  FRLG: '火红/叶绿',
  HGSS: '心金/魂银',
  USUM: '究极之日/究极之月',
  SM: '太阳/月亮',
  ORAS: '欧米伽红宝石/阿尔法蓝宝石',
  OR: '欧米伽红宝石', AS: '阿尔法蓝宝石',
  XY: 'X/Y',
  BW: '黑/白', B2W2: '黑2/白2',
  RSE: '红宝石/蓝宝石/绿宝石',
  RGB: '红/绿/蓝',
  DP: '钻石/珍珠', DPPt: '钻石/珍珠/白金', Pt: '白金',
  BDSP: '晶灿钻石/明亮珍珠',
  LA: '传说 阿尔宙斯',
  SV: '朱/紫', S: '朱', V: '紫',
  ZA: '传说 Z-A',
  SWSH: '剑/盾', SW: '剑', SH: '盾',
};

// Method keywords that can appear at the start of a parameter
const METHOD_KEYWORDS = [
  '野生', '交换', '定点', '可见', '群聚对战', '宝可追踪',
  '极巨团体战', '极巨大冒险', '太晶团体战', '可见/定点',
  '随机', '闯入对战', '垂钓', '岛屿扫描', '进化', '生蛋',
  '闯入对戰', '闯入对战', '撞击', '撞树', '冲浪',
  '大量出现', '摇动草丛', '现象', '获得', '赠送', '购买', '解锁',
  '事件', 'event', 'null', 'trade', '复活化石', '树果堆', '沙云',
  '晃动的树',
];

// Method keywords that can appear at the end of a parameter (e.g., "大木博士赠送")
const METHOD_SUFFIXES = [
  '赠送', '博士赠送', '交换',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWikitext(pokemonName) {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(pokemonName)}&prop=wikitext&format=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.parse?.wikitext?.['*'] || '';
}

function findEncounterTemplates(wikitext) {
  const results = [];
  const marker = '{{获得方式/main|';
  let pos = 0;

  while (true) {
    const idx = wikitext.indexOf(marker, pos);
    if (idx === -1) break;

    let depth = 1;
    let i = idx + marker.length;
    while (i < wikitext.length) {
      if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
        depth++;
        i += 2;
      } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
        depth--;
        if (depth === 0) {
          results.push(wikitext.substring(idx, i + 2));
          pos = i + 2;
          break;
        }
        i += 2;
      } else {
        i++;
      }
    }
    if (i >= wikitext.length) break;
  }
  return results;
}

function splitTemplateParams(templateStr) {
  const firstPipe = templateStr.indexOf('|');
  const lastDoubleClose = templateStr.lastIndexOf('}}');
  if (firstPipe === -1 || lastDoubleClose === -1 || firstPipe >= lastDoubleClose) return [];

  const inner = templateStr.substring(firstPipe + 1, lastDoubleClose);

  const params = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '{' && inner[i + 1] === '{') {
      depth++;
      current += '{{';
      i++;
    } else if (inner[i] === '}' && inner[i + 1] === '}') {
      depth--;
      current += '}}';
      i++;
    } else if (inner[i] === '|' && depth === 0) {
      params.push(current.trim());
      current = '';
    } else {
      current += inner[i];
    }
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function cleanWikimarkup(text) {
  let t = text;
  t = t.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
  t = t.replace(/\{\{Ka\|([^}]*)\}\}/g, '$1');
  t = t.replace(/\{\{Jo\|([^}]*)\}\}/g, '$1');
  t = t.replace(/\{\{rt\|(\d+)\|([^}]*)\}\}/g, '$2');
  t = t.replace(/\{\{tt\|([^|]*)\|([^}]*)\}\}/g, '$1');
  t = t.replace(/\{\{道路\|([^|]*)\|(\d+)\|(\d+)\}\}/g, '$2道路');
  t = t.replace(/\{\{道路\|([^|]*)\|(\d+)\|(\d+)\|(\d+)\}\}/g, '$2道路');
  t = t.replace(/\{\{巢穴\|([^|]*)\|([^}]*)\}\}/g, '巢穴');
  t = t.replace(/\{\{GameIconzh\/\d+\|([^}]*)\}\}/g, '');
  t = t.replace(/\{\{[^}]*\}\}/g, '');
  t = t.replace(/<[^>]*>/g, '');
  return t.trim();
}

function isMethodKeyword(text) {
  const t = text.trim();
  for (const kw of METHOD_KEYWORDS) {
    if (t.startsWith(kw)) return kw;
  }
  for (const suffix of METHOD_SUFFIXES) {
    if (t.endsWith(suffix)) return suffix;
  }
  return null;
}

function parseExtraGameVersion(text) {
  const m = text.match(/\{\{GameIconzh\/\d+\|([^}]+)\}\}/);
  if (m) {
    const code = m[1];
    return EXTRA_GAME_NAMES[code] || code;
  }
  const trimmed = text.trim();
  if (EXTRA_GAME_NAMES[trimmed]) return EXTRA_GAME_NAMES[trimmed];
  return trimmed;
}

function parseEncounters(wikitext, pokemonId) {
  const templates = findEncounterTemplates(wikitext);
  const encounters = [];
  const numericId = pokemonId.replace(/^0+/, '');

  for (const tmpl of templates) {
    const rawParams = splitTemplateParams(tmpl);
    const params = rawParams.filter(p => !/^row=\d+$/.test(p));

    const rawId = params[0] || '';
    if (rawId.replace(/^0+/, '') !== numericId && rawId !== pokemonId) continue;

    if (params.length < 5) continue;

    const gen = params[1] || '';
    const game = params[2] || '';

    let location = '';
    let method = '';
    let note = '';
    let extraGame = '';

    // params[3] = sub version indicator (1, 2, 0, etc.)
    // params[4+] = encounter details (location, method, note, extra)

    for (let i = 4; i < params.length; i++) {
      const p = params[i];

      // Handle extra= parameter
      if (p.startsWith('extra=')) {
        const extraContent = p.slice(6);
        if (extraContent.trim()) {
          extraGame = parseExtraGameVersion(extraContent);
        }
        continue;
      }

      const cleaned = cleanWikimarkup(p);

      if (!cleaned) continue;

      // Check if it's a method keyword
      const kw = isMethodKeyword(cleaned);
      if (kw) {
        if (!method) {
          method = cleaned;
        } else {
          note += (note ? '、' : '') + cleaned;
        }
        continue;
      }

      // Check for special notes
      if (cleaned === '双插槽模式' || cleaned === '雙插槽模式') {
        note += (note ? '、' : '') + '双插槽';
        continue;
      }

      // If no method found yet, treat as location
      if (!method) {
        location += (location ? '、' : '') + cleaned;
      } else {
        note += (note ? '、' : '') + cleaned;
      }
    }

    if (method === 'null') method = '';
    if (method === 'trade') method = '交换';
    if (method === 'event') method = '活动赠送';

    // Clean up location
    location = location.replace(/^、+|、+$/g, '').replace(/、{2,}/g, '、').trim();

    const entry = {
      gen: Number(gen) || 0,
      game: game,
      gameName: GAME_NAMES[game] || game,
      location: location,
      method: method,
      note: note,
    };
    if (extraGame) entry.extraGame = extraGame;
    encounters.push(entry);
  }

  return encounters;
}

async function main() {
  const pokemonList = await prisma.pokemon.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, nameZh: true, nameEn: true },
  });

  console.log(`Total Pokemon: ${pokemonList.length}`);

  // Resume from existing checkpoint
  let results = {};
  let completed = 0;
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      completed = Object.keys(results).length;
      console.log(`Resuming from checkpoint: ${completed} Pokemon already scraped`);
    } catch (e) {
      console.log('Invalid checkpoint file, starting fresh');
    }
  }

  let failed = 0;

  for (const p of pokemonList) {
    if (results[p.id]) {
      completed++;
      continue;
    }
    completed++;
    const pct = ((completed / pokemonList.length) * 100).toFixed(1);
    process.stdout.write(`[${completed}/${pokemonList.length} ${pct}%] ${p.id} ${p.nameZh}... `);

    try {
      const wikitext = await fetchWikitext(p.nameZh);
      const encounters = parseEncounters(wikitext, p.id);
      results[p.id] = encounters;
      console.log(`${encounters.length} entries`);
    } catch (err) {
      failed++;
      console.log(`FAILED: ${err.message}`);
      results[p.id] = [];
    }

    if (completed % 50 === 0) {
      fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
      console.log(`  [checkpoint saved]`);
    }

    await sleep(DELAY_MS);
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nDone! ${completed} total, ${failed} failed. Saved to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());