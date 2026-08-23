import { readFileSync } from 'fs';

const wt = readFileSync('backend/temp/superball.wikitext', 'utf-8');

// 工具：去除 wiki 标记，保留纯文本
function cleanWiki(text) {
  return text
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, (m, p1, p2) => p2 || '')
    .replace(/\{\{[^}]*\}\}/g, (m) => '') // 简单替换整个模板
    .replace(/<[^>]+>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

// 提取命名参数
function parseParams(text) {
  const params = {};
  let current = '';
  // 只处理 | 分隔的参数
  const parts = text.split(/\|(?![^{}]*\}\})/);
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq > 0) {
      const key = p.slice(0, eq).trim();
      const val = p.slice(eq + 1).trim();
      if (key && !params[key]) params[key] = val;
    } else if (p.trim()) {
      current = p.trim();
    }
  }
  return params;
}

// 解析 道具信息框
const infoMatch = wt.match(/\{\{道具信息框\s*\|([\s\S]*?)\n\}\}/);
if (infoMatch) {
  console.log('=== 道具信息框 ===');
  const params = parseParams(infoMatch[1]);
  console.log('袋类别:', cleanWiki(params.bag || ''));
  console.log('袋2:', cleanWiki(params.bag2 || ''));
  console.log('一次性?:', params.once === 'Yes' ? '是' : '否');
  console.log('使用场合代码:', params.occasion); // in = 对战中
  const game = params.game || '';
  console.log('出现世代:', game.split('=').filter((s) => s.includes('y=')).map((s) => s.trim().split('=')[0]).join(', '));
}

// 解析 效果
const effMatch = wt.match(/===效果===\s*\n([\s\S]*?)(?=\n===|\n==|\n\n\n)/);
if (effMatch) {
  const effText = effMatch[1]
    .split('\n')
    .map((l) => l.trim().replace(/^\*+\s*/, ''))
    .filter(Boolean)
    .map(cleanWiki)
    .join('；');
  console.log('\n=== 效果 ===');
  console.log(effText);
}

// 解析 包包信息框(价格)
console.log('\n=== 各版本买入/卖出价 ===');
const pkgPattern = /\{\{包包信息框\|(\d+)\|([^|]+)\|[^|]*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\}\}/g;
let pkgMatch;
while ((pkgMatch = pkgPattern.exec(wt)) !== null) {
  const [_, gen, game, cat, desc, buy, sell] = pkgMatch;
  console.log(`${gen}代 ${game}: 类别=${cleanWiki(cat)} 买入=${buy.trim()} 卖出=${sell.trim()}`);
}

// 解析 获得方式 (道具地点模板)
console.log('\n=== 一次性获得地点 ===');
const locMatch = wt.match(/====一次性获得====\s*\n([\s\S]*?)(?=\n====|\n==|\n\n\n)/);
if (locMatch) {
  const params = parseParams(locMatch[1]);
  for (const [key, val] of Object.entries(params)) {
    if (key === 'bag' || key === 'bag2') continue;
    console.log(`${key}: ${cleanWiki(val)}`);
  }
}

// 解析 重复获得地点
console.log('\n=== 重复获得地点 ===');
const locMatch2 = wt.match(/====重复获得====\s*\n([\s\S]*?)(?=\n====|\n==|\n\n\n)/);
if (locMatch2) {
  const params = parseParams(locMatch2[1]);
  for (const [key, val] of Object.entries(params)) {
    if (key === 'bag' || key === 'bag2') continue;
    console.log(`${key}: ${cleanWiki(val)}`);
  }
}