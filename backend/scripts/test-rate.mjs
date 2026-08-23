// 测试 PokeAPI 是否限流
let ok = 0, fail = 0;
for (let i = 0; i < 5; i++) {
  try {
    const res = await fetch('https://pokeapi.co/api/v2/item/1/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) { ok++; console.log(`请求${i+1}: ${res.status} OK`); }
    else { fail++; console.log(`请求${i+1}: ${res.status} 限流/拒绝 ${res.headers.get('retry-after')?.toString() || ''}`); }
  } catch (e) {
    fail++;
    console.log(`请求${i+1}: 失败 ${e.message?.substring(0, 60)}`);
  }
  await new Promise(r => setTimeout(r, 200));
}
console.log(`结果: OK ${ok}, 失败 ${fail}`);