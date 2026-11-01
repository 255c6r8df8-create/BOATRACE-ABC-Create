/* BOAT RACE candidate verifier v1, pure logic. No live source retrieval.
 * C is only asserted by the user; it is NEVER inferred from a failed B check.
 * Existing locked predictions are never written by this engine.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BOAT_CANDIDATES=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VENUES=['桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江','尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村'];
const EXCLUDED=new Set(['徳山','芦屋','大村']);
const A_SET=new Set(['A1','A2']); const B_SET=new Set(['B1','B2']);
const PATTERNS=[['B','B','A','B','A'],['B','A','B','A','B']];
const MIDDLE=[['B','A','B','A'],['A','B','A','B']];
const BSETS=['1234','1235','1345'];
const rank=e=>e.slice().sort((a,b)=>b.rate-a.rate||a.lane-b.lane);
const digits=xs=>xs.map(v=>v.lane).join('');
function ticketSet(first,all){const out=[];for(const x of first)for(const y of all)for(const z of all){if(x.lane!==y.lane&&x.lane!==z.lane&&y.lane!==z.lane)out.push([x.lane,y.lane,z.lane].join('-'));}return out;}
function createA(entries,round){
 const e=entries;let removed;
 if(A_SET.has(e[4].grade)&&A_SET.has(e[5].grade))removed=e[5];
 else removed=rank([e[4],e[5]])[1];
 const available=e.filter(x=>x.lane!==removed.lane);
 const first=rank(e.slice(0,4)).slice(0,2);
 const remaining=rank(available.filter(x=>!first.some(y=>y.lane===x.lane))).slice(0,2);
 const all=rank(first.concat(remaining));
 const tickets=ticketSet(first,all);
 if(tickets.length!==12||new Set(tickets).size!==12)throw Error('A点数異常');
 return {first:digits(first),second:digits(all),third:digits(all),excluded:removed.lane,marked:rank(all).filter(v=>v.rate===rank(all)[0].rate).map(v=>v.lane),color:first.some(v=>v.lane===1)?'🔴':round<=6?'🔵':'🟢',tickets,points:12,stake:1200};
}
function createB(e,round){const best=rank(e),first=best[0],top4=best.slice(0,4),partners=top4.filter(x=>x.lane!==1);
 const extra=best.find(x=>!top4.some(y=>y.lane===x.lane));
 const all=partners.concat(extra).sort((a,b)=>a.lane-b.lane);
 const tickets=ticketSet([first],all).filter(t=>partners.some(p=>p.lane===Number(t.split('-')[1])));
 if(tickets.length!==9||new Set(tickets).size!==9)throw Error('B点数異常');
 const last=rank(partners).at(-1);
 return {first:'1',second:partners.map(x=>x.lane).join(''),third:digits(all),marked:[last.lane],excluded:best.at(-1).lane,color:round<=6?'🔵':'🟢',tickets,points:9,stake:900};
}
function evaluate(row){
 const errors=[];if(!row||typeof row!=='object')throw Error('レースデータが必要です');
 if(!/^20\d\d-\d\d-\d\d$/.test(String(row.date||''))||Number.isNaN(Date.parse(String(row.date||'')+'T00:00:00Z')))errors.push('対象日が不正です');
 if(!VENUES.includes(row.venue))errors.push('24場から選択してください');
 const round=Number(row.round);if(!Number.isInteger(round)||round<1||round>12)errors.push('Rは1〜12です');
 if(!Array.isArray(row.entries)||row.entries.length!==6)errors.push('出走艇は6艇必要です');
 const cConfirmed=row.userConfirmedC===true;
 if(errors.length)return {status:'error',errors,source:'手入力・公式未照合'};
 if(EXCLUDED.has(row.venue)&&!cConfirmed)return {status:'excluded',category:null,errors:[],message:'常時除外場。自動抽出しません',source:'手入力・公式未照合'};
 const entries=[];
 for(let i=0;i<6;i++){
  const entry=row.entries[i]||{};
  const grade=String(entry.grade??'').trim().toUpperCase();
  const raw=entry.rate;
  const rate=(raw===''||raw===null||raw===undefined)?null:Number(raw);
  if(![...A_SET,...B_SET].includes(grade))errors.push(`${i+1}号艇の級別が未確認`);
  if(rate===null||!Number.isFinite(rate)||rate<0||rate>100)errors.push(`${i+1}号艇の全国2連対率が未確認`);
  entries.push({lane:i+1,grade,rate});
 }
 if(cConfirmed){return {status:'user_confirmed_C',category:'C',errors,source:'ユーザー確認済みC',message:'確認済みCとして保持。公式照合・C買い目の再判定や自動作成は行いません',bet:null};}
 if(errors.length)return {status:'pending',category:null,errors,source:'手入力・公式未照合',message:'必要数値が足りないため判定しません'};
 const symbols=entries.map(x=>A_SET.has(x.grade)?'A':'B');
 const isA=PATTERNS.some(x=>x.every((s,i)=>symbols[i]===s))||MIDDLE.some(x=>x.every((s,i)=>symbols[i+1]===s));
 const sorted=rank(entries),top4=sorted.slice(0,4).map(x=>x.lane).sort((a,b)=>a-b).join('');
 const isB=sorted[0].lane===1&&BSETS.includes(top4);
 const category=isB?'B':isA?'A':null;
 return {status:category?'candidate':'not_applicable',category,isA,isB,priority:'C＞B＞A',top4,source:'手入力・公式未照合',message:category?`${category}候補。公式の6艇数値と当日全レース検査が済むまでは正式確定できません`:'A/B条件に不該当。Cへ自動移行しません',bet:category==='A'?createA(entries,round):category==='B'?createB(entries,round):null};
}
return Object.freeze({VENUES,EXCLUDED:[...EXCLUDED],evaluate});
});
