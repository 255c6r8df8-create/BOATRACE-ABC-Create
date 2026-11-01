import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { dailyUrl, fetchOfficialHtml, fetchVerifiedPdf, parseDate, parseVenue, publishedResultsFromPayoutList, statusesFromDaily, venuesFromDaily } from '../lib/boatrace.ts';

const root = path.resolve('.'), web = path.join(root, 'public/creator');
const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const inline = id => html.match(new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</script>'))?.[1];
const env = { console, crypto: webcrypto, TextEncoder, TextDecoder, URL, DOMParser: class {}, atob: s => Buffer.from(s, 'base64').toString('binary'), setTimeout, clearTimeout };
env.globalThis = env; env.window = env; vm.createContext(env);
for (const name of ['list-engine', 'candidate-engine', 'workflow-engine', 'source-snapshot', 'source-inspection', 'formation-audit', 'pdf-profile', 'pdf-kiryu', 'pdf-staging']) {
  vm.runInContext(fs.readFileSync(path.join(web, 'vendor', `${name}.js`), 'utf8'), env);
}
vm.runInContext(fs.readFileSync(path.join(web, 'integrated-core.js'), 'utf8'), env);
vm.runInContext(fs.readFileSync(path.join(web, 'c-image-ocr.js'), 'utf8'), env);
const C = env.ABCIntegrated, contract = JSON.parse(inline('template-contract')), design = JSON.parse(inline('design-data'));
env.ABC_INTEGRATED_CONTRACT = contract;
const realm = x => vm.runInContext('JSON.parse(' + JSON.stringify(JSON.stringify(x)) + ')', env);

assert.equal(parseDate('2026-10-28').stamp, '20261028');
const published = publishedResultsFromPayoutList(`<a href="/owpc/pc/race/raceresult?rno=1&amp;jcd=08&amp;hd=20261027">a</a><a href="/owpc/pc/race/raceresult?rno=1&jcd=08&hd=20261027">a</a><a href="https://bad.example/owpc/pc/race/raceresult?rno=2&jcd=08&hd=20261027">x</a><a href="/owpc/pc/race/raceresult?rno=2&jcd=08&hd=20261026">old</a>`, '20261027');
assert.deepEqual(published, [{ venue: '08', race: 1 }]);
assert.throws(() => parseDate('2026-02-30'));
assert.throws(() => parseVenue('25'));
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://example.invalid/' } });
  };
  await assert.rejects(() => fetchOfficialHtml(dailyUrl('20261028')), /転送先/);
} finally { globalThis.fetch = originalFetch; }
try {
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(url);
    return url.includes('raceindex')
      ? new Response('<html>/syussoupdf/2026/pb081028.pdf</html>')
      : new Response('%PDF-' + '0'.repeat(150), { headers: { 'Content-Type': 'application/pdf' } });
  };
  assert.equal((await fetchVerifiedPdf('20261028', '08')).byteLength, 155);
  assert.equal(requested.length, 2);
  globalThis.fetch = async url => url.includes('raceindex')
    ? new Response('<html>unexpected listing</html>')
    : new Response('%PDF-' + '0'.repeat(150));
  await assert.rejects(() => fetchVerifiedPdf('20261028', '08'), /リンク/);
} finally { globalThis.fetch = originalFetch; }
const fixture = `<table>
<tr><td>通常開催</td><td><a href="/owpc/pc/race/raceindex?jcd=01&amp;hd=20261028">桐生</a></td></tr>
<tr><td>6R以降中止順延</td><td><a href="/owpc/pc/race/raceindex?jcd=03&amp;hd=20261028">江戸川</a></td></tr>
<tr><td>運営状況を順延</td><td><a href="/owpc/pc/race/raceindex?jcd=07&amp;hd=20261028">蒲郡</a></td></tr>
</table>`;
const venueCodes = venuesFromDaily(fixture, '20261028');
assert.deepEqual(venueCodes, ['01', '03', '07']);
const statuses = statusesFromDaily(fixture, '20261028', venueCodes);
assert.equal(statuses.find(x => x.venue === '03').cancelledFrom, 6);
assert.equal(statuses.find(x => x.venue === '07').blocked, true);
assert.equal(statuses.find(x => x.venue === '01').blocked, false);
assert.equal(env.ABC_PDF_PROFILE.newVenues()['01'], '桐生');

