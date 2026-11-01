(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCIntegrated=api;})(globalThis,function(root){'use strict';
const DB='BOATRACE_ABC_CREATOR_V1',RULE='A10_B8_C16_20261026',FORMAT='ABC_INTEGRATED_DAY_V1';
const fail=s=>{throw Error(s)},ok=(x,s)=>{if(!x)fail(s)},clone=x=>JSON.parse(JSON.stringify(x));
const canon=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canon(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canon(x[k]))])):x);
// SHA-256 integrity only. Portable path supports offline/HTTP QA where WebCrypto is absent.
function sha256Bytes(bytes){
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],n=bytes.length,total=Math.ceil((n+9)/64)*64,data=new Uint8Array(total);data.set(bytes);data[n]=0x80;const view=new DataView(data.buffer);view.setUint32(total-8,Math.floor(n/0x20000000));view.setUint32(total-4,(n*8)>>>0);const w=new Uint32Array(64),rotate=(v,n)=>(v>>>n)|(v<<(32-n));
 for(let offset=0;offset<total;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0;}
 let [a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^((~e)&g))+K[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)>>>0);
 }return H.map(v=>v.toString(16).padStart(8,'0')).join('');
}
async function sha(text){const b=typeof text==='string'?new TextEncoder().encode(text):text;ok(ArrayBuffer.isView(b)&&b.BYTES_PER_ELEMENT===1,'SHA入力が不正');if(root.crypto?.subtle)return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');return sha256Bytes(b);}
const id=r=>r.venue+'|'+r.race_number;
const isCancelled=(d,r)=>(d.fetchReport?.cancelledRaces||[]).some(x=>x.venue===r?.venue&&x.raceNumber===r?.race_number);
const allRaces=d=>[...d.input.races,...Object.values(d.creation?.cStandalone||{})];
const digits=s=>String(s??'').replace(/[①②③④⑤⑥]/g,c=>String('①②③④⑤⑥'.indexOf(c)+1));
const circ=n=>'①②③④⑤⑥'[n-1];
const rank=r=>[...r.entrants].sort((a,b)=>b.national_top2_rate_percent-a.national_top2_rate_percent||a.boat_number-b.boat_number);
const expr=b=>b?b.first+'-'+b.second+'-'+b.third:'';
const expand=lines=>[...new Set(lines.flatMap(([a,b,c])=>[...a].flatMap(x=>[...b].flatMap(y=>[...c].filter(z=>x!==y&&x!==z&&y!==z).map(z=>x+y+z)))))].sort();
const bets=s=>root.ABCForecastBetAuditV20.parseLines(s);
const eqBets=(a,b)=>{const x=bets(a),y=bets(b);return !x.errors.length&&!y.errors.length&&canon([...x.bets].sort())===canon([...y.bets].sort());};
const plain=r=>({date:r.race_date,venue:r.venue,round:r.race_number,entries:r.entrants.map(b=>({grade:b.grade,rate:b.national_top2_rate_percent}))});
function validateDay(d){
 ok(d?.format===FORMAT&&d.ruleVersion===RULE,'統合版の形式・ルールが異なります');
 ok(/^20\d\d-\d\d-\d\d$/.test(d.date)&&new Date(d.date+'T00:00:00Z').toISOString().slice(0,10)===d.date&&d.date>'2026-10-23','保護日付または不正な日付');
 const engine=root.ABC_LIST_ENGINE.create(d.design);ok(d.input.race_date===d.date,'日付不一致');engine.validate(d.input);
 ok(d.members&&typeof d.members==='object'&&d.selections&&typeof d.selections==='object','6艇・指定が不足');
 ok(d.source===null||typeof d.source.rawHtml==='string'&&d.source.rawHtml.length<8000000&&d.source.snapshot?.date===d.date,'正式原本の日付・形式が不正');
 ok(d.sourcePending===undefined||typeof d.sourcePending==='boolean','原本選択状態が不正');
 ok(typeof d.coverageChecked==='boolean'&&typeof d.originChecked==='boolean','確認状態が不正');
 if(d.creation!==undefined){
  ok(d.creation.ckVersion===undefined||[1,2].includes(d.creation.ckVersion),'未対応のC/K形式です');
  ok(d.creation?.version===1&&d.creation.cOriginals&&typeof d.creation.cOriginals==='object'&&!Array.isArray(d.creation.cOriginals),'新規C指定原本の形式が不正');
  ok(d.source===null||!Object.keys(d.creation.cOriginals).length,'新規C指定原本を添付原本で置き換えることはできません');
  for(const [k,c]of Object.entries(d.creation.cOriginals)){
   if(c.rateSource==='MY_PREDICTION_SCREENSHOT')ok([1,2].includes(d.creation.ckVersion),'Cスクショの形式識別が不足');
   const r=allRaces(d).find(r=>id(r)===k);ok(r&&c.confirmed===true&&typeof c.note==='string'&&c.note.trim().length>0&&c.note.length<=200,'Cの本人指定根拠が不足');
   ok(/^[1-6]{5}$/.test(c.order)&&new Set(c.order).size===5&&!c.order.includes(c.excluded)&&(c.rateSource==='MY_PREDICTION_SCREENSHOT'?/^[1-6]$/.test(c.excluded):c.order.includes('1')&&/^[2-6]$/.test(c.excluded)),'C指定の順位・除外が不正');
   if(c.imageEvidence){const e=c.imageEvidence;ok(Array.isArray(e.rates)&&e.rates.length===6&&e.rates.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100)&&/^[a-f0-9]{64}$/.test(e.sha256),'旧C画像根拠の形式不正');}
   const made=Date.parse(c.createdAt),cutoff=Date.parse(d.date+'T'+r.deadline+':00+09:00');ok(Number.isFinite(made)&&(made<cutoff&&c.afterDeadline!==true||made>=cutoff&&c.afterDeadline===true),'C指定日時と事後登録の区分が不正');
  }
  if(!d.source)ok(canon(Object.keys(d.creation.cOriginals).filter(k=>d.input.races.some(r=>id(r)===k)).sort())===canon(d.input.confirmed_c.map(id).sort()),'C指定原本と対象が不一致');
 }
 if([1,2].includes(d.creation?.ckVersion))validateCK(d);
 const ids=new Set(allRaces(d).map(id));ok(ids.size===allRaces(d).length,'出走原本重複');
 for(const [k,s]of Object.entries(d.selections)){
  ok(ids.has(k),'指定先のレースがない');ok(['◎','○','指定なし'].includes(s.aim)&&typeof s.k==='string'&&s.k.length<30&&typeof s.cPush==='boolean'&&typeof s.reviewed==='boolean','狙い・K・推し・確認欄が不正');
  ok(s.bAxis===null||Number.isInteger(s.bAxis)&&s.bAxis>=1&&s.bAxis<=6,'B軸不正');ok(s.cDesignation===null||['○','△'].includes(s.cDesignation),'C指定不正');
 }
 return d;
}
function assertClosedUnchanged(previous,next,now){
 for(const [k,c]of Object.entries(previous.creation?.cOriginals||{}))ok(canon(c)===canon(next.creation?.cOriginals?.[k]),'保存済みC指定原本を変更・削除できません');
 const old=compute(previous),current=compute(next);
 for(const r of allRaces(previous))if(now>=Date.parse(previous.date+'T'+r.deadline+':00+09:00')){
  const k=id(r);ok(canon(r)===canon(allRaces(next).find(x=>id(x)===k))&&canon(previous.members[k])===canon(next.members[k])&&canon(previous.selections[k])===canon(next.selections[k]),'締切後に保存済みの出走・6艇・指定を変更できません');
  const before=old.rows.find(x=>x.key===k),after=current.rows.find(x=>x.key===k);
  const frozen=x=>x?{group:x.group,color:x.color,normal:x.normalExpression,hyp:x.hypExpression,eligible:x.eligible,cOrder:x.cOrder,cExcluded:x.cExcluded}:null;
  ok(canon(frozen(before))===canon(frozen(after)),'締切後に保存済みの対象・買い目・C順位を変更できません');
 }
}
function sourceRows(d,g){const s=d.source?.snapshot.sections.find(s=>s.id===g);return(s?.rows||[]).map(v=>Object.fromEntries(s.columns.map((c,i)=>[c,v[i]])));}
function identityText(s){const m=/^(.+?)(1[0-2]|[1-9])R$/.exec(s||'');ok(m,'原本の場・Rが不正');return m[1]+'|'+Number(m[2]);}
function applySource(d,source){
 d=clone(d);ok(!Object.keys(d.creation?.cOriginals||{}).length,'作成したC指定原本は添付原本で上書きできません');ok(source.snapshot.date===d.date,'原本とPDFの日付が違います');
 d.source=clone(source);d.sourcePending=false;d.input.confirmed_c=[];
 for(const r of sourceRows(d,'c')){
  const k=identityText(r['場・R']),[venue,no]=k.split('|');
  ok(d.input.races.some(x=>id(x)===k),'C原本の対象PDFがありません：'+r['場・R']);
  d.input.confirmed_c.push({venue,race_number:Number(no),confirmed:true,confirmation_note:'添付原本のC行。出典SHA='+source.sha256});
 }
 for(const g of ['a','b','c'])for(const row of sourceRows(d,g)){
  const k=identityText(row['場・R']);ok(d.input.races.some(r=>id(r)===k),'原本の対象PDF不足：'+row['場・R']);
  const old=d.selections[k]||defaults();d.selections[k]={...old,aim:g==='c'?'指定なし':row['狙い']||'指定なし',k:g==='a'?row['k除外']||'':g==='b'?row['k型']||'':'',cPush:g==='c'&&row['推し']==='推し',reviewed:false};
  const h=sourceRows(d,g+'-hypo').find(x=>x['場・R']===row['場・R']);
  if(g==='b'){const v=digits(h?.['指定']||'').match(/[1-6]/g)||[];d.selections[k].bAxis=v.length===1?Number(v[0]):null;}
  if(g==='c')d.selections[k].cDesignation=/^[○△]/.test(h?.['指定']||'')?h['指定'][0]:null;
 }
 return validateDay(d);
}
// Explicitly authored before the deadline. Never infer a C target/order from PDF numbers.
function authorC(d,key,order,excluded,note,accepted,now=Date.now()){
 validateDay(d);ok(![1,2].includes(d.creation?.ckVersion),'新規Cはスクショ添付と本人確認から記録してください');const r=d.input.races.find(r=>id(r)===key);
 ok(d.creation?.version===1&&!d.source&&!d.sourcePending,'新規作成の原本未接続時だけC指定を記録できます');
 ok(r&&Number.isFinite(now)&&now<Date.parse(d.date+'T'+r.deadline+':00+09:00'),'締切後のC追加は禁止');
 ok(accepted===true,'6艇とC対象・順位・除外の本人確認が必要です');
 ok(!d.creation.cOriginals[key],'確認済みC指定原本を変更できません');
 ok(/^[2-6]$/.test(excluded)&&rank(r).filter(b=>String(b.boat_number)!==excluded).map(b=>b.boat_number).join('')===order,'入力順位・除外がPDF数値と不一致です。自動修正せず停止します');
 const members=d.members[key]||[];ok(members.length===6&&members.every((b,i)=>b.boat_number===i+1&&b.player_name&&/^\d{4}$/.test(b.registration_number||''))&&new Set(members.map(b=>b.registration_number)).size===6,'C指定前に6艇の氏名・登録番号を確認してください');
 const next=clone(d);next.creation.cOriginals[key]={order,excluded,note,confirmed:true,createdAt:new Date(now).toISOString()};
 next.input.confirmed_c.push({venue:r.venue,race_number:r.race_number,confirmed:true,confirmation_note:'新規作成時の本人C指定：'+note});
 next.selections[key]={...defaults(),reviewed:false};return validateDay(next);
}
function c16(q,choice){
 ok(/^[1-6]{5}$/.test(q)&&new Set(q).size===5&&[3,4].includes(q.indexOf('1'))&&['○','△'].includes(choice),'C16点の順位・指定が不正');
 const first=q[0],designated=q[choice==='○'?1:2],axis='1'+designated,rest=[...q].filter(n=>n!==first).join(''),tail=[...q].filter(n=>n!=='1').at(-1),third='1'+designated+tail;
 const expression=first+'-'+axis+'-'+rest+'\n'+axis+'-'+first+'-'+rest+'\n'+axis+'-'+third+'-'+first,expected=expand([[first,axis,rest],[axis,first,rest],[axis,third,first]]);
 ok(new Set(third).size===3&&expected.length===16,'C16点の構成不一致');return {expression,expected};
}
function updateSelection(d,key,patch,now=Date.now()){
 const r=allRaces(d).find(r=>id(r)===key);ok(r&&Number.isFinite(now)&&now<Date.parse(d.date+'T'+r.deadline+':00+09:00'),'締切後の指定変更は禁止');
 ok(!isCancelled(d,r),'中止・順延が確認されたレースは指定できません');
 ok(Object.keys(patch).every(k=>Object.keys(defaults()).includes(k)),'指定項目が不正');
 const next=clone(d);next.selections[key]={...(next.selections[key]||defaults()),...patch};
 if([1,2].includes(next.creation?.ckVersion)){
  const s=next.selections[key],group=root.ABC_LIST_ENGINE.create(d.design).derive(d.input).rows.find(x=>id(x.record)===key)?.group;
  if('aKExcluded'in patch){ok(group==='A','AのK除外はAだけ指定できます');s.k=s.aKExcluded===null?'':circ(s.aKExcluded);}
  if('bKType'in patch){ok(group==='B','BのK型はBだけ指定できます');s.k=s.bKType===null?'':s.bKType==='24'?'②④型':'③⑤型';}
  if('cfEnabled'in patch)s.cfDate=s.cfEnabled?d.date:null;
  if(s.cfEnabled){ok(['A','B'].includes(group),'クロスファイヤーは明示したA/Bだけです');ok(group==='A'?s.aKExcluded!==null:s.bKType!==null,'クロスファイヤー参加前にAのK除外／BのK型を指定してください');}
 }
 validateDay(next);return next;
}
const defaults=()=>({aim:'指定なし',k:'',cPush:false,bAxis:null,cDesignation:null,reviewed:false,aKExcluded:null,bKType:null,cfEnabled:false,cfDate:null});

