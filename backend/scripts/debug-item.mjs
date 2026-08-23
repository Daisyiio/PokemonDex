import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/superball.html', 'utf-8');
const $ = load(html);

// 找到 "效果" h3 后面的内容
$('h3').each((i, h) => {
  const text = $(h).text().trim();
  if (text.includes('效果')) {
    console.log(`=== ${text} ===`);
    let el = $(h).next();
    while (el.length && !el.is('h3') && !el.is('h2')) {
      const tag = el.prop('tagName');
      if (tag === 'P' || tag === 'TABLE' || tag === 'UL' || tag === 'DL') {
        const t = el.text().replace(/\s+/g, ' ').trim();
        if (t && t.length < 500) console.log(`  [${tag}] ${t}`);
      }
      el = el.next();
    }
    console.log('---');
  }
});

// 找到 "获得方式" h3
$('h3').each((i, h) => {
  const text = $(h).text().trim();
  if (text.includes('获得方式')) {
    console.log(`=== ${text} ===`);
    let el = $(h).next();
    while (el.length && !el.is('h3') && !el.is('h2')) {
      const tag = el.prop('tagName');
      if (tag === 'P' || tag === 'TABLE' || tag === 'UL' || tag === 'DL') {
        const t = el.text().replace(/\s+/g, ' ').trim();
        if (t && t.length < 1200) console.log(`  [${tag}] ${t}`);
        else if (t) console.log(`  [${tag}] (${t.length}字)`);
      }
      el = el.next();
    }
    console.log('---');
  }
});