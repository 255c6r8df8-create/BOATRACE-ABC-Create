import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseRace, parseResult } from '../lib/boatrace.ts';
import { planResults } from '../lib/result-plan.ts';

const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('public/creator/daily.js', 'utf8'), context);
const D = context.globalThis.ABCDaily;
const tickets = value => D.parsePurchases(value);
assert.throws(() => tickets('1-1-3 100'));
assert.throws(() => tickets('1-2-3 150'));
assert.throws(() => tickets('1-2-3 100\n1-2-3 200'));
assert.equal(D.formatPurchases(tickets('１－２－３ ２００')), '1-2-3 200');
const refreshNow = Date.parse('2026-10-28T12:00:00Z');
assert.equal(D.needsResultRefresh(null, refreshNow), true);
assert.equal(D.needsResultRefresh({ status: 'confirmed', retrievedAt: '2026-10-28T11:56:00Z' }, refreshNow), false);
assert.equal(D.needsResultRefresh({ status: 'confirmed', retrievedAt: '2026-10-28T11:55:00Z' }, refreshNow), true);
assert.equal(D.needsResultRefresh({ status: 'unconfirmed', retrievedAt: '2026-10-28T11:50:00Z' }, refreshNow), false);
assert.equal(D.needsResultRefresh({ status: 'unconfirmed', retrievedAt: '2026-10-28T11:45:00Z' }, refreshNow), true);
const results = {
  a: { status: 'confirmed', order: [3,2,1], payout: 20140, refunds: [] },
  b: { status: 'confirmed', order: [1,3,2], payout: 180, refunds: [4,5,6] },
  c: { status: 'confirmed', order: [1,3,2], payout: 180, refunds: [4,5,6] },
};
const purchases = { a: tickets('3-2-1 100\n1-2-3 200'), b: tickets('1-3-2 100\n1-4-5 200'), c: tickets('1-4-5 500'), pending: tickets('1-2-3 100') };
const s = D.calculate(purchases, results);
assert.equal(s.purchaseRaces, 4);
assert.equal(s.pendingRaces, 1);
assert.equal(s.decidedRaces, 2);
assert.equal(s.hitRaces, 2);
assert.equal(s.spent, 1100);
assert.equal(s.winningPayout, 20320);
assert.equal(s.refund, 700);
assert.equal(s.returned, 21020);
assert.equal(s.balance, 19920);
assert.equal(s.rows.find(x => x.key === 'c').status, '全額返還');
assert.equal(D.calculate({ pending: tickets('1-2-3 100') }, {}).returnRate, null);
assert.throws(() => parseRace('13'));

const span = n => `<span class="numberSet1_number is-type${n}">${n}</span>`;
const fixture = (options = {}) => `<html>
<a href="/owpc/pc/race/resultlist?jcd=08&amp;hd=20261027">結果一覧</a>
<a href="/owpc/pc/race/raceresult?rno=1&amp;jcd=08&amp;hd=20261027">1R</a>
<table><thead><tr><th>着</th><th>枠</th><th>レースタイム</th></tr></thead>
${[3,2,options.wrongFinish ? 4 : 1].map((n,i) => `<tbody><tr><td>${i+1}</td><td>${n}</td><td>1:00</td></tr></tbody>`).join('')}</table>
<table><thead><tr><th>勝式</th><th>払戻金</th></tr></thead><tbody>
<tr><td>3連単</td><td>${[3,2,1].map(span).join('-')}</td><td><span class="is-payout1">&yen;20,140</span></td></tr>
<tr><td></td><td><span class="is-payout1">${options.secondPayout ? '&yen;100' : '&nbsp;'}</span></td></tr>
</tbody></table>
<table><thead><tr><th>返還</th></tr></thead><tbody><tr><td>${(options.refunds || []).map(span).join('')}</td></tr></tbody></table>
</html>`;
assert.deepEqual(parseResult(fixture(), '20261027', '08', 1), { status: 'confirmed', order: [3,2,1], payout: 20140, refunds: [] });
assert.deepEqual(parseResult(fixture({ refunds:[4,5] }), '20261027', '08', 1).refunds, [4,5]);
assert.equal(parseResult(fixture({ wrongFinish:true }), '20261027', '08', 1).status, 'unconfirmed');
assert.equal(parseResult(fixture({ secondPayout:true }), '20261027', '08', 1).status, 'unconfirmed');
assert.equal(parseResult(fixture(), '20261027', '09', 1).status, 'unconfirmed');
const now = Date.parse('2026-10-28T12:00:00Z');
const planned = [1,2,3,4].map(race => ({ date:'2026-10-28', stamp:'20261028', venue:'08', race }));
const old = [
  { ...planned[0], status:'confirmed', retrieved_at:'2026-10-28T11:00:00Z' },
  { ...planned[1], status:'unconfirmed', retrieved_at:'2026-10-28T09:00:00Z' },
  { ...planned[2], status:'confirmed', retrieved_at:'2026-10-27T20:00:00Z' },
];
assert.deepEqual(planResults(planned, old, now).map(x => x.race), [4,2,3]);

