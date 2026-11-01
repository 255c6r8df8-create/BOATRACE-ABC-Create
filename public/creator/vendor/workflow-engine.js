/* BOAT RACE workflow v1.1 — deterministic offline logic, NOT a live official feed.
 * It does not write or reinterpret frozen historical race predictions.
 * Contract: 2026-10-20 user's 3-category A/B/C compressed rules.
 * Historical 26-section v2.9 variants MUST NOT be replaced by these formulas.
 */
(function(root, factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BOAT_WORKFLOW=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const STATES=Object.freeze({pending:'未確認',hit:'○',miss:'×',refund:'返還'});
const GROUPS=['A','B','C']; const PRIORITY={A:1,B:2,C:3};
const isLane=v=>Number.isInteger(v)&&v>=1&&v<=6;
const asLane=v=>{let n=Number(v);if(!isLane(n))throw Error('艇番は1〜6の整数です');return n;};
function exactPermutation(xs, n){
 const a=xs.map(asLane);if(new Set(a).size!==a.length)throw Error('同一艇を重複指定できません');
 if(n!==undefined&&a.length!==n)throw Error(`${n}艇を指定してください`);return a;
}
function triples(first,second,third){
 const a=exactPermutation(first),b=exactPermutation(second),c=exactPermutation(third),tickets=[];
 for(const i of a)for(const j of b)for(const k of c)if(i!==j&&i!==k&&j!==k)tickets.push(`${i}-${j}-${k}`);
 if(new Set(tickets).size!==tickets.length)throw Error('重複買い目が含まれます');return tickets;
}
function format(tickets){return tickets.map(x=>x.replaceAll('-','')).join(' / ');}
function validateRateTable(rows){
 if(!Array.isArray(rows)||rows.length!==6)throw Error('6艇の全国2連対率が必要です');
 return rows.map((item,idx)=>{
  const lane=idx+1;const rate=item?.rate;
  if(rate===null||rate===undefined||rate==='')throw Error(`${lane}号艇の全国2連対率が未確認`);
  let v=Number(rate);if(!Number.isFinite(v)||v<0||v>100)throw Error(`${lane}号艇の全国2連対率が不正`);
  return {lane,rate:v};
 });
}
function rank(rows){return rows.slice().sort((a,b)=>b.rate-a.rate||a.lane-b.lane);}
function hypothesisA(redBet,entries){
 if(!redBet||redBet.color!=='🔴'||!Array.isArray(redBet.tickets)||redBet.tickets.length!==12)throw Error('A🔴の通常12点買い目が必要です');
 const rows=validateRateTable(entries),lanes=exactPermutation([...new Set(redBet.second.split('').map(Number))],4);
 if(!lanes.includes(1)||!redBet.first.includes('1'))throw Error('A🔴には①が必要です');
 const others=rank(rows.filter(e=>lanes.includes(e.lane)&&e.lane!==1)).map(e=>e.lane);
 const front=triples([1],others,others); // 6
 const back=triples(others.slice(0,2),[1],others); // 4
 const tickets=[...front,...back];if(tickets.length!==10)throw Error('A🔴10点の構成に失敗しました');
 return {eligible:true,kind:'A🔴10点仮説',expression:`1－${others.join('')}－${others.join('')} ＋ ${others.slice(0,2).join('')}－1－${others.join('')}`,tickets,points:10,stake:1000,notes:'10/20現在ルール（過去日再生成禁止）'};
}
function hypothesisB(greenBet){
 if(!greenBet||greenBet.color!=='🟢'||!Array.isArray(greenBet.tickets)||greenBet.tickets.length!==9||greenBet.first!=='1')throw Error('B🟢の通常9点買い目が必要です');
 const partners=exactPermutation(greenBet.second.split('').map(Number),3);
 if(partners.includes(1))throw Error('Bの2列目に①は含めません');
 const tickets=triples([1],partners,partners);if(tickets.length!==6)throw Error('B🟢6点の構成に失敗しました');
 return {eligible:true,kind:'B🟢6点仮説',expression:`1－${partners.join('')}－${partners.join('')}`,tickets,points:6,stake:600,notes:'10/20現在ルール（過去日再生成禁止）'};
}
function confirmedC({userConfirmedC, rateOrder,excluded,push=null}){
 if(userConfirmedC!==true)throw Error('Cはユーザーが明示確認したレースだけ処理します');
 // Missing values must remain missing; never infer from national rates or B rejection.
 if(!Array.isArray(rateOrder)||rateOrder.length!==6||excluded===null||excluded===undefined||excluded==='')
  return {status:'awaiting_user_data',category:'C',bet:null,reason:'2連対率順・除外が未指定。Cとして保持し、買い目は未作成'};
 const order=exactPermutation(rateOrder,6);const omit=asLane(excluded);
 if(!order.includes(omit))throw Error('除外艇が順位にありません');
 const kept=order.filter(x=>x!==omit);
 if(kept.length!==5)throw Error('除外後5艇になりません');
 const tickets=triples([kept[0]],kept.slice(1),kept.slice(1));
 if(tickets.length!==12)throw Error('C通常12点の構成に失敗しました');
 return {status:'user_confirmed',category:'C',userRateOrder:order,excluded:omit,push,bet:{first:String(kept[0]),second:kept.slice(1).join(''),third:kept.slice(1).join(''),marked:kept[3],tickets,points:12,stake:1200},notes:'保存済み順序を使用。公式分析順位と分離し、再判定しません'};
}
function key(row){if(!row||!/^20\d{2}-\d{2}-\d{2}$/.test(String(row.date||''))||!row.venue||!Number.isInteger(Number(row.round))||Number(row.round)<1||Number(row.round)>12)throw Error('日付・場・Rの形式が不正');return `${row.date}|${row.venue}|${Number(row.round)}`;}
function reconcile(input){
 if(!Array.isArray(input))throw Error('一覧が配列ではありません');
 const groups=new Map();for(const item of input){if(!GROUPS.includes(item.category))throw Error('A/B/C以外のカテゴリ');const id=key(item);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(item);}
 const kept=[],removed=[],conflicts=[];
 for(const [id,items] of groups){
  if(new Set(items.map(x=>x.category)).size!==items.length)throw Error(`同一区分の二重登録：${id}`);
  const arranged=items.slice().sort((a,b)=>PRIORITY[b.category]-PRIORITY[a.category]);const winner=arranged[0];
  kept.push(winner);if(arranged.length>1){const subs=arranged.slice(1);removed.push(...subs);conflicts.push({key:id,categories:arranged.map(x=>x.category),winner:winner.category,removed:subs.map(x=>x.category)});}
 }
 return {kept,removed,conflicts,count:{A:kept.filter(x=>x.category==='A').length,B:kept.filter(x=>x.category==='B').length,C:kept.filter(x=>x.category==='C').length},excludedHypothesisKeys:removed.map(key)};
}
function buildFrozen(races){
 if(!Array.isArray(races))throw Error('予想配列が必要');
 const locked=races.map(r=>({id:key(r),category:r.category,bet:r.bet??null,aim:r.aim??null,push:r.push??null,color:r.color??null,marked:r.marked??null,normal:r.normal??null,hypothesis:r.hypothesis??null,designation:r.designation??null,rateOrder:r.rateOrder??null,excluded:r.excluded??null}));
 const canonical=JSON.stringify(locked);return {canonical,lockedCount:locked.length,day:locked.length?locked[0].id.split('|')[0]:null};
}
function verifyFrozen(snapshot,races){return !!snapshot&&snapshot.canonical===buildFrozen(races).canonical;}
function checkOutcomeResult(x){return x&&x.kind==='normal'&&/^[1-6]-[1-6]-[1-6]$/.test(x.ticket||'')&&new Set(x.ticket.split('-')).size===3&&Number.isInteger(x.dividend)&&x.dividend>=0&&x.sourceType==='manual_unverified';}
// This is only for offline simulation on manually entered, unverified results.
// Formal results require an independent evidence check and are intentionally blocked here.
function simulateDay(lockedRaces,results,betField='bet'){
 const counters=Object.fromEntries(GROUPS.map(c=>[c,{races:0,decided:0,hits:0,investment:0,payout:0,excludedRefunds:0}]));
 for(const row of lockedRaces){
  if(!GROUPS.includes(row.category))throw Error('区分不明');const c=counters[row.category];c.races++;
  const result=results[key(row)];if(!result)continue;
  if(result.kind==='refund'){c.excludedRefunds++;c.races--;continue;}
  if(!checkOutcomeResult(result))throw Error('正式扱い不可：未照合の結果形式が不正');
  const b=row[betField];if(!b||!Array.isArray(b.tickets)||!b.tickets.length)continue;
  c.decided++;
  const betCost=b.stake??b.tickets.length*100;
  if(betCost!==b.tickets.length*100)throw Error('参考集計は100円固定の買い目だけに対応');
  c.investment+=betCost;if(b.tickets.includes(result.ticket)){c.hits++;c.payout+=result.dividend;}
 }
 const stats={};for(const [g,c] of Object.entries(counters))stats[g]={...c,hitRate:c.decided?c.hits/c.decided*100:null,returnRate:c.investment?c.payout/c.investment*100:null,profit:c.payout-c.investment};
 return {source:'simulation_only__not_official',statistics:stats};
}
return Object.freeze({STATES,triples,hypothesisA,hypothesisB,confirmedC,reconcile,key,buildFrozen,verifyFrozen,simulateDay});
});
