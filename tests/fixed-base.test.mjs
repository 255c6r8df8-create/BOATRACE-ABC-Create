import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const env={};env.globalThis=env;vm.createContext(env);vm.runInContext(fs.readFileSync('public/creator/fixed-base.js','utf8'),env);const F=env.ABCFixedBase;
const make=(order,grades={})=>{const rates={};[...order].forEach((n,i)=>rates[n]=60-i*8);return [1,2,3,4,5,6].map(boat=>({boat,grade:grades[boat]||'B1',rate:rates[boat],win:'4.50',averageST:'0.20'}));};
const native=x=>JSON.parse(JSON.stringify(x));
for(const order of ['124356','134256','135246']){const b=F.evaluateB(make(order));assert.equal(b.points,9);assert.ok(b.tickets.every(t=>t.startsWith('1-')));assert.equal(new Set(b.tickets).size,9);}
assert.equal(F.evaluateB(make('132456')).status,'not_applicable');
const d=F.evaluateD(make('256314'),{originalA:true,periodOneCourseRate:65});assert.equal(d.axis,2);assert.deepEqual(native(d.forms),['253-253-53','251-251-51','263-263-63','261-261-61']);assert.equal(d.points,16);
assert.equal(F.evaluateD(make('256314'),{originalA:true,periodOneCourseRate:65.01}).status,'not_applicable');
assert.equal(F.evaluateD(make('256314',{1:'A2'}),{originalA:true,periodOneCourseRate:70}).points,16);
assert.equal(F.evaluateD(make('256314'),{originalA:true}).status,'pending');
const c=make('253614',{2:'A2',5:'A1'});c[0].averageST='0.20';c[1].averageST='0.15';c[4].averageST='0.17';const both=F.evaluateC(c,{originalC:true});assert.equal(both.axis,2);assert.equal(both.points,16);assert.equal(both.patterns.length,2);
c[1].averageST='0.16';assert.equal(F.evaluateC(c,{originalC:true}).axis,5);
c[4].averageST='0.18';assert.equal(F.evaluateC(c,{originalC:true}).status,'not_applicable');
c[1].averageST=null;c[4].averageST='0.17';assert.equal(F.evaluateC(c,{originalC:true}).status,'pending');
c[1].averageST='0.15';c[4].averageST=null;assert.equal(F.evaluateC(c,{originalC:true}).axis,2);
assert.equal(F.evaluateC(c,{originalC:false}).status,'not_applicable');
assert.equal(F.evaluateC(make('125634',{2:'A2',5:'A1'}),{originalC:true}).status,'not_applicable');
const swapped=F.layout(make('625314'));assert.equal(swapped.swapped,true);assert.deepEqual(native(swapped.left),[1,2,5]);assert.deepEqual(native(swapped.right),[3,6]);assert.equal(F.evaluateD(make('625314'),{originalA:true,periodOneCourseRate:0}).axis,2);
let invariantCases=0;function perm(a){return a.length?a.flatMap((n,i)=>perm(a.filter((_,j)=>j!==i)).map(rest=>[n,...rest])):[[]];}
for(const order of perm([1,2,3,4,5,6])){const bs=make(order.join('')),l=F.layout(bs);assert.equal(new Set([...l.left,...l.right,l.excluded]).size,6);for(const axis of l.left.filter(b=>b!==6)){const v=F.general16(bs,axis,l);assert.equal(v.points,16);assert.equal(new Set(v.tickets).size,16);for(const t of v.tickets){const n=t.split('-').map(Number);assert.equal(new Set(n).size,3);assert.ok(n.slice(0,2).includes(axis));assert.equal(n.filter(b=>l.right.includes(b)).length,1);assert.ok(!n.includes(l.excluded));}invariantCases++;}}
const pair=make('123456');pair[1].win='4.50';pair[5].win='4.49';assert.equal(F.keepPair(pair,2,6).boat,2);pair[1].win='4.49';pair[5].win='4.50';assert.equal(F.keepPair(pair,2,6).boat,6);pair[1].win='4.50';assert.equal(F.keepPair(pair,2,6).boat,2);
console.log('固定B/C/D：並び・D提示例・ST閾値ちょうど・②優先・欠損・⑥交換・勝率4.50境界OK。全720順位、'+invariantCases+'軸構成で16点不変条件OK');
const a=make('132456',{1:'A2',3:'A1',5:'A2'}),normalA={first:'13',second:'1235',third:'1235',color:'🔴'};
assert.equal(F.evaluateA(a,{originalA:true,normalA}).points,12);assert.equal(F.evaluateA(a,{originalA:true,normalA}).patterns.length,2);
assert.equal(F.evaluateA(a,{originalA:true,normalA:{...normalA,color:'🔵'}}).status,'not_applicable');assert.equal(F.evaluateA(a,{originalA:true}).status,'pending');
const kboats=make('153246'),k=F.evaluateK(kboats);assert.equal(k.points,4);assert.deepEqual(native(k.forms),['1-34-52']);assert.equal(k.patterns.length,2);assert.equal(F.evaluateB(kboats).status,'not_applicable');
const eb=make('153246');eb[0].rate='60';eb[1].rate='50';eb[2].rate='40';assert.equal(F.promoteE(eb,k).status,'not_applicable');eb[1].rate='50.01';assert.equal(F.promoteE(eb,k).points,10);assert.equal(F.promoteE(eb,null).status,'pending');
eb[1].rate='40';eb[2].rate='50.01';assert.equal(F.promoteE(eb,k).points,10);eb[1].grade='A2';assert.equal(F.promoteE(eb,k).status,'not_applicable');
console.log('A採用2パターンの重複保持・K独立4点と通常B分離・E10点と率差10未満の境界OK');
const adopted=[];
function collect(bs,raceNumber=1){const values=F.evaluateLegacyKs(bs,{raceNumber});for(const v of values){assert.equal(v.points,4);assert.equal(new Set(v.tickets).size,4);adopted.push(...v.patterns);}return values;}
collect(make('153246'));
collect(make('123456',{2:'B1'}));
const del2=make('143256',{1:'B1'});collect(del2);
const del3=make('134256',{4:'A2'});del3[2].rate=50;collect(del3);
const gap3=make('132456');gap3[2].rate=50;gap3[3].rate=45;collect(gap3);
collect(make('123456',{3:'B2'}));
assert.ok(!collect(make('123456',{4:'B2'}),6).some(v=>v.patterns.includes('B5-03')));collect(make('123456',{4:'B2'}),7);
const b54=make('123456',{3:'B1'});b54[4].rate=40;collect(b54);
assert.deepEqual([...new Set(adopted)].sort(),['B-K-002','B-K-003','B-DEL2-01','B-DEL2-02','B-DEL3-01','B-DEL3-02','B5-02','B5-03','B5-04'].sort());
assert.ok(!adopted.includes('B5-01'));
const noBone=F.evaluateLegacyKs(make('123456',{3:'B2'}),{raceNumber:1}).find(x=>x.patterns.includes('B5-02'));const ebone=make('123456');ebone[1].rate=20;ebone[2].rate=55;assert.equal(F.promoteE(ebone,noBone).status,'not_applicable');
console.log('K採用9パターンを個別検証（削除済みA級5人を復活させず）。13型の③④骨格も検証OK');
assert.equal(F.evaluateB(make('124536')).points,9);assert.equal(F.evaluateKs(make('124536'),{raceNumber:1}).length,0);
console.log('現行Bに旧上位4艇入口を追加しないことを検証OK');