// A later saved revision must not erase evidence of an earlier, identical
// pre-deadline prediction; a revision created only afterwards is not evidence.
const fakeNodes = new Map();
const fakeDocument = { getElementById(id) { if (!fakeNodes.has(id)) fakeNodes.set(id, { addEventListener() {} }); return fakeNodes.get(id); } };
const r = { venue: '常滑', race_number: 1, deadline: '10:17' };
const x = { key: '常滑|1', group: 'A', record: r, normalExpression: '3-2-1' };
const day = { date: '2026-10-27', input: { sources: [] } };
const result = { date: day.date, venue: '08', race: 1, source: 'https://www.boatrace.jp/owpc/pc/race/raceresult?rno=1&jcd=08&hd=20261027', retrievedAt: '2026-10-27T03:00:00Z', status: 'confirmed', order: [3,2,1], payout: 20140, refunds: [] };
const stored = JSON.stringify({ version: 1, date: day.date, purchases: {}, purchaseTimes: {}, results: { '常滑|1': result } });
const uiEnv = { document: fakeDocument, localStorage: { getItem: () => stored }, ABCDaily: D, ABC_PDF_PROFILE: { supported: () => ({ '08': '常滑' }) } };
uiEnv.globalThis = uiEnv;
vm.createContext(uiEnv);
vm.runInContext(fs.readFileSync('public/creator/daily-ui.js', 'utf8'), uiEnv);
let records = [
  { date: day.date, sha256: 'early', payload: JSON.stringify({ savedAt: '2026-10-27T00:00:00Z', day: {} }) },
  { date: day.date, sha256: 'late', payload: JSON.stringify({ savedAt: '2026-10-27T04:00:00Z', day: {} }) },
];
let sectionId = 'a';
const C = { id: z => z.venue + '|' + z.race_number, allRaces: () => [r], compute: () => ({ rows: [x] }),
  sections: () => [{ id: sectionId, title: '一覧', columns: ['場・R', '結果', '判定', '公式配当'], rows: [['常滑1R','―','―','―']] }],
  eqBets: (a,b) => a === b, bets: () => ({ bets: ['321'], errors: [] }) };
const view = uiEnv.ABCDailyView.create({ C, contract: {}, getDay: () => day, getComputed: () => ({ rows:[x] }), getArchives: () => records });
view.sync();
assert.equal(view.sections()[0].rows[0][2], '○');
sectionId = 'c'; x.group = 'C';
assert.equal(view.sections()[0].rows[0][2], '○');
records = records.slice(1);
assert.equal(view.sections()[0].rows[0][2], '未固定');
console.log('PASS: actual purchases, daily rates, refunds, conservative official results and pre-deadline history');
