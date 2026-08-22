import { readFileSync } from 'fs';
import { load } from 'cheerio';

const html = readFileSync('backend/temp/pages/拍击.html', 'utf-8');
const $ = load(html);

// Check if $('li') finds any elements
const lis = $('li');
console.log('li count:', lis.length);

// Test the exact flags parsing from the re-parse script
const flagSet = new Set();
$('li').each((_, el) => {
  const text = $(el).text().trim();
  if (text.includes('接触类')) flagSet.add('接触类招式');
  if (text.includes('受守住影响')) flagSet.add('受守住影响');
  if (text.includes('魔法反射')) flagSet.add('不受魔法反射影响');
  if (text.includes('不可以被抢夺')) flagSet.add('不可以被抢夺');
  if (text.includes('鹦鹉学舌')) flagSet.add('受鹦鹉学舌影响');
  if (text.includes('王者之证')) flagSet.add('受王者之证影响');
});
console.log('flags found:', [...flagSet]);