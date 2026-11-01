(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ABCDaily = api;
})(globalThis, function () {
  'use strict';
  function parsePurchases(input) {
    const lines = String(input).normalize('NFKC').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 120) throw Error('1レースにつき120点以内で入力してください。');
    const seen = new Set();
    return lines.map((line, i) => {
      const m = line.match(/^([1-6])\s*[-ー]\s*([1-6])\s*[-ー]\s*([1-6])\s+([0-9,]+)\s*円?$/);
      if (!m || new Set(m.slice(1, 4)).size !== 3) throw Error((i + 1) + '行目は「1-2-3 100」の形式で、異なる3艇を入力してください。');
      const bet = m.slice(1, 4).join('');
      const amount = Number(m[4].replaceAll(',', ''));
      if (!Number.isSafeInteger(amount) || amount < 100 || amount > 10000000 || amount % 100) throw Error((i + 1) + '行目の金額は100円単位で入力してください。');
      if (seen.has(bet)) throw Error((i + 1) + '行目の買い目が重複しています。同じ買い目の金額を合計して1行にしてください。');
      seen.add(bet);
      return { bet, amount };
    });
  }
  function formatPurchases(tickets) {
    return (tickets || []).map(t => [...t.bet].join('-') + ' ' + t.amount).join('\n');
  }
  function needsResultRefresh(result, now) {
    if (!result) return true;
    const age = now - Date.parse(result.retrievedAt);
    if (!Number.isFinite(age)) return true;
    return age >= (result.status === 'confirmed' ? 5 : 15) * 60_000;
  }
  function calculate(purchases, results) {
    const rows = [];
    for (const [key, tickets] of Object.entries(purchases || {})) {
      if (!tickets.length) continue;
      const result = results?.[key];
      const spent = tickets.reduce((n, t) => n + t.amount, 0);
      if (!result || result.status !== 'confirmed') {
        rows.push({ key, spent, status: '未確定' });
        continue;
      }
      let winningPayout = 0, refund = 0, active = 0, hit = false;
      for (const t of tickets) {
        if ([...t.bet].some(n => result.refunds.includes(Number(n)))) refund += t.amount;
        else {
          active += t.amount;
          if (t.bet === result.order.join('')) { hit = true; winningPayout += t.amount / 100 * result.payout; }
        }
      }
      const returned = winningPayout + refund;
      if (![spent, winningPayout, refund, returned].every(Number.isSafeInteger)) throw Error('集計額が大きすぎます。');
      rows.push({ key, status: active ? (hit ? '的中' : '不的中') : '全額返還', spent, active, hit, winningPayout, refund, returned, balance: returned - spent });
    }
    const confirmed = rows.filter(r => r.status !== '未確定');
    const decided = confirmed.filter(r => r.active > 0);
    const sum = field => confirmed.reduce((n, r) => n + r[field], 0);
    const spent = sum('spent'), returned = sum('returned');
    return { rows, purchaseRaces: rows.length, pendingRaces: rows.length - confirmed.length, confirmedRaces: confirmed.length,
      decidedRaces: decided.length, hitRaces: decided.filter(r => r.hit).length,
      hitRate: decided.length ? decided.filter(r => r.hit).length / decided.length * 100 : null,
      spent, winningPayout: sum('winningPayout'), refund: sum('refund'), returned,
      returnRate: spent ? returned / spent * 100 : null, balance: returned - spent };
  }
  return { parsePurchases, formatPurchases, needsResultRefresh, calculate };
});
