(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCFixedBaseModel=api;})(globalThis,function(root){'use strict';
const F=root.ABCFixedBase,fail=m=>{throw Error(m)},clone=v=>JSON.parse(JSON.stringify(v)),key=r=>r.venue+'|'+r.race_number;
const venueCodes='桐生 戸田 江戸川 平和島 多摩川 浜名湖 蒲郡 常滑 津 三国 びわこ 住之江 尼崎 鳴門 丸亀 児島 宮島 徳山 下関 若松 芦屋 福岡 唐津 大村'.split(' ');
function officialURL(date,r){const code=String(venueCodes.indexOf(r.venue)+1).padStart(2,'0');if(code==='00')fail('場名が不正です');return 'https://www.boatrace.jp/owpc/pc/race/racelist?rno='+r.race_number+'&jcd='+code+'&hd='+date.replaceAll('-','');}
function validateProfile(day,r,p){
 const code=String(venueCodes.indexOf(r.venue)+1).padStart(2,'0');
 if(!p||p.schema!==1||p.date!==day.date||p.venue!==code||p.race!==r.race_number||p.source!==officialURL(day.date,r)||!Number.isFinite(Date.parse(p.retrievedAt))||!Array.isArray(p.boats)||p.boats.length!==6)fail('公式出走表の開催日・場・Rが不一致です');
 const members=day.members[key(r)];
 for(let i=0;i<6;i++){const b=p.boats[i];if(b.lane!==i+1||!/^\d{4}$/.test(b.registration)||!b.name||!members?.[i]?.registration_number||members[i].registration_number!==b.registration)fail('出走選手の変更・登録番号不一致を確認してください');}
 if(new Set(p.boats.map(b=>b.registration)).size!==6)fail('登録番号が重複しています');
 const bs=p.boats.map(b=>({boat:b.lane,grade:b.grade,rate:b.nationalTwo,win:b.nationalWin,averageST:b.averageST}));F.boats(bs);return bs;
}
function validateCourse(day,r,c){
 if(!c)return null;const stamp=Date.parse(c.confirmedAt),cutoff=Date.parse(day.date+'T'+r.deadline+':00+09:00');
 if(c.date!==day.date||c.key!==key(r)||c.confirmed!==true||!Number.isFinite(stamp)||stamp>=cutoff||!/^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(String(c.value))||Number(c.value)>100)fail('期別1コース率の値・対象・確認日時が不正です');
 let u;try{u=new URL(c.source)}catch{fail('日和の確認元URLが必要です')}
 if(u.protocol!=='https:'||!['kyoteibiyori.com','www.kyoteibiyori.com'].includes(u.hostname)||u.username||u.password)fail('日和の確認元URLを指定してください');return Number(c.value);
}
function compute(day,supplements={}){
 if(!day||!/^20\d\d-\d\d-\d\d$/.test(day.date)||!Number.isFinite(Date.parse(day.date+'T00:00:00Z'))||new Date(day.date+'T00:00:00Z').toISOString().slice(0,10)!==day.date||day.input?.race_date!==day.date||!Array.isArray(day.input.races)||day.input.races.length>288)fail('固定一覧の日付・入力が不正です');
 const ids=new Set();for(const r of day.input.races){if(r.race_date!==day.date||!venueCodes.includes(r.venue)||!Number.isInteger(r.race_number)||r.race_number<1||r.race_number>12||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.deadline)||ids.has(key(r)))fail('固定一覧の場・R・締切・重複を確認してください');ids.add(key(r));}
 const rows=[],held=[],nonTargets=[],counts=Object.fromEntries(['A','B','C','D','E','K'].map(g=>[g,0]));
 const cancelled=new Set((day.fetchReport?.cancelledRaces||[]).map(x=>x.venue+'|'+x.raceNumber));
 for(const r of day.input.races){
  const k=key(r);if(cancelled.has(k))continue;const s=supplements[k]||{};let bs,course;
  if(!s.official){held.push({key:k,record:r,group:'全体',reason:'公式出走表の全国成績・平均STを未取得'});continue;}
  try{bs=validateProfile(day,r,s.official);course=validateCourse(day,r,s.course);}catch(e){held.push({key:k,record:r,group:'全体',reason:e.message});continue;}
  if(bs.some(b=>b.rate===null)){held.push({key:k,record:r,group:'全体',reason:'公式全国成績の欠損'});continue;}
  const excluded=['徳山','芦屋','大村'].includes(r.venue)||(day.input.additional_exclusions||[]).includes(r.venue),pattern=bs.slice(1,5).map(b=>b.grade[0]).join(''),originalA=!excluded&&['ABAB','BABA'].includes(pattern);
  const fullOrder=F.boats(bs).sort((a,b)=>b.rate100-a.rate100||a.boat-b.boat).map(b=>b.boat),oldTop4=fullOrder.slice(0,4).sort((a,b)=>a-b).join(''),originalB=!excluded&&fullOrder[0]===1&&['1234','1235','1345'].includes(oldTop4),originalC=course===null?null:course<=50&&!(day.input.additional_exclusions||[]).includes(r.venue),sourceCategories=[...(originalA?['元A']:[]),...(originalB?['元B']:[]),...(originalC===true?['元C']:[])];
  const normalA=originalA?root.BOAT_CANDIDATES.createA(bs.map(b=>({lane:b.boat,grade:b.grade,rate:Number(b.rate)})),r.race_number):null;
  const evaluated=[F.evaluateA(bs,{originalA,normalA}),excluded?{status:'not_applicable',reason:'既存の自動抽出除外場'}:F.evaluateB(bs),F.evaluateD(bs,{originalA,periodOneCourseRate:course})];
  const rank=F.layout(bs);
  if(rank.status==='pending')held.push({key:k,record:r,group:'C',reason:(rank.reasons||[]).join('／')});
  if(rank.status==='ready'&&rank.order.indexOf(1)>=4&&F.evaluateC(bs,{originalC:true}).status!=='not_applicable'){
   if(course===null)held.push({key:k,record:r,group:'C',reason:'元Cの入口となる期別1コース率が未確認'});
   else evaluated.push(F.evaluateC(bs,{originalC:originalC===true}));
  }
  const kvals=excluded?[]:F.evaluateKs(bs,{raceNumber:r.race_number});evaluated.push(...kvals);
  // Derive E only from an independently matched, adopted K prototype.
  if(originalA){
   const seeds=kvals.filter(x=>x.status==='eligible');
   for(const seed of seeds)evaluated.push(F.promoteE(bs,seed));
   if(!seeds.length&&F.promoteE(bs,null).status==='pending')held.push({key:k,record:r,group:'E',reason:'近率条件に該当。採用済みK条件から当レースの原型を特定できません'});
  }
  for(const v of evaluated){if(v.status==='eligible'){const same=rows.find(x=>x.key===k&&x.group===v.group&&x.tickets.join('|')===v.tickets.join('|'));if(same)same.patterns=[...new Set([...(same.patterns||[]),...(v.patterns||[])])];else rows.push({...v,key:k,record:clone(r),sourceCategories:[...sourceCategories],sourceClassification:{originalA,originalB,originalC},displayCategory:v.group,betType:({A:'通常A12点',B:'通常B9点',C:'一般形16点',D:'一般形16点',E:'格上げ10点',K:'K型4点'})[v.group],profile:clone(s.official),course:clone(s.course||null)});}else if(v.status==='pending')held.push({key:k,record:r,group:v.group||'判定',reason:(v.reasons||[]).join('／')});}
  if(!rows.some(x=>x.key===k)&&!held.some(x=>x.key===k))nonTargets.push(k);
 }
 for(const g of Object.keys(counts))counts[g]=new Set(rows.filter(x=>x.group===g).map(x=>x.key)).size;
 return {ruleVersion:F.VERSION,date:day.date,rows,held,nonTargets,counts,uniqueRaces:new Set(rows.map(r=>r.key)).size,receivedRaces:day.input.races.length};
}
function validateKSeed(day,r,seed){
 const time=Date.parse(seed.confirmedAt),cutoff=Date.parse(day.date+'T'+r.deadline+':00+09:00');
 if(seed.date!==day.date||seed.key!==key(r)||seed.confirmed!==true||!Number.isFinite(time)||time>=cutoff||!seed.note?.trim())fail('K原型の確認記録が不足しています');
 const b=seed.bet;if(b?.status!=='eligible'||b.group!=='K'||b.points!==4||!Array.isArray(b.forms)||b.forms.length!==1)fail('採用済みK4点の原型が不正です');
 const parts=b.forms[0].split('-').map(p=>[...p].map(Number));
 if(parts.length!==3||parts[0].join('')!=='1'||parts[1].length!==2||parts[2].length!==2||new Set(parts.flat()).size!==5||parts.flat().some(n=>!Number.isInteger(n)||n<1||n>6)||F.expand(parts.length?[parts]:[]).length!==4)fail('Kの2着・3着各2艇を確認してください');
 if(!Array.isArray(b.tickets)||JSON.stringify([...b.tickets].sort())!==JSON.stringify(F.expand([parts]).sort()))fail('Kの原型と4点が一致しません');return seed;
}
function createSnapshot(day,supplements,previous=null,now=Date.now()){
 const model=compute(day,supplements);if(!Number.isFinite(now))fail('保存日時が不正です');
 if(previous){if(previous.date!==day.date||previous.ruleVersion!==F.VERSION)fail('保存版の日付・ルール版が不一致です');
  for(const r of previous.input.races){if(now>=Date.parse(day.date+'T'+r.deadline+':00+09:00')){const next=day.input.races.find(x=>key(x)===key(r));if(JSON.stringify(next)!==JSON.stringify(r)||JSON.stringify(previous.members[key(r)])!==JSON.stringify(day.members[key(r)])||JSON.stringify(previous.supplements[key(r)]||null)!==JSON.stringify(supplements[key(r)]||null)||JSON.stringify(previous.model.rows.filter(x=>x.key===key(r)))!==JSON.stringify(model.rows.filter(x=>x.key===key(r))))fail('締切後の保存済み固定ベース入力は変更できません');}}
 }
 return {format:'BOATRACE_FIXED_BASE_SNAPSHOT_V1',ruleVersion:F.VERSION,date:day.date,savedAt:new Date(now).toISOString(),revision:(previous?.revision||0)+1,input:clone(day.input),members:clone(day.members),fetchReport:clone(day.fetchReport||{}),supplements:clone(supplements),model:clone(model)};
}
function verifySnapshot(s){if(!s||s.format!=='BOATRACE_FIXED_BASE_SNAPSHOT_V1'||s.ruleVersion!==F.VERSION||!/^20\d\d-\d\d-\d\d$/.test(s.date)||s.input?.race_date!==s.date||!Number.isInteger(s.revision)||s.revision<1||!Number.isFinite(Date.parse(s.savedAt)))fail('固定ベース保存形式が不正です');const model=compute({date:s.date,input:s.input,members:s.members,fetchReport:s.fetchReport},s.supplements);if(JSON.stringify(model)!==JSON.stringify(s.model))fail('保存した固定ベース買い目と入力が不一致です');return s;}
return Object.freeze({compute,officialURL,validateProfile,validateCourse,validateKSeed,createSnapshot,verifySnapshot});
});
