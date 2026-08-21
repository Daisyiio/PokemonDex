const fs = require('fs');
const path = require('path');

const ENCOUNTERS_FILE = path.join(__dirname, '..', 'data', 'encounters.json');

const GAME_NAMES = {
  R: '红', G: '绿', B: '蓝', Y: '黄',
  RG: '红/绿', RB: '红/蓝', RGB: '红/绿/蓝',
  GS: '金/银', GSC: '金/银/水晶',
  RSE: '红宝石/蓝宝石/绿宝石', RS: '红宝石/蓝宝石', E: '绿宝石',
  FRLG: '火红/叶绿',
  DP: '钻石/珍珠', DPPt: '钻石/珍珠/白金', Pt: '白金',
  PPt: '钻石/珍珠/白金',
  HGSS: '心金/魂银',
  BW: '黑/白', W: '白', B2W2: '黑2/白2',
  XY: 'X/Y',
  ORAS: '欧米伽红宝石/阿尔法蓝宝石',
  SM: '太阳/月亮',
  USUM: '究极之日/究极之月', MUM: '究极之日', SUS: '究极之月',
  LPLE: '皮卡丘/伊布',
  SWSH: '剑/盾', SW: '剑', SH: '盾',
  SWSHE: '剑/盾DLC', SwShE: '剑/盾DLC',
  BDSP: '晶灿钻石/明亮珍珠',
  LA: '传说 阿尔宙斯',
  SV: '朱/紫', S: '朱', V: '紫',
  SVT: '朱/紫DLC',
  ZA: '传说 Z-A', ZAM: '传说 Z-A DLC',
};

const encounters = JSON.parse(fs.readFileSync(ENCOUNTERS_FILE, 'utf8'));

let stats = { extra: 0, event: 0, empty: 0, gameName: 0 };

function cleanField(text) {
  if (!text) return text;
  let t = text;
  // Remove extra= and everything after it
  t = t.replace(/[,、，]\s*extra=.*/g, '');
  t = t.replace(/extra=.*/g, '');
  // Remove row3=... and similar leftover params
  t = t.replace(/[,、，]\s*row\d+=.*/g, '');
  // Remove event from location (it's a method)
  t = t.replace(/^event$/g, '');
  t = t.replace(/[,、，]\s*event\b/g, '');
  // Clean stray punctuation
  t = t.replace(/^[,、，]+|[,、，]+$/g, '');
  t = t.replace(/、{2,}/g, '、');
  t = t.replace(/，{2,}/g, '，');
  return t.trim();
}

for (const [id, entries] of Object.entries(encounters)) {
  for (const e of entries) {
    // Add gameName
    if (!e.gameName) {
      e.gameName = GAME_NAMES[e.game] || e.game;
      stats.gameName++;
    }

    // Clean extra= from location and note
    const oldLoc = e.location || '';
    const oldNote = e.note || '';
    e.location = cleanField(e.location);
    e.note = cleanField(e.note);
    if (oldLoc !== e.location) stats.extra++;
    if (oldNote !== e.note) stats.extra++;

    // Move event to method if method is empty
    if (e.location === 'event' || e.location === 'Event') {
      if (!e.method) e.method = '事件赠送';
      e.location = '';
      stats.event++;
    }
    if (e.note === 'event' || e.note === 'Event') {
      if (!e.method) e.method = '事件赠送';
      e.note = '';
      stats.event++;
    }

    // If location is now empty but note has content, swap
    if (!e.location && e.note) {
      // Check if note looks like a location (contains common location keywords)
      if (/道路|森林|洞穴|海滩|城市|市|山|海|塔|遗迹|公园/.test(e.note)) {
        e.location = e.note;
        e.note = '';
      }
    }

    // Remove entries where everything is empty (no useful data)
    if (!e.location && !e.method && !e.note) {
      stats.empty++;
    }
  }
}

fs.writeFileSync(ENCOUNTERS_FILE, JSON.stringify(encounters, null, 2), 'utf8');
console.log(`Done! Removed extra=${stats.extra}, event=${stats.event}, added gameName=${stats.gameName}, empty entries=${stats.empty}`);