const temp = path.join(root, '.qa/pdf'); fs.mkdirSync(temp, { recursive: true });
for (const [id, name] of [['pdfLibrary', 'pdf.mjs'], ['pdfWorker', 'worker.mjs'], ['pdfFileAdapter', 'adapter.mjs']]) {
  const encoded = inline(id); assert(encoded, `${id} is present`);
  fs.writeFileSync(path.join(temp, name), Buffer.from(encoded.trim(), 'base64'));
}
globalThis.DOMMatrix = class {}; globalThis.Path2D = class {}; globalThis.ImageData = class {};
const pdf = await import(pathToFileURL(path.join(temp, 'pdf.mjs')).href);
pdf.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(temp, 'worker.mjs')).href;
const reader = await import(pathToFileURL(path.join(temp, 'adapter.mjs')).href);
const bytes = new Uint8Array(fs.readFileSync(path.resolve('../current/evidence/20261027/pb081027.pdf')));
const sha = await C.sha(bytes), pages = await reader.extractPdf(bytes, pdf);
const context = env.ABC_PDF_PROFILE.contextForFile('pb081027.pdf', '2026-10-27');
const candidate = env.ABC_PDF_PROFILE.parse(realm(pages), realm({ date: '2026-10-27', url: context.url, listingUrl: context.listingUrl, sha256: sha }));
const engine = env.ABC_LIST_ENGINE.create(realm(design));
const input = env.ABC_PDF_STAGING.combine(engine, engine.fresh('2026-10-27'), [candidate], realm({ originalChecked: true, columnChecked: true }));
const day = realm({ format: C.FORMAT, ruleVersion: C.RULE, date: '2026-10-27', design, input, members: C.readMembers(realm(pages), candidate.races), selections: {}, source: null, creation: { version: 1, ckVersion: 2, cOriginals: {}, cScreenshots: {}, cStandalone: {} }, originChecked: false, coverageChecked: false });
for (const r of day.input.races) day.selections[C.id(r)] = C.defaults();
const result = C.compute(day), sections = C.sections(realm(contract), day);
assert.equal(day.input.races.length, 12);
assert.equal(Object.values(day.members).flat().length, 72);
assert.deepEqual(JSON.parse(JSON.stringify(result.counts)), { A: 4, B: 1, C: 0 });
assert.equal(sections.length, 26);
assert(result.rows.filter(x => x.group === 'A' && x.color === '🔴').every(x => x.hypothesis.length === 10));
const b = result.rows.find(x => x.group === 'B');
assert.equal(b.hypothesis, null);
const changed = C.updateSelection(day, b.key, realm({ bAxis: b.bOptions[0] }), Date.parse('2026-10-27T00:00:00+09:00'));
assert.equal(C.compute(changed).rows.find(x => x.key === b.key).hypothesis.length, 8);
let excludedVenue = realm(day);
for (const r of excludedVenue.input.races) r.venue = '大村';
for (const r of excludedVenue.input.coverage.expected_races) r.venue = '大村';
excludedVenue.members = Object.fromEntries(Object.entries(excludedVenue.members).map(([k, v]) => [k.replace('常滑|', '大村|'), v]));
excludedVenue.selections = Object.fromEntries(Object.entries(excludedVenue.selections).map(([k, v]) => [k.replace('常滑|', '大村|'), v]));
const image = fs.readFileSync(path.resolve('../current/tests/ck-20261027/synthetic-c8.png')).toString('base64');
excludedVenue = await C.addCScreenshots(excludedVenue, realm([{ name: 'synthetic.png', dataUrl: 'data:image/png;base64,' + image }]));
const imageId = Object.keys(excludedVenue.creation.cScreenshots)[0];
const rates = [20.2, 46, 42.7, 34.8, 33, 37.2];
excludedVenue = C.setCImageOCR(excludedVenue, imageId, realm({ identity: { date: '2026-10-27', venue: '大村', raceNumber: 10 }, rates }));
excludedVenue = C.identifyCScreenshot(excludedVenue, imageId, '2026-10-27', '大村|10', true);
const ranking = C.cScreenshotRanking(realm(rates));
const after = Date.parse('2026-10-28T00:00:00+09:00');
assert.throws(() => C.authorCScreenshot(excludedVenue, '大村|10', imageId, realm(rates), ranking.order, ranking.excluded, '架空画像確認', true, after));
const retrospective = C.authorCScreenshot(excludedVenue, '大村|10', imageId, realm(rates), ranking.order, ranking.excluded, '架空画像確認', true, after, { retrospective: true });
assert.equal(retrospective.creation.cOriginals['大村|10'].afterDeadline, true);
assert.equal(retrospective.creation.cOriginals['大村|10'].createdAt, new Date(after).toISOString());
excludedVenue = C.authorCScreenshot(excludedVenue, '大村|10', imageId, realm(rates), ranking.order, ranking.excluded, '架空画像確認', true, Date.parse('2026-10-27T00:00:00+09:00'));
assert(C.compute(excludedVenue).rows.some(x => x.key === '大村|10' && x.group === 'C' && x.normal.points === 12));
const excludedByUser = realm(excludedVenue); excludedByUser.input.additional_exclusions = ['大村'];
assert(!C.compute(excludedByUser).rows.some(x => x.key === '大村|10'));
excludedVenue.fetchReport = realm({ cancelledRaces: [{ venue: '大村', raceNumber: 10, reason: '10R以降中止' }], failures: [] });
assert(!C.compute(excludedVenue).rows.some(x => x.key === '大村|10'));
day.fetchReport = realm({ cancelledRaces: [{ venue: '常滑', raceNumber: 10, reason: '10R以降中止' }], failures: [] });
assert(!C.compute(day).rows.some(x => x.key === '常滑|10'));
assert.throws(() => C.updateSelection(day, '常滑|10', realm({ aim: '◎' }), Date.parse('2026-10-27T00:00:00+09:00')));
day.fetchReport.failures.push({ venue: '01', message: '未取得' });
assert(C.gate(day, Date.parse('2026-10-27T00:00:00+09:00')).issues.some(x => x.includes('未取得・未解析')));
console.log('PASS: official PDF 12 races / 72 entrants, A/B/C rules, 26 sections, cancellation and incomplete-intake guards');