// CK extension is opt-in for newly created days. Historical payloads keep their old path.
function imageBytes(image){return Uint8Array.from(root.atob(image.dataUrl.split(',')[1]),c=>c.charCodeAt(0));}
function cScreenshotRanking(rates,keepOne=true){
 ok(Array.isArray(rates)&&rates.length===6&&rates.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100),'スクショの全国期別2連率6艇をすべて確認してください');
 const full=rates.map((rate,i)=>({boat:i+1,rate})).sort((a,b)=>b.rate-a.rate||a.boat-b.boat).map(b=>b.boat);
 // Rank the screenshot's six boats, keeping inner lanes ahead on ties.
 const excluded=keepOne?full.filter(n=>n!==1).at(-1):full.at(-1);
 return {full:full.join(''),excluded:String(excluded),order:full.filter(n=>n!==excluded).join('')};
}
function validateCK(d){
 const images=d.creation.cScreenshots;ok(images&&typeof images==='object'&&!Array.isArray(images),'Cスクショ領域が不正');
 ok(Object.keys(images).length<=30,'Cスクショは30枚まで');let total=0;
 for(const [key,r]of Object.entries(d.creation.cStandalone||{})){
 ok(d.creation.ckVersion===2&&id(r)===key&&r.race_date===d.date&&root.ABCCImageOCR.VENUES.includes(r.venue)&&Number.isInteger(r.race_number)&&r.race_number>=1&&r.race_number<=12&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.deadline),'スクショ単独レースの識別・締切が不正');
 ok(Array.isArray(r.entrants)&&r.entrants.length===6&&r.entrants.every((b,i)=>b.boat_number===i+1&&b.grade===null&&b.national_win_rate===null&&(b.national_top2_rate_percent===null||typeof b.national_top2_rate_percent==='number'&&b.national_top2_rate_percent>=0&&b.national_top2_rate_percent<=100)),'スクショ6艇の入力が不正');}
 for(const [key,v] of Object.entries(images)){
  ok(v&&v.sha256===key&&/^[a-f0-9]{64}$/.test(key)&&typeof v.name==='string'&&v.name.length<=200&&typeof v.dataUrl==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v.dataUrl),'C画像の形式が不正');
  ok(v.dataUrl.length<=7100000,'C画像1枚が5MBを超えています');total+=v.dataUrl.length;
  ok(typeof v.identityConfirmed==='boolean'&&v.date===d.date&&(v.raceKey===''||allRaces(d).some(r=>id(r)===v.raceKey)),'C画像の日付・場・Rが不正');
  ok(!v.identityConfirmed||v.raceKey!=='','C画像の場・Rを確認してください');
  if(d.creation.ckVersion>=2&&v.identityConfirmed){const [venue,no]=v.raceKey.split('|');ok((v.ocr&&root.ABCCImageOCR.compareIdentity(v.ocr,d.date,venue,Number(no))==='MATCH')||v.manualCorrection===true,'画像の開催情報が未照合です。本人確認による訂正を明示してください');}
 }
 ok(total<=49000000,'C画像の合計容量を超えています（元画像の合計は約35MBまで）');
 for(const [k,c]of Object.entries(d.creation.cOriginals)){
  ok(['MY_PREDICTION_SCREENSHOT','OFFICIAL_PERIOD_FILE'].includes(c.rateSource),'新規Cの根拠が不正');
  const im=images[c.screenshotId],ranking=cScreenshotRanking(c.rates,d.creation.ckVersion>=2);
  if(c.rateSource==='MY_PREDICTION_SCREENSHOT')ok(im&&im.identityConfirmed&&im.date===d.date&&im.raceKey===k,'C原本の根拠画像・開催日・場・Rが一致しません');
  else {const r=allRaces(d).find(x=>id(x)===k),m=d.members[k];ok(r&&c.courseRate>=0&&c.courseRate<=50&&Number.isInteger(c.courseRuns)&&c.courseRuns>0&&c.sourceSha==='1e7eff91eb6722b7392bea9605ac198df5f35e0b2fbaf4d70f54644bf123209c'&&d.date>='2026-07-01'&&d.date<='2026-12-31'&&Array.isArray(m)&&m.length===6&&m.every((b,i)=>b.national_top2_rate_percent===c.rates[i]),'公式期別データの条件・根拠・全国2連対率が不一致');}
  ok(c.order===ranking.order&&c.excluded===ranking.excluded&&c.fullOrder===ranking.full,'Cスクショ値と順位・除外が不一致');
 }
 const grouped=new Map([...root.ABC_LIST_ENGINE.create(d.design).derive(d.input).rows.map(x=>[id(x.record),x.group]),...Object.keys(d.creation.cStandalone||{}).map(k=>[k,'C'])]);
 for(const [k,s]of Object.entries(d.selections)){
  if(d.source)continue;
  ok(s.aKExcluded===null||Number.isInteger(s.aKExcluded)&&s.aKExcluded>=2&&s.aKExcluded<=6,'AのK除外は実艇番2〜6です');
  ok(s.bKType===null||['24','35'].includes(s.bKType),'BのK型は②④型／③⑤型です');
  ok(typeof s.cfEnabled==='boolean'&&(s.cfDate===null||s.cfDate===d.date),'クロスファイヤーは当日明示指定だけです');
  const g=grouped.get(k);
  ok(s.aKExcluded===null||g==='A','AのK除外を他区分へ流用できません');ok(s.bKType===null||g==='B','BのK型を他区分へ流用できません');
  ok(s.k===(g==='A'?(s.aKExcluded===null?'':circ(s.aKExcluded)):g==='B'?(s.bKType===null?'':s.bKType==='24'?'②④型':'③⑤型'):''),'Kの入力と一覧用値が不一致');
  ok(!s.cfEnabled||s.cfDate===d.date&&((g==='A'&&s.aKExcluded!==null)||(g==='B'&&s.bKType!==null)),'クロスファイヤーの当日指定が不足');
 }
}
async function addCScreenshots(d,files){
 validateDay(d);ok([1,2].includes(d.creation?.ckVersion)&&!d.source&&!d.sourcePending,'新規作成中だけCスクショを添付できます');const next=clone(d);
 for(const f of files){ok(f&&/^data:image\/(png|jpeg|webp);base64,/.test(f.dataUrl),'PNG/JPEG/WebP画像を選択してください');const bytes=imageBytes(f);
  ok(bytes.length>0&&bytes.length<=5*1024*1024,'C画像は1枚5MB以下です');const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  ok(f.dataUrl.startsWith('data:image/png;')?png:f.dataUrl.startsWith('data:image/jpeg;')?jpg:webp,'画像の実体と形式が一致しません');const hash=await sha(bytes);
  if(!next.creation.cScreenshots[hash])next.creation.cScreenshots[hash]={sha256:hash,dataUrl:f.dataUrl,name:String(f.name).slice(0,200),date:d.date,raceKey:'',identityConfirmed:false};
 }
 return validateDay(next);
}
function identifyCScreenshot(d,imageId,date,raceKey,confirmed,manualCorrection=false){
 validateDay(d);ok([1,2].includes(d.creation?.ckVersion)&&!d.source&&!d.sourcePending,'C画像の識別を変更できません');const image=d.creation.cScreenshots[imageId];ok(image,'画像がありません');
 ok(!Object.values(d.creation.cOriginals).some(c=>c.screenshotId===imageId),'記録済みCの根拠画像は変更できません');
 const next=clone(d);next.creation.cScreenshots[imageId]={...image,date,raceKey,identityConfirmed:confirmed,manualCorrection};return validateDay(next);
}
function authorCScreenshot(d,key,imageId,rates,order,excluded,note,accepted,now=Date.now(),options={}){
 validateDay(d);const r=allRaces(d).find(r=>id(r)===key),image=d.creation?.cScreenshots?.[imageId];
 ok(!isCancelled(d,r),'中止・順延が確認されたレースはCに追加できません');
 ok([1,2].includes(d.creation?.ckVersion)&&!d.source&&!d.sourcePending,'新規作成のCスクショ入力だけ記録できます');
 const afterDeadline=!!r&&Number.isFinite(now)&&now>=Date.parse(d.date+'T'+r.deadline+':00+09:00');ok(r&&Number.isFinite(now)&&(!afterDeadline||options.retrospective===true),'締切後は事後の参考記録としてのみ追加できます');
 ok(image?.identityConfirmed&&image.date===d.date&&image.raceKey===key,'スクショの日付・場・Rの明示確認が必要です');
 ok(accepted===true,'スクショ6艇・数値・順位・除外の本人確認が必要です');ok(!d.creation.cOriginals[key],'確認済みC指定原本を変更できません');
 const q=cScreenshotRanking(rates,d.creation.ckVersion>=2);ok(order===q.order&&excluded===q.excluded,'スクショ値と入力順位・除外が不一致。自動修正せず停止します');
 const members=d.members[key]||[];ok(d.creation.cStandalone?.[key]||members.length===6&&members.every((b,i)=>b.boat_number===i+1&&b.player_name&&/^\d{4}$/.test(b.registration_number||''))&&new Set(members.map(b=>b.registration_number)).size===6,'C指定前に6艇の氏名・登録番号を確認してください');
 const next=clone(d);if(next.creation.cStandalone?.[key]){next.creation.cStandalone[key].entrants.forEach((b,i)=>b.national_top2_rate_percent=rates[i]);next.members[key].forEach((b,i)=>b.national_top2_rate_percent=rates[i]);}next.creation.cOriginals[key]={order,excluded,fullOrder:q.full,rates:clone(rates),rateSource:'MY_PREDICTION_SCREENSHOT',screenshotId:imageId,note,confirmed:true,createdAt:new Date(now).toISOString(),...(afterDeadline?{afterDeadline:true}:{})};
 if(!next.creation.cStandalone?.[key])next.input.confirmed_c.push({venue:r.venue,race_number:r.race_number,confirmed:true,confirmation_note:'公式マイ予想スクショの本人確認：'+note});next.selections[key]=defaults();return validateDay(next);
}

