
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABC_LIST_ENGINE=api;})(globalThis,function(){'use strict';
const canon=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canon(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canon(x[k]))])):x);
const copy=x=>JSON.parse(canon(x)),fail=x=>{throw Error(x)};
const VENUES='桐生 戸田 江戸川 平和島 多摩川 浜名湖 蒲郡 常滑 津 三国 びわこ 住之江 尼崎 鳴門 丸亀 児島 宮島 徳山 下関 若松 芦屋 福岡 唐津 大村'.split(' ');
const PREFIX='boat-abc-list-maker-L1:';
const key=r=>r.venue+'|'+r.race_number;
function cleanJson(x,depth=0){if(depth>20)fail('データの階層が深すぎます');if(x===null||typeof x==='boolean')return;if(typeof x==='string'){if(x.length>20000)fail('文字列が長すぎます');return;}if(typeof x==='number'&&Number.isFinite(x))return;if(Array.isArray(x)){if(x.length>1000)fail('データ件数上限');x.forEach(v=>cleanJson(v,depth+1));return;}if(x&&Object.getPrototypeOf(x)===Object.prototype){for(const[k,v]of Object.entries(x)){if(['__proto__','prototype','constructor'].includes(k))fail('不正なデータキー');cleanJson(v,depth+1);}return;}fail('JSON形式が不正です');}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('日付が不正です');return v;}
function ident(v){if(!VENUES.includes(v.venue)||!Number.isInteger(v.race_number)||v.race_number<1||v.race_number>12)fail('場・Rが不正です');return key(v);}
function unique(rows,fn,label,merger=null){const m=new Map();for(const r of rows){const k=fn(r);if(m.has(k)&&canon(m.get(k))!==canon(r)){if(!merger)fail(label+'の同一IDが競合しています');m.set(k,merger(m.get(k),r));}else m.set(k,copy(r));}return [...m.values()];}
function mergeRace(a,b){if(key(a)!==key(b)||a.race_date!==b.race_date)fail('出走原本の識別が競合');const pick=(x,y)=>{if(x===null)return y;if(y===null||canon(x)===canon(y))return x;fail('既知の出走原本は上書きできません（競合）');};const r=copy(a);r.deadline=pick(a.deadline,b.deadline);r.pdf_list_source_id=pick(a.pdf_list_source_id,b.pdf_list_source_id);r.entrants=a.entrants.map((x,i)=>Object.fromEntries(Object.keys(x).map(k=>[k,pick(x[k],b.entrants[i][k])])));r.extraction_confirmed=a.extraction_confirmed==='確認済み'||b.extraction_confirmed==='確認済み'?'確認済み':'未確認';if(a.extraction_confirmed==='確認済み'&&canon(r)!==canon(a))fail('確認済み出走原本は変更できません');return r;}
function create(design){
 if(design.version!=='research-v2.0-2026-10-23'||design.extraction.A!=='固定の旧A〜Dを現在Aに統合。2〜5号艇のB-A-B-AまたはA-B-A-B。'||design.extraction.B!=='1号艇全国2連対率が6艇中1位（同率内側優先）、2連対率上位4艇が1234/1235/1345のいずれか。'||design.extraction.C!=='ユーザー指定の確定済みCのみ。再判定・再抽出しない。'||design.extraction.deduplication!=='C>B>A'||canon(design.extraction.normal_exclusion_venues)!==canon(['徳山','芦屋','大村'])||canon(design.color)!==canon({A_red:'1号艇が1〜4号艇の全国2連対率上位2艇に入る（同率は内側優先）',A_blue:'Aの🔴以外で1〜6R',A_green:'Aの🔴以外で7〜12R',B_blue:'1〜6R',B_green:'7〜12R',C:'なし'}))fail('未対応の設計定義です。独自に読み替えず停止しました');
 function fresh(day){date(day);if(day<design.start_date)fail('過去の未監査データは取り込みません。10月23日は原本閲覧のみです');return {format:'ABC_CONFIRMED_INPUT_V1',race_date:day,sources:[],races:[],confirmed_c:[],additional_exclusions:[],coverage:{complete:false,expected_races:[]}};}
 function validate(input){cleanJson(input);const d=copy(input);fresh(d.race_date);if(d.format!=='ABC_CONFIRMED_INPUT_V1'||!['sources','races','confirmed_c','additional_exclusions'].every(k=>Array.isArray(d[k]))||!d.coverage||typeof d.coverage.complete!=='boolean'||!Array.isArray(d.coverage.expected_races))fail('一覧入力形式が不正です');
  const rootFields=['format','race_date','sources','races','confirmed_c','additional_exclusions','coverage'];if(Object.keys(d).some(k=>!rootFields.includes(k)))fail('一覧以外のデータ項目は取り込みません');
  if(d.races.length>288||d.sources.length>64||d.confirmed_c.length>288)fail('日別件数上限');
  for(const s of d.sources){let u;try{u=new URL(s.url)}catch{fail('公式PDF一覧のURLが必要です')};if(!s.id||typeof s.id!=='string'||s.id.length>100||s.kind!=='official-pdf-list'||u.protocol!=='https:'||u.hostname!=='www.boatrace.jp'||u.username||u.password||u.port)fail('BOAT RACE公式出走表PDF一覧以外は使用できません');}
  d.sources=unique(d.sources,s=>s.id,'情報源');
  for(const r of d.races){ident(r);if(r.race_date!==d.race_date||!Array.isArray(r.entrants)||r.entrants.length!==6||![null,'未確認','確認済み'].includes(r.extraction_confirmed)||r.deadline!==null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.deadline)||r.pdf_list_source_id!==null&&typeof r.pdf_list_source_id!=='string')fail('日付・締切・確認状態・6艇を確認してください');
   const allowed=['race_date','deadline','venue','race_number','entrants','pdf_list_source_id','extraction_confirmed'];if(Object.keys(r).some(k=>!allowed.includes(k)))fail('予想・買い目・結果・独自区分は取り込みません');
   for(let i=0;i<6;i++){const b=r.entrants[i];if(b.boat_number!==i+1||b.grade!==null&&!design.grades.includes(b.grade)||b.national_win_rate!==null&&(typeof b.national_win_rate!=='number'||b.national_win_rate<0||b.national_win_rate>10)||b.national_top2_rate_percent!==null&&(typeof b.national_top2_rate_percent!=='number'||b.national_top2_rate_percent<0||b.national_top2_rate_percent>100))fail('艇番号・級別・全国数値が不正です。未確認はnullです');if(Object.keys(b).sort().join(',')!=='boat_number,grade,national_top2_rate_percent,national_win_rate')fail('6艇の入力項目が不正です');}
  }
  d.races=unique(d.races,key,'出走原本',mergeRace);
  for(const c of d.confirmed_c){ident(c);if(c.confirmed!==true||typeof c.confirmation_note!=='string'||!c.confirmation_note.trim()||Object.keys(c).sort().join(',')!=='confirmation_note,confirmed,race_number,venue')fail('Cは指定確定済みの根拠を登録してください');}d.confirmed_c=unique(d.confirmed_c,key,'C指定');
  if(d.additional_exclusions.some(v=>!VENUES.includes(v)))fail('追加除外場が不正です');d.additional_exclusions=[...new Set(d.additional_exclusions)].sort();
  d.coverage.expected_races=unique(d.coverage.expected_races,ident,'全対象照合');return d;
 }
 function complete(r,d){return !!r&&r.extraction_confirmed==='確認済み'&&r.deadline!==null&&d.sources.some(s=>s.id===r.pdf_list_source_id)&&r.entrants.every(b=>b.grade!==null&&b.national_win_rate!==null&&b.national_top2_rate_percent!==null);}
 function ranked(boats){return [...boats].sort((a,b)=>b.national_top2_rate_percent-a.national_top2_rate_percent||a.boat_number-b.boat_number);}
 function classify(r){const pattern=r.entrants.slice(1,5).map(b=>b.grade[0]).join(''),isA=['BABA','ABAB'].includes(pattern),order=ranked(r.entrants),set=order.slice(0,4).map(b=>b.boat_number).sort().join(''),isB=order[0].boat_number===1&&['1234','1235','1345'].includes(set);return isB?'B':isA?'A':null;}
 function color(r,g){if(g==='C')return null;if(g==='A'&&ranked(r.entrants.slice(0,4)).slice(0,2).some(b=>b.boat_number===1))return '🔴';return r.race_number<=6?'🔵':'🟢';}
 function derive(input){const d=validate(input),excluded=new Set([...design.extraction.normal_exclusion_venues,...d.additional_exclusions]),cs=new Map(d.confirmed_c.map(c=>[key(c),c])),all=new Map(d.races.map(r=>[key(r),r])),rows=[],held=[],excludedRows=[],nonTargets=[];
  for(const c of cs.values())if(!all.has(key(c)))all.set(key(c),{race_date:d.race_date,venue:c.venue,race_number:c.race_number,deadline:null,entrants:[1,2,3,4,5,6].map(boat_number=>({boat_number,grade:null,national_win_rate:null,national_top2_rate_percent:null})),pdf_list_source_id:null,extraction_confirmed:'未確認'});
  for(const r of all.values()){if(excluded.has(r.venue)){excludedRows.push({record:r,reason:'除外場（指定原本は保持）'});continue;}const ready=complete(r,d),g=cs.has(key(r))?'C':ready?classify(r):null;
   if(g){rows.push({record:r,group:g,color:ready?color(r,g):null,status:ready?'確認済み':'未確認（C指定は保持）'});if(!ready)held.push({record:r,reason:'Cの6艇・原本照合が未確認'});}else if(!ready)held.push({record:r,reason:'級別・数値・締切・PDF根拠・照合の未確認'});else nonTargets.push(r);
  }
  rows.sort((a,b)=>a.group.localeCompare(b.group)||String(a.record.deadline??'99:99').localeCompare(String(b.record.deadline??'99:99'))||key(a.record).localeCompare(key(b.record)));
  const expected=d.coverage.expected_races.filter(r=>!excluded.has(r.venue)),missing=expected.filter(r=>!all.has(key(r))),extra=[...all.values()].filter(r=>!excluded.has(r.venue)&&!expected.some(e=>key(e)===key(r)));
  const gate=d.coverage.complete&&d.coverage.expected_races.length>0&&!missing.length&&!extra.length&&!held.length;
  return {date:d.race_date,rows,held,excluded:excludedRows,nonTargets,missing,extra,coverageComplete:gate,counts:Object.fromEntries(['A','B','C'].map(g=>[g,rows.filter(r=>r.group===g).length]))};
 }
 function merge(a,b){a=validate(a);b=validate(b);if(a.race_date!==b.race_date)fail('異なる日付は結合できません');const d=copy(a);for(const name of ['sources','races','confirmed_c'])d[name]=unique([...a[name],...b[name]],name==='sources'?s=>s.id:key,name,name==='races'?mergeRace:null);d.additional_exclusions=[...new Set([...a.additional_exclusions,...b.additional_exclusions])];d.coverage={complete:b.coverage.complete,expected_races:unique([...a.coverage.expected_races,...b.coverage.expected_races],ident,'対象')};return validate(d);}
 function saved(storage,day){fresh(day);const entries=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k.startsWith(PREFIX+day+':')){const v=JSON.parse(storage.getItem(k));if(v.format!=='ABC_DAY_SNAPSHOT_L1'||v.day.race_date!==day||!Number.isSafeInteger(v.revision)||v.revision<1)fail('保存データの形式不正。元データを保持して停止');validate(v.day);entries.push(v);}}
  entries.sort((a,b)=>a.revision-b.revision);for(let i=0;i<entries.length;i++){if(entries[i].revision!==i+1)fail('保存版の競合・欠落。上書きせず停止');if(i&&canon(merge(entries[i-1].day,entries[i].day))!==canon(entries[i].day))fail('既存原文の変更を検出しました');}return entries.at(-1)??null;
 }
 function commit(storage,input){const d=validate(input),old=saved(storage,d.race_date),day=old?merge(old.day,d):d;if(old&&canon(old.day)===canon(day))return old;const v={format:'ABC_DAY_SNAPSHOT_L1',revision:(old?.revision??0)+1,day};const id=globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);const k=PREFIX+d.race_date+':'+v.revision+':'+id;if(storage.getItem(k)!==null)fail('保存先競合');const raw=canon(v);storage.setItem(k,raw);if(storage.getItem(k)!==raw)fail('保存後の再読込未確認');const actual=saved(storage,d.race_date);if(canon(actual)!==raw)fail('同時保存競合。両原本を保持して停止');return v;}
 function backup(days){const uniqueDates=new Set();const data=days.map(d=>{d=validate(d);if(uniqueDates.has(d.race_date))fail('日付重複');uniqueDates.add(d.race_date);return d;});return {format:'ABC_LIST_BACKUP_L1',design_version:design.version,days:data};}
 function parseBackup(b){cleanJson(b);if(b?.format!=='ABC_LIST_BACKUP_L1'||b.design_version!==design.version||!Array.isArray(b.days))fail('一覧専用JSONではありません');return backup(b.days).days;}
 return {design:copy(design),fresh,validate,derive,merge,commit,saved,backup,parseBackup,complete};
}
return {create,canon,copy,date,VENUES,PREFIX};
});

