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


let d=C.createImageDay('2026-10-30',realm(design)), vals=[25,40,40,30,20,20];
d.input.sources.push({id:'src',kind:'official-pdf-list',url:'https://www.boatrace.jp/race'});
d.input.races.push({race_date:d.date,deadline:'23:59',venue:'江戸川',race_number:1,pdf_list_source_id:'src',extraction_confirmed:'確認済み',entrants:vals.map((v,i)=>({boat_number:i+1,grade:'B1',national_win_rate:4,national_top2_rate_percent:v}))});
d.members['江戸川|1']=vals.map((v,i)=>({boat_number:i+1,grade:'B1',national_win_rate:4,national_top2_rate_percent:v,registration_number:String(5000+i),player_name:'選手'}));d.selections['江戸川|1']=C.defaults();
d=realm(d);const now=Date.parse('2026-10-30T09:00:00+09:00');const n=C.authorOfficialC(d,'江戸川|1',realm({n:10,r:50}),now),x=C.compute(n).rows.find(x=>x.group==='C');
assert.equal(x.cOrder,'23415');assert.equal(x.cExcluded,'6');assert.equal(x.normal.tickets.length,12);assert.equal(x.normal.stake,1200);assert.equal(x.cCourseRate,50);assert.equal(x.eligible,true);assert.equal(x.hypothesis,null);
assert.throws(()=>C.authorOfficialC(d,'江戸川|1',realm({n:0,r:0}),now));assert.throws(()=>C.authorOfficialC(d,'江戸川|1',realm({n:10,r:50.1}),now));assert.throws(()=>C.authorOfficialC(d,'江戸川|1',realm({n:10,r:50}),Date.parse('2026-10-31T00:00:00+09:00')));
const changed=C.updateSelection(n,'江戸川|1',realm({cDesignation:'○'}),now);assert.equal(C.compute(changed).rows.find(x=>x.group==='C').hypothesis,null);
console.log('C: boundary, ties, 12 bets, deadline and unconfirmed hypothesis OK');

const lateAt=Date.parse('2026-10-31T00:00:00+09:00');
const late=C.authorOfficialC(d,'江戸川|1',realm({n:10,r:50}),lateAt,realm({retrospective:true}));
assert.equal(C.compute(late).rows.find(r=>r.group==='C').cAfterDeadline,true);
const saved=await C.seal(late,'UNVERIFIED',null,lateAt);const restored=await C.verify(saved);assert.equal(restored.day.creation.cOriginals['江戸川|1'].afterDeadline,true);
console.log('締切後の事後参考を保持し、保存・復元');
const backup={format:'ABC_INTEGRATED_BACKUP_V1',records:[saved]};
assert.equal((await C.parseBackup(realm(backup))).length,1);
const corrupted=JSON.parse(JSON.stringify(backup));corrupted.records[0].payload+='x';
await assert.rejects(()=>C.parseBackup(realm(corrupted)));
console.log('一覧バックアップの整合性確認');