function authorOfficialC(d,key,entry,now=Date.now(),options={}){
 validateDay(d);const r=d.input.races.find(x=>id(x)===key),m=d.members[key];
 ok(d.creation?.ckVersion===2&&!d.source&&!d.sourcePending&&r&&!isCancelled(d,r),'対象レースの入力がありません');
 ok(d.date>='2026-07-01'&&d.date<='2026-12-31','公式期別データの適用期間外です');
 const late=now>=Date.parse(d.date+'T'+r.deadline+':00+09:00');ok(Number.isFinite(now)&&(!late||options.retrospective===true),'締切後は事後の参考記録としてのみ追加できます');
 ok(!d.design.extraction.normal_exclusion_venues.includes(r.venue)&&!(d.input.additional_exclusions||[]).includes(r.venue),'除外場は対象外です');
 ok(!d.creation.cOriginals[key]&&canon(d.selections[key]||defaults())===canon(defaults()),'指定済みレースは自動変更しません');
 ok(entry&&Number.isInteger(entry.n)&&entry.n>0&&typeof entry.r==='number'&&entry.r>=0&&entry.r<=50,'1コース成績がないか50％を超えています');
 ok(Array.isArray(m)&&m.length===6&&m.every((b,i)=>b.boat_number===i+1&&/^\d{4}$/.test(b.registration_number||'')&&Number.isFinite(b.national_top2_rate_percent)),'6艇・登録番号・全国期別2連対率が不足');
 const rates=m.map(b=>b.national_top2_rate_percent),q=cScreenshotRanking(rates,true),next=clone(d);
 next.creation.cOriginals[key]={order:q.order,excluded:q.excluded,fullOrder:q.full,rates,courseRate:entry.r,courseRuns:entry.n,sourceSha:'1e7eff91eb6722b7392bea9605ac198df5f35e0b2fbaf4d70f54644bf123209c',rateSource:'OFFICIAL_PERIOD_FILE',note:'公式期別成績と公式出走表から自動抽出・正式原本未照合',confirmed:true,createdAt:new Date(now).toISOString(),...(late?{afterDeadline:true}:{})};
 next.input.confirmed_c.push({venue:r.venue,race_number:r.race_number,confirmed:true,confirmation_note:'公式期別成績の1コース2連対率50％以下：'+entry.r+'%（'+entry.n+'走）'});return validateDay(next);
}
function createImageDay(date,design){const input=root.ABC_LIST_ENGINE.create(design).fresh(date);return validateDay({format:FORMAT,ruleVersion:RULE,date,design:clone(design),input,members:{},selections:{},source:null,creation:{version:1,ckVersion:2,cOriginals:{},cScreenshots:{},cStandalone:{}},originChecked:false,coverageChecked:false});}
// Date correction is deliberately restricted to fresh, image-only intake.
// Parsed PDF races, C candidates/originals, selections and saved drafts never migrate dates.
function canCorrectCImageDate(d){return d?.creation?.ckVersion===2&&d.creation.version===1&&!d.source&&!d.sourcePending&&d.input.races.length===0&&d.input.sources.length===0&&Object.keys(d.creation.cOriginals).length===0&&Object.keys(d.creation.cStandalone||{}).length===0&&Object.keys(d.members).length===0&&Object.keys(d.selections).length===0;}
function correctCImageDate(d,date,occupiedDates=[]){
 validateDay(d);ok(canCorrectCImageDate(d),'開催日訂正はPDFなし・C候補追加前の画像読取段階だけです。作成中の入力は保持しました');
 ok(Array.isArray(occupiedDates)&&!occupiedDates.includes(d.date)&&!occupiedDates.includes(date),'訂正元または訂正先の日付に保存済みデータがあります。画像・元の日付を保持して停止しました');
 if(date===d.date)return clone(d);
 const next=createImageDay(date,d.design);next.creation.cScreenshots=clone(d.creation.cScreenshots);
 for(const image of Object.values(next.creation.cScreenshots)){image.date=date;image.raceKey='';image.identityConfirmed=false;image.manualCorrection=false;}
 return validateDay(next);
}
function stageStandaloneC(d,imageId,venue,no,deadline,manualCorrection=false,now=Date.now(),options={}){
 validateDay(d);ok(d.creation?.ckVersion===2&&!d.source&&!d.sourcePending,'新規作成中だけスクショ単独Cを追加できます');
 ok(root.ABCCImageOCR.VENUES.includes(venue)&&Number.isInteger(no)&&no>=1&&no<=12&&/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline),'画像の場・R・締切を確認してください');
 ok(now<Date.parse(d.date+'T'+deadline+':00+09:00')||options.retrospective===true,'締切後は事後の参考記録としてのみ追加できます');const key=venue+'|'+no;
 ok(!allRaces(d).some(r=>id(r)===key),'このレースは既にあります。C対象欄から選択してください');
 const im=d.creation.cScreenshots[imageId];ok(im,'根拠画像がありません');const next=clone(d);
 const entrants=[1,2,3,4,5,6].map((boat_number,i)=>({boat_number,grade:null,national_win_rate:null,national_top2_rate_percent:im.ocr?.rates?.[i]??null}));
 next.creation.cStandalone[key]={race_date:d.date,venue,race_number:no,deadline,entrants,pdf_list_source_id:null,extraction_confirmed:'確認済み'};next.members[key]=entrants.map(b=>({...b,player_name:null,registration_number:null}));next.selections[key]=defaults();
 next.creation.cScreenshots[imageId]={...im,raceKey:key,identityConfirmed:true,manualCorrection};return validateDay(next);
}
function setCImageOCR(d,imageId,ocr){validateDay(d);const next=clone(d),im=next.creation.cScreenshots[imageId];ok(im&&!Object.values(d.creation.cOriginals).some(c=>c.screenshotId===imageId),'記録済みC画像の読取結果は変更できません');im.ocr=clone(ocr);im.identityConfirmed=false;return validateDay(next);}
function crossfire(x,d,contract){
 if(![1,2].includes(d.creation?.ckVersion)||d.source||!x.selection.cfEnabled)return null;
 const s=x.selection;ok(s.cfDate===d.date,'過去のクロスファイヤー指定を流用できません');
 const a=x.record.entrants.slice(1,5).map(b=>b.grade[0]).join(''),pattern=x.group==='A'?(a==='ABAB'?'24':a==='BABA'?'35':null):x.group==='B'?s.bKType:null;
 const excluded=x.group==='A'?s.aKExcluded:x.normal?.excluded;ok(pattern&&Number.isInteger(excluded)&&excluded>=2&&excluded<=6,'K型・除外艇が未確認です');
 const transform=lines=>{ok(Array.isArray(lines),'原型がありません');const original=lines.map(s=>s.split('-'));ok(expand(original).length===6,'原型は6点が必要です');const replaced=excluded!==6&&lines.some(s=>s.includes(String(excluded))),adjusted=original.map(a=>a.map(part=>part.replaceAll(String(excluded),'6'))),tickets=expand(adjusted);ok(tickets.length===6,'差替後の6点が不一致');return {expression:adjusted.map(a=>a.join('-')).join('\n'),tickets,replaced};};
 const legacy=transform(contract.crossfire_rule.legacy_patterns[pattern]),image=transform(contract.crossfire_image_policy.masters[pattern]);
 return {pattern,excluded,legacy,image,replaced:image.replaced};
}

function readMembers(pages,races){const out={};for(const r of races){const p=pages[Math.floor((r.race_number-1)/6)],items=p.items.filter(x=>typeof x.str==='string'&&x.str.trim()).map(x=>({...x,s:x.str.normalize('NFKC').replace(/\s/g,'')})),no=((r.race_number-1)%6),headers=items.filter(x=>/^([1-9]|1[0-2])R$/.test(x.s)&&x.x>=15&&x.x<=28).sort((a,b)=>b.y-a.y),h=headers[no],bottom=headers[no+1]?.y??40;
 const bs=items.filter(x=>/^[1-6]$/.test(x.s)&&x.x>=12&&x.x<=20&&x.y<h.y&&x.y>bottom).sort((a,b)=>b.y-a.y);if(bs.length!==6)throw Error('選手名の行境界が未対応');
 out[id(r)]=bs.map((b,i)=>{const reg=items.filter(x=>Math.abs(x.y-b.y)<3&&x.x>=28&&x.x<57&&/^\d{4}$/.test(x.s)),names=items.filter(x=>Math.abs(x.y-b.y)<3&&x.x>=62&&x.x<154).sort((a,b)=>a.x-b.x);return {...r.entrants[i],registration_number:reg.length===1?reg[0].s:null,player_name:names.map(x=>x.s).join('')||null}});
 }return out;}

function compute(d){
 validateDay(d);const derived=root.ABC_LIST_ENGINE.create(d.design).derive(d.input),rows=[],issues=[];
 for(const [k,r]of Object.entries(d.creation?.cStandalone||{}))if(d.creation.cOriginals[k]){derived.rows.push({record:r,group:'C',color:null,status:'スクショ本人確認済み・PDFなし'});derived.counts.C++;}
 // A screenshot-confirmed C can also be recorded at a normally excluded A/B venue.
 // Automatic intake now includes every venue's PDF, so preserve the prior PDF-free C path.
 for(const [k,c]of Object.entries(d.creation?.cOriginals||{})){
  const r=d.input.races.find(r=>id(r)===k);
  if(r&&c.confirmed&&c.rateSource==='MY_PREDICTION_SCREENSHOT'&&d.design.extraction.normal_exclusion_venues.includes(r.venue)&&!(d.input.additional_exclusions||[]).includes(r.venue)&&!derived.rows.some(x=>id(x.record)===k))derived.rows.push({record:r,group:'C',color:null,status:'スクショ本人確認済み'});
 }
 derived.rows=derived.rows.filter(x=>!isCancelled(d,x.record));
 derived.counts=Object.fromEntries(['A','B','C'].map(group=>[group,derived.rows.filter(x=>x.group===group).length]));
 const bases=new Map(['a','b','c'].flatMap(g=>sourceRows(d,g).map(r=>[identityText(r['場・R']),{group:g.toUpperCase(),row:r}])));
 for(const x of derived.rows){
  const r=x.record,k=id(r),sel=d.selections[k]||defaults(),original=bases.get(k),errors=[],entries=d.members[k]||[],authored=d.creation?.cOriginals?.[k],s=original?.row||(authored?{'2連対率順':authored.order,'除外':authored.excluded,'締切':r.deadline}:null);
  let normal=null,normalExpression='',hypothesis=null,hypExpression='',eligible=false,bOptions=[],cOptions=null,cOrder=null,cExcluded=null;
  if(!d.creation?.cStandalone?.[k]&&(entries.length!==6||new Set(entries.map(b=>b.registration_number)).size!==6||entries.some((b,i)=>b.boat_number!==i+1||!b.player_name||!/^\d{4}$/.test(b.registration_number||''))))errors.push('選手名・登録番号6艇が未照合');
  if(entries.some((b,i)=>['boat_number','grade','national_win_rate','national_top2_rate_percent'].some(f=>b[f]!==r.entrants[i]?.[f])))errors.push('6艇の表示数値とPDF入力が不一致');
  if(!original)errors.push('正式買い目・指定原本の対象行なし');
  else if(original.group!==x.group)errors.push('ABC区分が原本と不一致');
  if(s&&s['締切']!==r.deadline)errors.push('締切が原本と不一致');
  if(x.group!=='C'){
   const candidate=root.BOAT_CANDIDATES.evaluate(plain(r));
   if(candidate.category!==x.group||candidate.bet?.color!==x.color)errors.push('管理アプリとABC抽出・色が不一致');
   else{normal=candidate.bet;normalExpression=expr(normal);const markers=normal.marked||[];
    normalExpression=normalExpression.split('-').map((v,i)=>[...v].map(c=>(x.group==='A'||i===1)&&markers.includes(Number(c))?circ(Number(c)):c).join('')).join('-');}
   if(s&&s['色']!==x.color)errors.push('色が原本と不一致');
   if(s&&normal&&((s['買い目'].match(/[①②③④⑤⑥]/g)||[]).sort().join('')!==(normalExpression.match(/[①②③④⑤⑥]/g)||[]).sort().join('')))errors.push('丸数字艇が原本と不一致');
   if(s&&x.group!=='C'&&normal&&Number(String(s['投資']).replace(/[,円¥￥]/g,''))!==normal.stake)errors.push('通常投資が原本と不一致');
   if(s&&normal&&!eqBets(s['買い目'],normalExpression))errors.push('通常買い目がPDF・既存管理エンジンと不一致');
   if(x.group==='A'&&x.color==='🔴'&&normal){
    eligible=true;const opponents=rank(r).filter(b=>normal.second.includes(String(b.boat_number))&&b.boat_number!==1).map(b=>b.boat_number);
    if(opponents.length!==3)errors.push('A10点の相手3艇が未照合');
    else{const q=opponents.join('');hypExpression='1-'+q+'-'+q+'\n'+q.slice(0,2)+'-1-'+q;hypothesis=expand([['1',q,q],[q.slice(0,2),'1',q]]);}
   }
   if(x.group==='B'&&normal){
    eligible=true;bOptions=[...normal.second].map(Number).filter(n=>!normal.marked.includes(n));
    if(sel.bAxis!==null){if(!bOptions.includes(sel.bAxis))errors.push('B第2軸が指定候補外');else{const axis='1'+sel.bAxis,other=bOptions.find(n=>n!==sel.bAxis),rest=[...normal.third].filter(n=>Number(n)!==sel.bAxis).join('');hypExpression=axis+'-'+axis+'-'+rest+'\n'+axis+'-'+other+'-'+axis;hypothesis=expand([[axis,axis,rest],[axis,String(other),axis]]);}}
   }
  }else if(s){
   cOrder=digits(s['2連対率順']).replace(/\s/g,'');cExcluded=digits(s['除外']).trim();
   if(!/^[1-6]{5}$/.test(cOrder)||new Set(cOrder).size!==5||!/^[1-6]$/.test(cExcluded)||cOrder.includes(cExcluded)||(!authored?.rateSource&&!cOrder.includes('1')))errors.push('C原本の順位・除外が不足');
   else{
    // Preserve the user's C order/exclusion verbatim; numeric ranking is a separate comparison only.
    const compared=['MY_PREDICTION_SCREENSHOT','OFFICIAL_PERIOD_FILE'].includes(authored?.rateSource)?cScreenshotRanking(authored.rates,d.creation.ckVersion>=2).order:authored?.imageEvidence?authored.order:rank(r).filter(b=>String(b.boat_number)!==cExcluded).map(b=>b.boat_number).join('');if(compared!==cOrder)errors.push('C保存原本の順位とPDFが不一致（原本は変更しません）');
    const by=root.BOAT_WORKFLOW.confirmedC({userConfirmedC:true,rateOrder:[...cOrder,cExcluded].map(Number),excluded:Number(cExcluded),push:sel.cPush});normal=by.bet;normalExpression=expr(normal);
    eligible=[3,4].includes(cOrder.indexOf('1'));
    if(eligible){cOptions={circle:Number(cOrder[1]),triangle:Number(cOrder[2])};if(sel.cDesignation&&authored?.rateSource!=='OFFICIAL_PERIOD_FILE'){try{const h=c16(cOrder,sel.cDesignation);hypothesis=h.expected;hypExpression=h.expression;}catch(e){errors.push(e.message)}}else if(sel.cDesignation)errors.push('C16点の組み立て定義は未確認');}
   }
  }
  const sourceHyp=sourceRows(d,x.group.toLowerCase()+'-hypo').find(h=>h['場・R']===r.venue+r.race_number+'R');
  if(eligible&&original&&!sourceHyp)errors.push('仮説対象行が原本にない');
  if(!eligible&&sourceHyp)errors.push('仮説対象外なのに原本に対象行あり');
  if(sourceHyp){
   if(sourceHyp['締切']!==r.deadline)errors.push('仮説締切が原本と不一致');
   if(hypothesis&&(Number(sourceHyp['点数'])!==hypothesis.length||Number(sourceHyp['投資'].replace(/[,円¥￥]/g,''))!==hypothesis.length*100))errors.push('仮説点数・投資が原本と不一致');
   const ds=String(sourceHyp['指定']||'');const originalB=Number(digits(ds).match(/[1-6]/)?.[0])||null,originalC=/^[○△]/.test(ds)?ds[0]:null;
   if(x.group==='B'&&sel.bAxis!==originalB)errors.push('B第2軸が指定原本と未照合');
   if(x.group==='C'&&sel.cDesignation!==originalC)errors.push('C○△が指定原本と未照合');
   if(hypothesis&&!eqBets(sourceHyp['仮説買い目'],hypExpression))errors.push('仮説買い目が正式原本と不一致');
   if(!hypothesis&&root.ABCForecastBetAuditV20.parseLines(sourceHyp['仮説買い目']).bets.length)errors.push('未指定なのに原本に仮説買い目あり');
  }
  if(s&&x.group!=='C'&&(sel.aim!==(s['狙い']||'指定なし')||sel.k!==(s[x.group==='A'?'k除外':'k型']||'')))errors.push('狙い・Kが指定原本と未照合');
  if(original&&x.group==='C'&&sel.cPush!==(s['推し']==='推し'))errors.push('推しが指定原本と未照合');
  if(!sel.reviewed)errors.push('6艇・買い目・指定の本人確認待ち');
  if(hypothesis&&hypothesis.length!==({A:10,B:8,C:16}[x.group]))errors.push('仮説点数不一致');
  rows.push({...x,key:k,selection:sel,members:entries,normal,normalExpression,hypothesis,hypExpression,eligible,bOptions,cOptions,cOrder,cExcluded,cRateSource:authored?.rateSource||'PDF_OR_HISTORICAL',cCourseRate:authored?.courseRate??null,cAfterDeadline:!!authored?.afterDeadline,cOneRate:authored?.rateSource==='MY_PREDICTION_SCREENSHOT'?authored.rates[0]:authored?.imageEvidence?.rates?.[0]??null,cOrderDisplay:s?.['2連対率順']||cOrder,cExcludedDisplay:s?.['除外']||cExcluded,issues:[...new Set(errors)]});
 }
 const cKeys=sourceRows(d,'c').map(r=>identityText(r['場・R'])).sort();if(canon(cKeys)!==canon(d.input.confirmed_c.map(id).sort()))issues.push('C指定と正式原本の対象が不一致（再抽出しません）');
 if(bases.size!==derived.rows.length||[...bases.keys()].some(k=>!rows.some(x=>x.key===k)))issues.push('PDF抽出対象と原本の全対象が一致しません');
 for(const name of ['crossfire','cf-image-races'])if(sourceRows(d,name).length)issues.push('指定原本の'+name+'は接続未照合（行を保持）');
 if(!rows.length)issues.push('ABC対象がありません');
 return {rows,derived,issues,counts:derived.counts};
}
function gate(d,now=Date.now()){
 const c=compute(d),issues=[...c.issues,...c.rows.flatMap(x=>x.issues.map(m=>x.record.venue+x.record.race_number+'R：'+m))];
 if(d.fetchReport?.failures?.length)issues.push('公式の開催場に未取得・未解析があります');
 if(!d.originChecked)issues.push('公式一覧からのPDF取得元確認待ち');
 if(!d.coverageChecked)issues.push('選択した対象場・全12Rの確認待ち');
 const venues=[...new Set(d.input.races.map(r=>r.venue))];if(!venues.length||venues.some(v=>d.input.races.filter(r=>r.venue===v).length!==12)||c.derived.held.length||c.derived.missing.length||c.derived.extra.length)issues.push('対象場の12R・抽出項目が不足');
 if(d.sourcePending)issues.push('選択した原本はまだ未接続（前のC指定・原本は保持）');
 if(!d.source?.preResultAccepted)issues.push('結果前の正式買い目・指定原本が未接続');
 if(d.source?.rawHtml&&d.source.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(d.source.sha256))issues.push('正式原本SHA不正');
 if(!Number.isFinite(now)||c.rows.some(x=>now>=Date.parse(d.date+'T'+x.record.deadline+':00+09:00')))issues.push('締切後の新規確定・過去予想の変更は禁止');
 return {canConfirm:issues.length===0,issues:[...new Set(issues)]};
}
async function bindSources(d){if([1,2].includes(d.creation?.ckVersion))for(const image of Object.values(d.creation.cScreenshots||{}))ok(await sha(imageBytes(image))===image.sha256,'Cスクショの内容SHA不一致');if(d.source){ok(await sha(d.source.rawHtml)===d.source.sha256,'正式原本のSHA不一致');
 const doc=new root.DOMParser().parseFromString(d.source.rawHtml,'text/html'),snapshot=root.ABCListSnapshotCoreV13.extract(doc,root.ABC_INTEGRATED_CONTRACT);
 ok(canon(snapshot)===canon(d.source.snapshot),'正式原本と照合用表データが不一致');const inspected=root.ABCForecastPackageV18.inspect(root.ABC_INTEGRATED_CONTRACT,snapshot);
 ok(d.source.preResultAccepted===inspected.packageExportAllowed&&inspected.packageExportAllowed,'正式原本が結果前資料としての形式検査に合格していません');
}return d;}
async function seal(d,kind,previous=null,now=Date.now()){
 d=clone(d);validateDay(d);ok(Number.isFinite(now),'保存日時が不正');await bindSources(d);ok(['UNVERIFIED','CONFIRMED'].includes(kind),'保存区分不正');const g=gate(d,now);if(kind==='CONFIRMED')ok(g.canConfirm,g.issues.join('／'));
 const header={id:d.date+'|'+((previous?.revision||0)+1),date:d.date,revision:(previous?.revision||0)+1,previousSha:previous?.sha256||null};
 if(previous){const p=await verify(previous);ok(previous.date===d.date&&p.kind!=='CONFIRMED','確定済み・別日付への追記は禁止');assertClosedUnchanged(p.day,d,now);}
 const payload=canon({header,format:FORMAT,kind,ruleVersion:RULE,savedAt:new Date(now).toISOString(),day:clone(d),review:g});
 return {...header,payload,sha256:await sha(payload)};
}
async function verify(rec){
 ok(rec&&typeof rec.payload==='string'&&rec.payload.length<60000000&&await sha(rec.payload)===rec.sha256,'保存内容のSHA不一致');const p=JSON.parse(rec.payload);validateDay(p.day);await bindSources(p.day);
 ok(p.format===FORMAT&&p.ruleVersion===RULE&&['UNVERIFIED','CONFIRMED'].includes(p.kind)&&p.day.date===rec.date&&rec.id===rec.date+'|'+rec.revision&&Number.isInteger(rec.revision)&&rec.revision>0,'保存識別・版が不正');
 ok(canon(p.header)===canon({id:rec.id,date:rec.date,revision:rec.revision,previousSha:rec.previousSha})&&Number.isFinite(Date.parse(p.savedAt)),'保存メタデータ・日時が不一致');
 const g=gate(p.day,Date.parse(p.savedAt));ok(canon(g)===canon(p.review),'保存時の照合状態が不一致');if(p.kind==='CONFIRMED')ok(g.canConfirm,'未照合記録の確定昇格を拒否');return p;
}
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function open(){
 ok(root.indexedDB,'この環境で端末内保存は使えません');
 return new Promise((resolve,reject)=>{let done=false;const r=root.indexedDB.open(DB,1),timer=setTimeout(()=>stop(Error('保存領域の応答待ちで停止しました。既存データは保持しています')),10000);
 function stop(e){if(done)return;done=true;clearTimeout(timer);reject(e)}
 r.onupgradeneeded=()=>{if(done){r.transaction.abort();return;}const s=r.result.createObjectStore('days',{keyPath:'id'});s.createIndex('date','date',{unique:false})};
 r.onblocked=()=>stop(Error('別画面が保存領域を使用中です。既存データを保持して停止しました'));
 r.onerror=()=>stop(r.error||Error('保存領域を開けません'));
 r.onsuccess=()=>{if(done){r.result.close();return;}done=true;clearTimeout(timer);const db=r.result;db.onversionchange=()=>db.close();resolve(db)};
 });
}
async function readAll(){const db=await open();try{const records=await req(db.transaction('days').objectStore('days').getAll());const sorted=records.sort((a,b)=>a.date.localeCompare(b.date)||a.revision-b.revision);for(const r of sorted)await verify(r);return validateChain(sorted);}finally{db.close()}}
function assertDraftBase(expected,current){
 const token=r=>r?{id:r.id,date:r.date,revision:r.revision,sha256:r.sha256}:null;
 ok(canon(token(expected))===canon(token(current)),'別タブ等で保存版が変わりました。作成中の内容を保持して停止します。最新版を確認してください');
}
function resumable(parsed,now=Date.now()){
 // Resume an unverified revision to add another venue, even after earlier races
 // close. updateSelection and assertClosedUnchanged still freeze closed races.
 return parsed?.kind==='UNVERIFIED'&&Number.isFinite(now);
}
async function resumeDraft(record,latest,now=Date.now()){
 assertDraftBase(record,latest);const p=await verify(record);ok(resumable(p,now),'最新の未照合版だけ作成を再開できます');return clone(p.day);
}
function checkAppend(record,parsed,baseline,old,now=Date.now()){
 const last=old.at(-1);ok(canon(old)===canon(baseline)&&record.revision===(last?.revision||0)+1&&record.previousSha===(last?.sha256||null),'保存競合。作成中の内容を保持し、追記せず停止');
 if(last){const prior=JSON.parse(last.payload);ok(prior.kind!=='CONFIRMED','確定済みの日付には追記できません');assertClosedUnchanged(prior.day,parsed.day,now);ok(prior.kind!==parsed.kind||canon(prior.day)!==canon(parsed.day),'同じ内容は既に保存済みです。重複保存を停止しました');}
 if(parsed.kind==='CONFIRMED')ok(gate(parsed.day,now).canConfirm,'保存直前に締切・照合状態が変わりました');
}
async function append(record){
 record=clone(record);const parsed=await verify(record),baseline=(await readAll()).filter(r=>r.date===record.date);
 checkAppend(record,parsed,baseline,baseline);const db=await open();try{await new Promise((resolve,reject)=>{let cause=null;const t=db.transaction('days','readwrite'),s=t.objectStore('days'),read=s.index('date').getAll(record.date);
 read.onsuccess=()=>{try{const old=read.result.sort((a,b)=>a.revision-b.revision);checkAppend(record,parsed,baseline,old,Date.now());s.add(record)}catch(e){cause=e;t.abort()}};
 t.oncomplete=resolve;t.onabort=()=>reject(cause||t.error||Error('保存が完了しませんでした。作成中の内容を保持しています'));t.onerror=()=>reject(t.error||Error('保存に失敗しました。作成中の内容を保持しています'));
 });}finally{db.close()}
 const after=await readAll(),actual=after.find(x=>x.id===record.id);ok(actual?.payload===record.payload&&actual.sha256===record.sha256,'保存後再読込不一致。再保存せず履歴を確認してください');return actual;
}
// A non-restorable emergency export. Never accepted by parseBackup or the formal save gate.
async function draftSafetyCopy(d,now=Date.now()){
 ok(d&&typeof d==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date||''),'退避する作成中の一覧がありません');
 ok(Number.isFinite(now),'退避時刻が不正');
 const body={format:'ABC_INTEGRATED_UNSAVED_DRAFT_V1',classification:'UNVERIFIED_UNSAVED',date:d.date,exportedAt:new Date(now).toISOString(),warning:'未保存の入力控え。正式記録・保存履歴・復元データではありません。',day:clone(d)};
 const canonical=canon(body);ok(canonical.length<=60000000,'退避JSONが60MBを超えています。入力と元PDFを別途保管してください');
 return {...body,sha256:await sha(canonical)};
}
async function verifyDraftSafetyCopy(d){
 ok(d?.format==='ABC_INTEGRATED_UNSAVED_DRAFT_V1'&&d.classification==='UNVERIFIED_UNSAVED','未保存控えの形式不正');
 const {sha256,...body}=d;ok(typeof sha256==='string'&&await sha(canon(body))===sha256,'未保存控えのSHA不一致');
 ok(body.date===body.day?.date&&Number.isFinite(Date.parse(body.exportedAt)),'未保存控えの日付不一致');
 return clone(body.day); // Verify for read-only inspection only; never writes or confirms.
}
// Emergency safety copies are never valid saved revisions. Validate the entire day
// and any attached forecast source for read-only display; never touch IndexedDB.
async function inspectDraftSafetyCopy(copyFile){
 const d=await verifyDraftSafetyCopy(copyFile);
 validateDay(d);
 await bindSources(d);
 compute(d); // Reject incoherent or incomplete choices before showing any partial UI.
 return {date:d.date,exportedAt:copyFile.exportedAt,day:clone(d),
  status:'UNSAVED_READONLY',mayWrite:false,mayConfirm:false,
  message:'未保存入力控え：閲覧専用。正式保存・復元・予想時刻の証明ではありません。'};
}
async function parseBackup(b){ok(b?.format==='ABC_INTEGRATED_BACKUP_V1'&&Array.isArray(b.records)&&b.records.length>0&&b.records.length<=300,'バックアップ形式不正');const seen=new Set();for(const r of b.records){ok(!seen.has(r.id),'バックアップ内の重複');seen.add(r.id);await verify(r)}return validateChain(b.records);}
// Read-only preflight. Always inspect the CURRENT origin's existing ledger and the full backup.
// This preview is NOT authorization, and the write transaction still rechecks emptiness atomically.
async function inspectEmptyBackupRestore(backup){
 const records=await parseBackup(backup);
 const existing=await readAll();
 const dates=[...new Set(records.map(r=>r.date))].sort();
 const classifications=records.reduce((acc,r)=>{const k=JSON.parse(r.payload).kind;acc[k]=(acc[k]||0)+1;return acc;},{UNVERIFIED:0,CONFIRMED:0});
 const backupSha=await sha(canon({format:'ABC_INTEGRATED_BACKUP_V1',records}));
 return {status:existing.length?'BLOCK_EXISTING_HISTORY':'READY_EMPTY_LEDGER',canRestore:existing.length===0,
  existingCount:existing.length,backupRecords:records.length,backupDays:dates.length,
  firstDate:dates[0],lastDate:dates.at(-1),classifications,backupSha,
  warning:'これはJSONの整合性確認です。正式な予想時刻・公式照合・予想の真正性を保証しません。'};
}
// Diagnostic ONLY, including after a process crash or ambiguous restore result.
// Never authorizes a retry, never writes, and distinguishes exact recovery from
// partial/divergent histories without deleting, resetting or merging records.
async function diagnoseBackupLedger(backup){
 const expected=await parseBackup(backup);
 const actual=await readAll();  // throws closed if IndexedDB or a stored record is corrupt
 const byExpected=new Map(expected.map(r=>[r.id,r]));
 const byActual=new Map(actual.map(r=>[r.id,r]));
 let matching=0,altered=0,missing=0,extra=0;
 for(const r of expected){const x=byActual.get(r.id);
  if(!x)missing++;
  else if(canon(x)===canon(r))matching++;
  else altered++;
 }
 for(const r of actual)if(!byExpected.has(r.id))extra++;
 const status=actual.length===0?'EMPTY_NOT_RESTORED':
   !missing&&!altered&&!extra?'MATCH_EXACT':
   altered?'STOP_DIFFERENT_RECORD':extra?'STOP_EXTRA_HISTORY':'STOP_PARTIAL_HISTORY';
 return {status,readOnly:true,mayRetryAutomatically:false,
  backupCount:expected.length,localCount:actual.length,matching,missing,altered,extra,
  backupSha:await sha(canon({format:'ABC_INTEGRATED_BACKUP_V1',records:expected})),
  localSha:await sha(canon({format:'ABC_INTEGRATED_BACKUP_V1',records:actual})),
  message:status==='MATCH_EXACT'?'指定JSONの全版が端末内に完全一致します。':
    status==='EMPTY_NOT_RESTORED'?'端末内履歴0件。指定JSONはまだ復元されていません。':
    '端末内と指定JSONに差があります。自動再試行・上書き・削除をしないでください。'};
}
// Explicit, all-or-nothing recovery for a COMPLETELY EMPTY on-device ledger.
// No put/delete/clear and no updates to a nonempty ledger, even for unrelated days.
// The IndexedDB readwrite transaction makes the empty check and all inserts atomic.
async function restoreEmptyBackup(backup){
 const records=await parseBackup(backup); // verify every record and the complete parent/revision chain BEFORE write
 ok(records.length>0,'復元する履歴がありません');
 const db=await open();
 try{
  await new Promise((resolve,reject)=>{
   let reason=null,issued=false;
   const tx=db.transaction('days','readwrite'),store=tx.objectStore('days'),count=store.count();
   count.onsuccess=()=>{
    try{
     ok(count.result===0,'保存領域には既に履歴があります。上書き・統合・重複復元は行いません');
     issued=true;
     for(const record of records)store.add(clone(record));
    }catch(e){reason=e;try{tx.abort()}catch(_){}}
   };
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(reason||tx.error||Error('復元を中止しました。端末内履歴は変更していません'));
   tx.onerror=()=>{if(!reason)reason=tx.error||Error('復元に失敗しました。自動再試行しません')};
  });
 }finally{db.close()}
 // A failure here could mean the transaction succeeded but the readback failed.
 // The UI must tell the user to inspect the ledger rather than retry.
 const readback=await readAll();
 ok(readback.length===records.length&&records.every((r,i)=>
  r.id===readback[i].id&&r.sha256===readback[i].sha256&&r.payload===readback[i].payload),
 '復元後の再読込が一致しません。自動再試行せず、履歴を確認してください');
 return {count:records.length,days:new Set(records.map(r=>r.date)).size,kind:'RESTORED_TO_PREVIOUSLY_EMPTY_LEDGER'};
}
function validateChain(records){const sorted=[...records].sort((a,b)=>a.date.localeCompare(b.date)||a.revision-b.revision),parents=new Map();for(const r of sorted){const last=parents.get(r.date);ok(r.revision===(last?.revision||0)+1&&r.previousSha===(last?.sha256||null)&&(!last||JSON.parse(last.payload).kind!=='CONFIRMED'),'履歴の欠落・競合・確定後の追記');parents.set(r.date,r)}return sorted;}
function sections(contract,d){const c=compute(d),sections=contract.sections.map(x=>({id:x.id,title:x.title.replace(/【[^】]*】/g,''),columns:x.columns,rows:[]})),by=Object.fromEntries(sections.map(x=>[x.id,x]));
 const add=(name,values)=>by[name].rows.push(by[name].columns.map(k=>String(values[k]??'―'))),stats=(name,rs,hy=false,extra={})=>{const active=hy?rs.filter(r=>r.hypothesis):rs.filter(r=>r.normal);add(name,{...extra,'レース数':rs.length,'確定数':0,'的中数':0,'投資額':active.reduce((n,r)=>n+(hy?r.hypothesis.length*100:r.normal.stake),0),'的中払戻':'―','回収率':'―','収支':'―'})};
 for(const x of c.rows){const r=x.record,s=x.selection,base={'締切':r.deadline,'場・R':r.venue+r.race_number+'R','色':x.color||'','狙い':s.aim==='指定なし'?'':s.aim,'k除外':s.k,'k型':s.k,'買い目':x.normalExpression,'投資':x.normal?x.normal.stake:'―','推し':s.cPush?'推し':'','1号艇2連対率':(x.cOneRate??r.entrants[0].national_top2_rate_percent).toFixed(2)+'%','2連対率順':x.cOrderDisplay||'未照合','除外':x.cExcludedDisplay||'未照合'};
  add(x.group.toLowerCase(),base);if(x.eligible)add(x.group.toLowerCase()+'-hypo',{...base,'仮説買い目':x.hypExpression,'指定':x.group==='B'?s.bAxis||'':x.group==='C'?s.cDesignation||'':'','点数':x.hypothesis?x.hypothesis.length:'','投資':x.hypothesis?x.hypothesis.length*100:''});
  if(x.group==='A')add('a-grade',{...base,'①級別':r.entrants[0].grade,'級別配置':r.entrants.map(b=>b.grade[0]).join('')});
 }
 for(const group of ['A','B','C']){const rs=c.rows.filter(r=>r.group===group),g=group.toLowerCase();stats(g+'-total',rs);stats(g+'-hypo-total',rs.filter(r=>r.eligible),true,{'区分':group+'仮説 '+({A:10,B:8,C:16}[group])+'点'});if(g!=='c')for(const color of ['🔴','🔵','🟢'])stats(g+'-color',rs.filter(r=>r.color===color),false,{'色':color});}
 by['b-hypo'].title='B仮説【8点・第2軸指定】';by['b-hypo-total'].title='B仮説集計【8点】';by['a-hypo'].title='A🔴10点仮説';by['c-hypo'].title='C仮説【16点】';
 for(const aim of ['◎','○']){const rs=c.rows.filter(r=>r.group!=='C'&&r.selection.aim===aim);add('ab-aim',{'狙い':aim,'対象数':rs.length,'確定数':0,'的中数':0,'予定投資':rs.reduce((n,r)=>n+(r.normal?.stake||0),0),'確定投資':0})}
 const aims=c.rows.filter(r=>r.group!=='C'&&['◎','○'].includes(r.selection.aim));add('ab-aim',{'狙い':'合計（◎○）','対象数':aims.length,'確定数':0,'的中数':0,'予定投資':aims.reduce((n,r)=>n+(r.normal?.stake||0),0),'確定投資':0});
 stats('total',c.rows);
 for(const name of ['a-one','a-mark','c-mark'])add(name,{'確定数':0});for(const label of ['推し','推し以外','全体'])add('c-push',{'区分':label,'対象数':c.rows.filter(r=>r.group==='C'&&(label==='全体'||r.selection.cPush===(label==='推し'))).length,'結果確定数':0,'配当確認数':0});
 for(const name of ['crossfire','crossfire-total','cf-image-master','cf-image-races','cf-image-total']){const src=d.source?.snapshot.sections.find(s=>s.id===name);if(src)by[name].rows=clone(src.rows);}
 if([1,2].includes(d.creation?.ckVersion)&&!d.source){
  const active=[];
  for(const x of c.rows){const cf=crossfire(x,d,contract);if(!cf)continue;active.push(x);const base={'締切':x.record.deadline,'場・R':x.record.venue+x.record.race_number+'R','色':x.color||'','区分':x.group,'型':cf.pattern==='24'?'②④型':'③⑤型','除外':circ(cf.excluded),'k除外':circ(cf.excluded),'差替':cf.replaced?'差替⑥':'―','点数':6,'投資':600};if(d.creation.ckVersion===1)add('crossfire',{...base,'クロスファイヤー買い目':cf.legacy.expression});add('cf-image-races',{...base,'買い目':cf.image.expression});}
  for(const name of ['crossfire-total','cf-image-total'])for(const group of ['A','B','合計']){const rs=name==='crossfire-total'&&d.creation.ckVersion>=2?[]:active.filter(x=>group==='合計'||x.group===group);add(name,{'区分':group,'対象R':rs.length,'確定R':0,'的中R':0,'予定投資':rs.length*600,'確定投資':0});}
  for(const pattern of ['24','35'])add('cf-image-master',{'型':pattern==='24'?'②④型':'③⑤型','画像原型買い目':contract.crossfire_image_policy.masters[pattern].join('\n'),'点数':6,'投資':600});
 }

 return sections;
}
return {DB,RULE,FORMAT,canon,clone,sha,sha256Bytes,id,allRaces,rank,expr,expand,bets,eqBets,defaults,readMembers,c16,authorC,cScreenshotRanking,authorOfficialC,addCScreenshots,identifyCScreenshot,authorCScreenshot,crossfire,createImageDay,canCorrectCImageDate,correctCImageDate,stageStandaloneC,setCImageOCR,updateSelection,validateChain,validateDay,applySource,compute,gate,bindSources,seal,verify,readAll,append,assertDraftBase,resumable,resumeDraft,checkAppend,parseBackup,inspectEmptyBackupRestore,restoreEmptyBackup,diagnoseBackupLedger,draftSafetyCopy,verifyDraftSafetyCopy,inspectDraftSafetyCopy,sections};
});
