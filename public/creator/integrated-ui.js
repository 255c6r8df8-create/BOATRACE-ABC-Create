/* v23 successor: one intake, one review card, one 26-section view and one date ledger. */
(async()=>{'use strict';
const $=id=>document.getElementById(id),C=ABCIntegrated,contract=JSON.parse($('template-contract').textContent),design=JSON.parse($('design-data').textContent);globalThis.ABC_INTEGRATED_CONTRACT=contract;
let day=null,computed=null,selected=null,archives=[],importedRecords=[],restoreReady=false,shownRecord=null,busy=false,generation=0,draftBase=null,draftConflict=false;
// Uncommitted C form fields belong to a race within this authoring session only.
let cEditorKey=null;const cDrafts=new Map(),quickDrafts=new Map();
const daily=ABCDailyView.create({getDay:()=>day,getComputed:()=>computed,getShownRecord:()=>shownRecord,getArchives:()=>archives,isBusy:()=>busy,run:fn=>action(fn),refresh:()=>refresh(),notify:t=>note(t),C,contract});
const status=t=>{$('status').textContent=t},node=(tag,t)=>{const e=document.createElement(tag);e.textContent=t;return e},copy=C.clone;
const notCancelled=r=>!(day?.fetchReport?.cancelledRaces||[]).some(x=>x.venue===r.venue&&x.raceNumber===r.race_number);
const savedTime=t=>new Date(t).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',hour12:false})+' JST';
const report=t=>{$('review-status').textContent=t};
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type})),a=node('a','');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function note(t){status(t);$('status').scrollIntoView({block:'nearest'});}
// Transfer the current day through a same-tab navigation (no iPhone popup).
const moveToResults=document.createElement('button');moveToResults.id='open-result-viewer';moveToResults.type='button';moveToResults.className='primary';moveToResults.disabled=true;moveToResults.textContent='この一覧を結果更新へ';$('export-text').before(moveToResults);
function syncControls(){
 const history=!!shownRecord,gate=day&&!history?C.gate(day):null;
 for(const id of ['date','pdfs','parse','source','load-source','cancel-source','pdf-checked','coverage-checked'])$(id).disabled=busy||history;
 $('fetch-auto').disabled=busy||history||!!day?.source||!!day?.sourcePending; $('c-official-extract').disabled=busy||history||!day||!!day.source||!!day.sourcePending;
 $('fetch-auto').textContent=day?'別の開催場を追加・レースを選択':'選んだ情報を公式サイトから取得';
 for(const id of ['export-text','open-result-viewer'])$(id).disabled=busy||!day;
 $('header-result-update').disabled=busy;
 for(const id of ['history-refresh','prev-month','next-month','history-month'])$(id).disabled=busy;
 document.querySelectorAll('#history button,#calendar button,#races button,#list-host button').forEach(b=>b.disabled=busy);
 if(Object.keys(day?.creation?.cOriginals||{}).length){$('source').disabled=true;$('load-source').disabled=true;}
 $('cancel-source').disabled=busy||history||!day?.sourcePending;
 const cRecord=$('c-record'),cRace=(day?C.allRaces(day):[]).find(r=>C.id(r)===$('c-race').value);
 const canAuthor=day?.creation?.version===1&&!day.source&&!day.sourcePending&&!history&&cRace&&Date.now()<Date.parse(day.date+'T'+cRace.deadline+':00+09:00')&&!day.creation.cOriginals[C.id(cRace)];
 for(const id of ['c-race','c-order','c-excluded','c-note','c-accept','c-record','c-image','c-rank-preview',...Array.from({length:6},(_,i)=>'c-rate-'+(i+1))])$(id).disabled=busy||!canAuthor&&(id!=='c-race'||history||!day?.creation||!!day?.source);
 cRecord.disabled=busy||!canAuthor||![1,2].includes(day?.creation?.ckVersion);
 $('c-images').disabled=busy||history||!day?.creation||![1,2].includes(day.creation.ckVersion)||!!day.source||!!day.sourcePending;
 document.querySelectorAll('#c-image-gallery input,#c-image-gallery select').forEach(e=>{e.disabled=busy||history||!!day?.source||e.dataset.locked==='true'});
 $('parse').disabled=busy||history||!!day;$('c-image-start').disabled=busy||history||!!day;
 $('new-entry').disabled=busy;$('save-accept').disabled=busy||history||!day;
 $('save-pending').disabled=busy||history||!day||draftConflict;$('save-verified').disabled=busy||history||!gate?.canConfirm||draftConflict;
 $('fetch-race').disabled=busy||history||!!day?.source;for(const e of document.querySelectorAll('#venue-list input,#venue-all,#venue-clear'))e.disabled=busy||history||!!day?.source;
 $('c-quick-file').disabled=busy||history||!!day?.source||!!day?.sourcePending;document.querySelectorAll('#c-quick-gallery input,#c-quick-gallery select,#c-quick-gallery button').forEach(e=>{e.disabled=busy||history||e.dataset.locked==='true'});
 document.querySelectorAll('#review-card fieldset').forEach(f=>{const r=computed?.rows.find(r=>r.key===selected);f.disabled=busy||history||!r||Date.now()>=Date.parse(day.date+'T'+r.record.deadline+':00+09:00')});
}
function edit(key,patch){try{if(busy||shownRecord)throw Error('保存済み／処理中は編集できません');day=C.updateSelection(day,key,patch);generation++;$('save-accept').checked=false;refresh()}catch(e){note('停止：'+e.message);refresh()}}
async function action(fn){if(busy){note('処理中です。完了表示を待ってから操作してください。');return;}busy=true;status('処理中…');syncControls();document.body.setAttribute('aria-busy','true');try{await fn()}catch(e){note('停止：'+e.message)}finally{if($('status').textContent==='処理中…')status('操作が完了しました。');busy=false;document.body.removeAttribute('aria-busy');syncControls();}}
function refuseDiscardDraft(){if(day&&!shownRecord)throw Error('作成中の未保存入力があります。先にテキストを書き出すか端末内に保存し、「新規作成へ戻る」で明示的に終了してください。現在の入力は保持しました。');}
function reset(){cDrafts.clear();quickDrafts.clear();cEditorKey=null;generation++;draftBase=null;draftConflict=false;day=null;computed=null;selected=null;shownRecord=null;$('review-card').replaceChildren();$('races').replaceChildren();$('list-host').replaceChildren();$('save-verified').disabled=true;$('save-pending').disabled=true;$('save-accept').checked=false;$('pdf-checked').checked=false;$('coverage-checked').checked=false;$('source').value='';report('PDFを添付して抽出してください。');$('list-caption').textContent='';renderCAuthor();daily.sync();syncControls();status('新規作成：PDFを選択して読み取ってください。');}
let libraryPromise;
function moduleURL(id){const bytes=Uint8Array.from(atob($(id).textContent.trim()),c=>c.charCodeAt(0));return URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));}
async function libraries(){if(!libraryPromise)libraryPromise=(async()=>{const main=moduleURL('pdfLibrary'),worker=moduleURL('pdfWorker'),adapter=moduleURL('pdfFileAdapter'),[lib,reader]=await Promise.all([import(main),import(adapter)]);lib.GlobalWorkerOptions.workerSrc=worker;return{lib,reader}})().catch(e=>{libraryPromise=null;throw e});return libraryPromise;}
async function parsePdf(inputFiles=null,fetchReport=null,append=false){if(!append)refuseDiscardDraft();else if(!day||shownRecord||day.source||day.sourcePending)throw Error('既存の一覧には追加できません。');const ticket=generation,date=$('date').value,files=inputFiles||[...$('pdfs').files];if(!files.length||files.length>24)throw Error('公式PDFを1〜24場選択してください');if(files.some(f=>f.size>5*1024*1024)||files.reduce((n,f)=>n+f.size,0)>30*1024*1024)throw Error('PDFは各5MB・合計30MBまで');
 const engine=ABC_LIST_ENGINE.create(design);engine.fresh(date);if(!append){await reloadLedger();const existing=archives.filter(r=>r.date===date).at(-1);if(existing){month=date.slice(0,7);calendar();await showHistory(date);const parsed=await C.verify(existing);throw Error(parsed.kind==='CONFIRMED'?'この日は確定済みです。履歴から閲覧してください。':C.resumable(parsed)?'この日は保存済みです。履歴の「未照合版から作成を再開」を使ってください。既存の買い目・C指定は保持しています':'この日は保存済みで締切後です。履歴から閲覧してください。後から指定を補完できません');}draftBase=null;draftConflict=false;}const candidates=[],members={},venues=new Set(append?C.allRaces(day).map(r=>r.venue):[]);status('PDFを端末内で読取中…');const {lib,reader}=await libraries();
 for(const f of files){
  try{const context=ABC_PDF_PROFILE.contextForFile(f.name,date);if(venues.has(context.venue))throw Error('同じ場のPDFが重複');venues.add(context.venue);const bytes=new Uint8Array(await f.arrayBuffer()),sha=await C.sha(bytes),pages=await reader.extractPdf(bytes,lib),candidate=ABC_PDF_PROFILE.parse(pages,{date,url:context.url,listingUrl:context.listingUrl,sha256:sha});Object.assign(members,C.readMembers(pages,candidate.races));candidates.push(candidate);if(ticket!==generation)throw Error('読取中に添付条件が変更されました');}
  catch(e){if(!fetchReport||ticket!==generation)throw e;fetchReport.failures.push({venue:f.name.slice(2,4),message:'出走表の解析を確認できません：'+(e?.message||String(e))});}
 }
 if(!candidates.length)throw Error('読み取れる公式出走表がありません。'+(fetchReport?.failures||[]).map(x=>x.venue+'：'+x.message).join('／'));
 if(fetchReport)fetchReport.loaded=candidates.map(c=>c.source.url.match(/\/pb(\d{2})\d{4}\.pdf$/)?.[1]).filter(Boolean);
 const input=ABC_PDF_STAGING.combine(engine,append?day.input:engine.fresh(date),candidates,{originalChecked:true,columnChecked:true});
 if(append){const prior=day.fetchReport||{requested:[],loaded:[],cancelledRaces:[],failures:[]};const next=copy(day);next.input=input;Object.assign(next.members,members);for(const r of input.races)if(!next.selections[C.id(r)])next.selections[C.id(r)]=C.defaults();next.originChecked=false;next.coverageChecked=false;if(fetchReport)next.fetchReport={...prior,...copy(fetchReport),requested:[...new Set([...(prior.requested||[]),...fetchReport.requested])],loaded:[...new Set([...(prior.loaded||[]),...fetchReport.loaded])],notHeld:[...new Set([...(prior.notHeld||[]),...(fetchReport.notHeld||[])])],cancelledRaces:[...(prior.cancelledRaces||[]),...fetchReport.cancelledRaces],failures:[...(prior.failures||[]).filter(x=>!fetchReport.requested.includes(x.venue)),...fetchReport.failures]};C.validateDay(next);day=next;}
 else{day={format:C.FORMAT,ruleVersion:C.RULE,date,design:copy(design),input,members,selections:{},source:null,creation:{version:1,ckVersion:2,cOriginals:{},cScreenshots:{},cStandalone:{}},originChecked:false,coverageChecked:false};if(fetchReport)day.fetchReport=copy(fetchReport);for(const r of input.races)day.selections[C.id(r)]=C.defaults();}
 generation++;shownRecord=null;$('pdf-checked').checked=false;$('coverage-checked').checked=false;$('save-accept').checked=false;
 let cStatus='';if(date===new Date(Date.now()+9*3600000).toISOString().slice(0,10)){try{cStatus=await extractOfficialC()}catch(e){cStatus='C自動抽出未完了：'+e.message}}
 refresh();daily.selectInitial();note('読取完了：'+candidates.length+'場・'+input.races.length+'R・'+input.races.length*6+'艇。'+cStatus+' 6艇・指定を確認し、未照合で保存できます。'+(fetchReport?.notHeld?.length?'【この日は開催なし】'+fetchReport.notHeld.map(v=>ABC_PDF_PROFILE.supported()[v]).join('・')+'。':'')+(fetchReport?.cancelledRaces?.length?'【中止・順延は一覧から除外】'+[...new Set(fetchReport.cancelledRaces.map(x=>x.venue+'：'+x.reason))].join('／')+'。':'')+(fetchReport?.failures.length?'【未取得・未解析】'+fetchReport.failures.map(x=>x.venue+'：'+x.message).join('／'):'')+' 外部原本の添付は任意です。');}
async function fetchOfficial(){
 const append=!!day&&!shownRecord;if(!append)refuseDiscardDraft();const date=$('date').value;ABC_LIST_ENGINE.create(design).fresh(date);if(!append){await reloadLedger();if(archives.some(r=>r.date===date))throw Error('この日は保存済みです。保存履歴から閲覧または作成再開してください。');}
 status('公式の開催一覧を確認中…');
 const scheduleResponse=await fetch('/api/schedule?date='+encodeURIComponent(date),{cache:'no-store'}),schedule=await scheduleResponse.json().catch(()=>({}));
 if(!scheduleResponse.ok)throw Error(schedule.error||'公式の開催一覧を取得できません。');
 if(schedule.date!==date||!Array.isArray(schedule.venues)||!schedule.venues.length||schedule.venues.length>24||new Set(schedule.venues).size!==schedule.venues.length||schedule.venues.some(v=>!/^\d{2}$/.test(v)))throw Error('公式の開催一覧を確認できません。');
 if(!Array.isArray(schedule.statuses)||schedule.statuses.length!==schedule.venues.length||schedule.venues.some(v=>schedule.statuses.filter(x=>x.venue===v).length!==1)||schedule.statuses.some(x=>typeof x.blocked!=='boolean'||typeof x.reason!=='string'||x.cancelledFrom!==null&&(!Number.isInteger(x.cancelledFrom)||x.cancelledFrom<1||x.cancelledFrom>12)))throw Error('公式の開催状況を確認できません。');
 const chosenVenues=[...document.querySelectorAll('#venue-list input:checked')].map(e=>e.value),chosenRace=$('fetch-race').value;
 const unavailable=chosenVenues.filter(v=>!schedule.venues.includes(v));
 const requested=chosenVenues.length?chosenVenues.filter(v=>schedule.venues.includes(v)):schedule.venues;
 if(!requested.length)throw Error('選択した開催場はこの日の公式開催一覧にありません。');
 const already=append?new Set(day.input.races.map(r=>r.venue)):new Set();
 const toFetch=append?requested.filter(v=>!already.has(ABC_PDF_PROFILE.supported()[v])):requested;
 const report={mode:'OFFICIAL_AUTOMATIC',date,source:schedule.source,retrievedAt:schedule.retrievedAt,requested:copy(requested),targetRace:chosenRace?{venue:ABC_PDF_PROFILE.supported()[requested[0]],raceNumber:Number(chosenRace)}:null,loaded:[],notHeld:copy(unavailable),cancelledRaces:[],failures:[]},files=[],eligible=[];let total=0;
 for(const venue of requested){
  const venueStatus=schedule.statuses.find(x=>x.venue===venue),venueName=ABC_PDF_PROFILE.supported()[venue];
  if(!venueName||venueStatus.blocked){report.failures.push({venue,message:venueStatus.reason||'開催場を確認できません'});continue;}
  if(venueStatus.cancelledFrom!==null){for(let n=venueStatus.cancelledFrom;n<=12;n++)report.cancelledRaces.push({venue:venueName,venueCode:venue,raceNumber:n,reason:venueStatus.reason});if(venueStatus.cancelledFrom===1)continue;}
  if(toFetch.includes(venue))eligible.push(venue);
 }
 if(report.targetRace&&report.cancelledRaces.some(x=>x.venue===report.targetRace.venue&&x.raceNumber===report.targetRace.raceNumber)){const available=requested.find(v=>!report.cancelledRaces.some(x=>x.venue===ABC_PDF_PROFILE.supported()[v]&&x.raceNumber===Number(chosenRace))&&!schedule.statuses.find(x=>x.venue===v)?.blocked);if(!available)throw Error('選択したレースは中止・順延または開催状態が未確認です。');report.targetRace.venue=ABC_PDF_PROFILE.supported()[available];}
 if(append&&!toFetch.length){if(!chosenRace)throw Error('選択した開催場は取得済みです。レース番号を選ぶか、別の開催場を追加してください。');daily.focus(ABC_PDF_PROFILE.supported()[requested[0]]+'|'+Number(chosenRace));note('取得済みの出走表から指定レースを表示しました。');return;}
 let completed=requested.length-eligible.length;
 for(let i=0;i<eligible.length;i+=2){
  const batch=eligible.slice(i,i+2);status('公式出走表を取得中… '+completed+' / '+requested.length+'場');
  const results=await Promise.all(batch.map(async venue=>{
   try{const response=await fetch('/api/pdf?date='+encodeURIComponent(date)+'&venue='+encodeURIComponent(venue),{cache:'no-store'});if(!response.ok){const e=await response.json().catch(()=>({}));throw Error(e.error||'出走表を取得できません');}return {venue,blob:await response.blob()};}
   catch(e){return {venue,error:e?.message||String(e)};}
   finally{completed++;status('公式出走表を取得中… '+completed+' / '+requested.length+'場');}
  }));
  for(const result of results){if(result.error){report.failures.push({venue:result.venue,message:result.error});continue;}const blob=result.blob;if(blob.size>5*1024*1024||total+blob.size>30*1024*1024){report.failures.push({venue:result.venue,message:'出走表の容量上限を超えました'});continue;}total+=blob.size;files.push(new File([blob],'pb'+result.venue+date.slice(5,7)+date.slice(8,10)+'.pdf',{type:'application/pdf'}));}
  if(i+2<eligible.length)await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(!files.length)throw Error('出走表を取得できませんでした。'+report.failures.map(x=>x.venue+'：'+x.message).join('／'));
 await parsePdf(files,report,append);
}
async function loadSource(){if(!day||shownRecord)throw Error('新規作成でPDFを読み取ってください');const ticket=generation,stamp=C.canon(day);const f=$('source').files[0];if(!f||f.size>8000000)throw Error('正式買い目・指定原本HTMLを選択してください（8MB以内）');const raw=await f.text(),doc=new DOMParser().parseFromString(raw,'text/html'),snapshot=ABCListSnapshotCoreV13.extract(doc,contract),inspection=ABCForecastPackageV18.inspect(contract,snapshot);
 if(!inspection.packageExportAllowed)throw Error('原本は未受入：'+inspection.issues.slice(0,5).join('／'));
 const source={rawHtml:raw,sha256:await C.sha(raw),snapshot,preResultAccepted:true};const next=C.applySource(day,source);await C.bindSources(next);if(ticket!==generation||stamp!==C.canon(day)||shownRecord)throw Error('照合中に入力・表示が変更されました');day=next;generation++;shownRecord=null;refresh();note('正式原本を接続しました。原本の買い目・指定とPDFを照合中です。残る不一致をカードで確認してください。');}
function reviewMessages(issues){
 if(!day?.creation||day.source||day.sourcePending)return issues;
 const external=['PDF抽出対象と原本の全対象が一致しません','C指定と正式原本の対象が不一致（再抽出しません）','結果前の正式買い目・指定原本が未接続'];
 return issues.filter(m=>!external.includes(m)&&!m.endsWith('正式買い目・指定原本の対象行なし'));
}
function refresh(){if(!day)return;computed=C.compute(day);const old=selected;selected=computed.rows.some(x=>x.key===old)?old:computed.rows[0]?.key||null;
 $('races').replaceChildren(...computed.rows.map(x=>{const b=node('button',x.group+' '+(x.color||'')+' '+x.record.venue+x.record.race_number+'R '+(x.issues.length?'未照合':'項目一致'));b.type='button';b.dataset.race=x.key;b.setAttribute('aria-pressed',String(x.key===selected));b.onclick=()=>{selected=x.key;refresh()};return b}));
 daily.sync();const gate=C.gate(day);report((shownRecord?.draftSafety?'未保存入力控え（保存記録なし・閲覧専用）／':shownRecord?.imported?'添付バックアップ（端末保存なし・閲覧専用）／':shownRecord?'保存済み・閲覧専用／':'')+'A '+computed.counts.A+'R・B '+computed.counts.B+'R・C '+computed.counts.C+'R／'+(shownRecord?'指定・保存の変更はできません':gate.canConfirm?'照合済み保存が可能':reviewMessages(gate.issues).slice(0,8).join('／')||'新規作成：外部原本とは未照合。UNVERIFIEDで保存できます'));
 $('save-pending').disabled=!!shownRecord;$('save-verified').disabled=!!shownRecord||!gate.canConfirm;$('save-accept').disabled=!!shownRecord;
 $('pdf-checked').checked=day.originChecked;$('coverage-checked').checked=day.coverageChecked;renderCard();renderCAuthor();renderList();daily.render();syncControls();}
function labelInput(label,type,value,change){const e=node('label',''),i=document.createElement('input');i.type=type;i.checked=!!value;i.disabled=!!shownRecord;i.onchange=()=>change(i.checked);e.append(i,document.createTextNode(' '+label));return e;}
function renderCard(){const x=computed.rows.find(x=>x.key===selected),host=$('review-card');host.replaceChildren();if(!x)return;const r=x.record,s=x.selection,closed=Date.now()>=Date.parse(day.date+'T'+r.deadline+':00+09:00'),readonly=!!shownRecord||closed;
 host.append(node('h3',x.group+' '+r.venue+r.race_number+'R／締切 '+r.deadline),daily.sourceLinks(r));
 const hint=node('p','⇆ 表は左右にスワイプできます');hint.className='scroll-hint';host.append(hint);const box=node('div','');box.className='horizontal';box.tabIndex=0;box.setAttribute('role','region');box.setAttribute('aria-label','出走6艇。横にスクロールできます');const t=node('table',''),head=node('thead',''),tr=node('tr','');['艇','登録番号','選手名','級別','PDF全国期別勝率',x.cRateSource==='MY_PREDICTION_SCREENSHOT'?'C根拠画像 全国期別2連率':'PDF全国期別2連対率'].forEach(h=>tr.append(node('th',h)));head.append(tr);t.append(head);const body=node('tbody','');
 r.entrants.forEach((b,i)=>{const line=node('tr',''),m=x.members[i],rate=x.cRateSource==='MY_PREDICTION_SCREENSHOT'?day.creation.cOriginals[x.key].rates[i]:b.national_top2_rate_percent;[b.boat_number,m?.registration_number||'未取得',m?.player_name||'未取得',b.grade??'未確認',b.national_win_rate===null?'未確認':b.national_win_rate.toFixed(2),rate===null||rate===undefined?'未確認':rate.toFixed(x.cRateSource==='MY_PREDICTION_SCREENSHOT'?2:1)+'%'].forEach(v=>line.append(node('td',String(v))));body.append(line)});t.append(body);box.append(t);host.append(box);
 if(x.group==='C'&&x.cRateSource==='OFFICIAL_PERIOD_FILE')host.append(node('p','C抽出根拠：公式期別1コース2連対率 '+x.cCourseRate+'%（適用2026年7月〜12月）／買い目順位は全国期別2連対率。'+(x.cAfterDeadline?'【締切後の事後参考。締切前の予想ではありません】':'')));
 if(x.group==='C'&&x.cRateSource==='MY_PREDICTION_SCREENSHOT'){const c=day.creation.cOriginals[x.key];host.append(node('p','C根拠：公式マイ予想スクショ（本人確認値）／全国期別2連率 ①〜⑥：'+c.rates.join('・')+'%／6艇順位 '+c.fullOrder+'／除外後 '+c.order));}
 host.append(node('p','通常買い目：'+(x.normalExpression||'原本不足・未照合')),node('p','仮説買い目：'+(x.hypExpression|| (x.eligible?'未指定（買い目・点数・投資は空欄）':'対象外'))));
 const controls=node('fieldset','');controls.disabled=readonly;controls.append(node('legend',readonly?'指定（保存済み／締切後は閲覧専用）':'買い目・指定確認'));
 if(x.group!=='C'){
  for(const aim of ['◎','○','指定なし']){const l=node('label',''),i=document.createElement('input');i.type='radio';i.name='aim';i.value=aim;i.checked=s.aim===aim;i.onchange=()=>{edit(x.key,{aim,reviewed:false})};l.append(i,document.createTextNode(' '+aim));controls.append(l)}
  if([1,2].includes(day.creation?.ckVersion)&&!day.source){
   if(x.group==='A'){
    const picker=node('fieldset','');picker.className='k-exclusion-picker';picker.append(node('legend','A：K除外（実艇番）'));
    picker.append(node('p','除外する艇を１つ選択してください。もう一度押すと解除できます。'));
    const choices=node('div','');choices.className='k-exclusion-options';
    for(const value of [2,3,4,5,6]){const l=node('label',''),i=document.createElement('input');i.type='checkbox';i.id='a-k-excluded-'+value;i.value=String(value);i.checked=s.aKExcluded===value;i.onchange=()=>edit(x.key,{aKExcluded:i.checked?value:null,reviewed:false});l.append(i,document.createTextNode(' '+value+'号艇'));choices.append(l)}
    picker.append(choices);if(s.cfEnabled)picker.append(node('p','参加中に指定を解除する場合は、先にクロスファイヤーへの参加を外してください。'));controls.append(picker);
   }else{
    const l=node('label','B：K型 '),select=document.createElement('select');select.id='b-k-type';
    for(const value of [null,'24','35']){const o=new Option(value===null?'未指定':value==='24'?'②④型':'③⑤型',value===null?'':value);o.selected=value===s.bKType;select.add(o)}
    select.onchange=()=>edit(x.key,{bKType:select.value||null,reviewed:false});l.append(select);controls.append(l);
   }
   const cf=labelInput('この日のこのレースをクロスファイヤーに明示参加（K入力とは独立）','checkbox',!!s.cfEnabled,v=>edit(x.key,{cfEnabled:v,reviewed:false}));cf.querySelector('input').id='cf-enabled';controls.append(cf);
   try{const value=C.crossfire(x,day,contract);host.append(node('p',value?'クロスファイヤー：'+(value.pattern==='24'?'②④型':'③⑤型')+'／除外'+value.excluded+'号艇\n旧原型6点：'+value.legacy.expression+'\n画像原型6点：'+value.image.expression+(value.replaced?'\n差替⑥':''):'クロスファイヤー：当日参加未指定（買い目なし）'));}catch(e){host.append(node('p','クロスファイヤー未確定：'+e.message))}
  }else{const l=node('label','K（保存済み原本の値） '),i=document.createElement('input');i.id='k-value';i.value=s.k;i.readOnly=true;l.append(i);controls.append(l);}

 }
 if(x.group==='B'){const l=node('label','第2軸 '),select=document.createElement('select');select.id='b-axis';for(const value of [null,...x.bOptions]){const o=new Option(value===null?'未指定':value+'号艇',value===null?'':String(value));o.selected=value===s.bAxis;select.add(o)}select.onchange=()=>{edit(x.key,{bAxis:Number(select.value)||null,reviewed:false})};l.append(select);controls.append(l)}
 if(x.group==='C'){
  if(x.cOptions){const l=node('label','C仮説 '),select=document.createElement('select');select.id='c-choice';for(const [value,text]of [['','未指定'],['○','○ '+x.cOptions.circle+'号艇'],['△','△ '+x.cOptions.triangle+'号艇']]){const o=new Option(text,value);o.selected=(s.cDesignation||'')===value;select.add(o)}select.onchange=()=>{edit(x.key,{cDesignation:select.value||null,reviewed:false})};l.append(select);controls.append(l)}
  controls.append(labelInput('C推し（○／△とは独立）','checkbox',s.cPush,v=>{edit(x.key,{cPush:v,reviewed:false})}));
 }
 const review=labelInput(day.source?'6艇・買い目・指定を原本と確認しました':'表示6艇・通常買い目・仮説買い目・自分の指定を確認しました（外部原本とは未照合）','checkbox',s.reviewed,v=>{edit(x.key,{reviewed:v})});review.querySelector('input').id='race-reviewed';controls.append(review);host.append(controls);
 const visible=reviewMessages(x.issues);host.append(node('p',visible.length?'未照合：'+visible.join('／'):day.creation&&!day.source?'新規作成：指定内容を確認済み。外部原本とは未照合のまま保存します':'このレースの接続項目は一致'));if(closed)host.append(node('p','締切後のため指定を変更できません。保存済みの一覧を閲覧できます。'));else if(shownRecord)host.append(node('p','保存済み一覧は閲覧専用です。未照合版を編集するには「保存済みを見る」から「未照合版から作成を再開」を押してください。'));
 const originals=day.input.sources.filter(z=>z.id===r.pdf_list_source_id);for(const z of originals)host.append(node('small','PDF SHA-256：'+z.sha256+'／取得元：'+z.url+'／公式一覧：'+z.listing_url));}

function cFields(){return {order:$('c-order').value,excluded:$('c-excluded').value,note:$('c-note').value,accepted:$('c-accept').checked,imageId:$('c-image').value,rates:Array.from({length:6},(_,i)=>$('c-rate-'+(i+1)).value)}}
function captureC(){if(cEditorKey&&!shownRecord&&!day?.source)cDrafts.set(cEditorKey,cFields());}
function renderCAuthor(){
 const select=$('c-race'),old=select.value;select.replaceChildren();
 for(const r of day?C.allRaces(day).filter(notCancelled):[]){const o=document.createElement('option');o.value=C.id(r);o.textContent=r.venue+r.race_number+'R'+(day.creation?.cOriginals?.[C.id(r)]?'（C記録済み）':'');select.append(o)}
 if([...select.querySelectorAll('option')].some(o=>o.value===old))select.value=old;
 $('c-author').hidden=!day?.creation;renderCMembers();renderCImages();renderCQuick();
}
function renderCQuick(){
 const host=$('c-quick-gallery');host.replaceChildren();const images=day?.creation?.cScreenshots||{};
 $('c-quick-status').textContent=shownRecord?'保存済み一覧は閲覧中です。画像を追加する場合は未照合版から作成を再開してください。':day?.source||day?.sourcePending?'正式原本の照合中は画像を追加できません。':Object.keys(images).length?'各画像の開催情報と6艇の数値を確認し、「C一覧に反映」を押してください。':'画像を選んでください。読めなかった数値は手で訂正できます。';
 for(const [id,im] of Object.entries(images)){
  const recorded=Object.entries(day.creation.cOriginals).find(([,c])=>c.screenshotId===id),locked=!!shownRecord||!!day.source||!!recorded;
  const card=node('article','');card.className='c-quick-card';const pic=document.createElement('img');pic.src=im.dataUrl;pic.alt='読み取ったマイ予想画像 '+im.name;card.append(node('h3',im.name),pic);
  if(recorded){const [key,c]=recorded;card.append(node('p','C一覧に反映済み：'+key.replace('|',' ')+(c.afterDeadline?'（締切後の参考記録）':'')));host.append(card);continue;}
  const proposal=im.ocr?.identity||{},old=quickDrafts.get(id)||{},fields=node('div','');fields.className='c-quick-fields';
  const venue=document.createElement('select');venue.setAttribute('aria-label','画像の開催場');venue.add(new Option('開催場を選択',''));for(const name of ABCCImageOCR.VENUES)venue.add(new Option(name,name));venue.value=old.venue??proposal.venue??'';
  const race=document.createElement('select');race.setAttribute('aria-label','画像のレース');race.add(new Option('レースを選択',''));for(let n=1;n<=12;n++)race.add(new Option(n+'R',String(n)));race.value=old.race??String(proposal.raceNumber||'');
  const deadline=document.createElement('input');deadline.type='time';deadline.setAttribute('aria-label','画像の締切');deadline.value=old.deadline??proposal.deadline??'';
  function label(text,input){const l=node('label',text);l.append(input);return l}fields.append(label('開催場',venue),label('レース',race),label('締切時刻',deadline));
  const rates=node('div','');rates.className='c-quick-rates';const boxes=[];for(let i=0;i<6;i++){const input=document.createElement('input');input.type='number';input.inputMode='decimal';input.min='0';input.max='100';input.step='0.01';input.setAttribute('aria-label',(i+1)+'号艇の画像2連率');input.value=old.rates?.[i]??im.ocr?.rates?.[i]??'';boxes.push(input);rates.append(label((i+1)+'号艇（%）',input));}
  const confirmBox=document.createElement('input');confirmBox.type='checkbox';confirmBox.checked=!!old.confirmed;const confirmLabel=node('label','');confirmLabel.append(confirmBox,document.createTextNode(' 画像の開催日・場・レースと、全国期別2連率の6艇を確認しました'));
  const past=document.createElement('input');past.type='checkbox';past.checked=!!old.retrospective;const pastLabel=node('label','');pastLabel.append(past,document.createTextNode(' 締切後の場合は、事後の参考記録として追加します'));
  const summary=node('p','');summary.className='c-quick-result';
  const saveDraft=()=>{quickDrafts.set(id,{venue:venue.value,race:race.value,deadline:deadline.value,rates:boxes.map(b=>b.value),confirmed:confirmBox.checked,retrospective:past.checked})};
  const update=()=>{const matched=C.allRaces(day).find(r=>r.venue===venue.value&&r.race_number===Number(race.value));if(matched&&(!deadline.value||deadline.dataset.auto==='true')){deadline.value=matched.deadline;deadline.dataset.auto='true'}saveDraft();try{const values=boxes.map(b=>b.value.trim()===''?null:Number(b.value)),q=C.cScreenshotRanking(values,true);summary.textContent='読取候補の順位：'+[...q.full].join(' → ')+' ／除外 '+q.excluded+'号艇。画像と照合してください。'}catch{summary.textContent='6艇の数値を確認してください。読めなかった数値は空欄です。'}};
  for(const input of [venue,race,...boxes]){input.dataset.locked=String(locked);input.addEventListener('change',()=>{confirmBox.checked=false;update()});input.addEventListener('input',()=>{confirmBox.checked=false;update()})}for(const input of [confirmBox,past]){input.dataset.locked=String(locked);input.addEventListener('change',update)}deadline.dataset.locked=String(locked);deadline.addEventListener('input',()=>{deadline.dataset.auto='false';confirmBox.checked=false;update()});
  const add=node('button','この画像をC一覧に反映');add.type='button';add.dataset.locked=String(locked);add.onclick=()=>action(async()=>{
   update();const values=boxes.map(b=>b.value.trim()===''?null:Number(b.value)),q=C.cScreenshotRanking(values,true),venueName=venue.value,no=Number(race.value),key=venueName+'|'+no;
   if(!confirmBox.checked)throw Error('画像の開催情報と6艇の数値を確認してください。');if(!venueName||!Number.isInteger(no)||no<1||no>12)throw Error('開催場とレースを選んでください。');
   let next=copy(day),record=C.allRaces(next).find(r=>C.id(r)===key),limit=record?.deadline||deadline.value;
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(limit))throw Error('締切時刻を確認してください。');const now=Date.now(),isLate=now>=Date.parse(next.date+'T'+limit+':00+09:00');
   if(isLate&&!past.checked)throw Error('締切後は「事後の参考記録」にチェックしてください。締切前の予想としては扱いません。');
   if(isLate&&draftBase&&C.allRaces(JSON.parse(draftBase.payload).day).some(r=>C.id(r)===key))throw Error('このレースは締切前後の保存履歴を保護しているため、画像を後から上書きできません。');
   if(record&&next.selections[key]&&C.canon(next.selections[key])!==C.canon(C.defaults()))throw Error('このレースには既に指定があるため、C画像の反映で上書きしません。指定内容を確認してください。');
   if(!record)next=C.stageStandaloneC(next,id,venueName,no,limit,true,now,{retrospective:isLate});
   next=C.identifyCScreenshot(next,id,next.date,key,true,true);next=C.authorCScreenshot(next,key,id,values,q.order,q.excluded,'画像の開催情報・6艇・全国期別2連率を確認',true,now,{retrospective:isLate});
   day=next;generation++;quickDrafts.delete(id);$('save-accept').checked=false;selected=key;refresh();note(isLate?'画像をC一覧に事後の参考記録として反映しました。締切前の予想としては扱いません。':'画像をC一覧に反映しました。内容を確認し、必要なら一覧を保存してください。');
  });
  const dateMismatch=proposal.date&&proposal.date!==day.date||proposal.monthDay&&proposal.monthDay!==day.date.slice(5);
  card.append(node('p','選択中の開催日：'+day.date+'／画像から読んだ候補：'+(proposal.date||proposal.monthDay||'日付未確認')+'・'+(proposal.venue||'場未確認')+'・'+(proposal.raceNumber?proposal.raceNumber+'R':'レース未確認')+(dateMismatch?'【開催日が一致しません。必ず画像と照合してください】':'')+'／数値：'+(im.ocr?.status==='READ_CANDIDATE'?'6艇の候補あり':'要確認')+'。'+(im.ocr?.warnings||[]).join('／')),fields,rates,summary,confirmLabel,pastLabel,add);host.append(card);update();
 }
}
function renderCImages(){const host=$('c-image-gallery');host.replaceChildren();
 for(const [id,im]of Object.entries(day?.creation?.cScreenshots||{})){
  const card=node('article','');card.className='c-evidence';card.dataset.image=id;const image=document.createElement('img');image.src=im.dataUrl;image.alt='C根拠画像 '+im.name;card.append(node('h3',im.name),image);
  const locked=!!shownRecord||!!day.source||Object.values(day.creation.cOriginals).some(c=>c.screenshotId===id);
  const date=document.createElement('input');date.type='date';date.value=im.date;date.setAttribute('aria-label','画像の開催日');date.dataset.locked=String(locked);
  const race=document.createElement('select');race.setAttribute('aria-label','画像の場・R');race.dataset.locked=String(locked);race.add(new Option('画像の場・Rを確認して選択',''));
  for(const r of C.allRaces(day).filter(notCancelled))race.add(new Option(r.venue+r.race_number+'R',C.id(r)));race.value=im.raceKey;
  const label=node('label',''),check=document.createElement('input');check.type='checkbox';check.checked=im.identityConfirmed;check.dataset.locked=String(locked);label.append(check,document.createTextNode(' 公式マイ予想画像の開催日・場・Rと、出走6艇が一致することを確認しました'));
  const correction=document.createElement('input');correction.type='checkbox';correction.checked=!!im.manualCorrection;correction.dataset.locked=String(locked);const correctionLabel=node('label','');correctionLabel.append(correction,document.createTextNode(' 読取が不確実／不一致の項目を画像と照合し、本人確認による訂正として扱います'));
  const change=confirmed=>{try{if(busy||shownRecord)throw Error('処理中／履歴閲覧中は変更できません');day=C.identifyCScreenshot(day,id,date.value,race.value,confirmed,correction.checked);generation++;$('save-accept').checked=false;refresh();}catch(e){note('停止：'+e.message);refresh()}};
  date.onchange=()=>change(false);race.onchange=()=>change(false);check.onchange=()=>change(check.checked);
  const proposal=im.ocr?.identity,comparison=proposal&&race.value?ABCCImageOCR.compareIdentity(im.ocr,day.date,...race.value.split('|')):'INCOMPLETE';
  card.append(node('p',im.ocr?'画像読取：'+im.ocr.status+'／開催情報照合：'+comparison+'（本人確認前）／2連率候補：'+(im.ocr.rates||[]).map(v=>v===null?'未確認':v).join('・')+'／'+(im.ocr.warnings||[]).join('／'):'画像読取未実施'),node('p','開催情報候補：'+(proposal?.date||proposal?.monthDay||'未確認')+'／'+(proposal?.venue||'未確認')+'／'+(proposal?.raceNumber||'未確認')+'R／締切 '+(proposal?.deadline||'未確認')));
  card.append(date,race,correctionLabel,label,node('small','根拠SHA-256：'+id));
  if(!locked&&day.creation.ckVersion===2){const retry=node('button','この画像を端末内OCRで読む');retry.type='button';retry.onclick=()=>action(async()=>{await readCImage(id);refresh()});card.append(retry);
   const box=node('fieldset','');box.append(node('legend','PDF未添付の場・Rを、この根拠画像からC候補として追加'));
   const venue=document.createElement('select');venue.setAttribute('aria-label','スクショ単独の場');venue.add(new Option('場を確認',''));for(const v of ABCCImageOCR.VENUES)venue.add(new Option(v,v));venue.value=proposal?.venue||'';
   const no=document.createElement('select');no.setAttribute('aria-label','スクショ単独のR');no.add(new Option('Rを確認',''));for(let n=1;n<=12;n++)no.add(new Option(n+'R',String(n)));no.value=String(proposal?.raceNumber||'');
   const deadline=document.createElement('input');deadline.type='time';deadline.setAttribute('aria-label','スクショ単独の締切');deadline.value=proposal?.deadline||'';
   const accepted=document.createElement('input');accepted.type='checkbox';const al=node('label','');al.append(accepted,document.createTextNode(' 画像の開催日・場・R・締切と6艇を確認しました'));
   const add=node('button','この場・RのC候補入力欄を追加');add.type='button';add.onclick=()=>action(async()=>{if(!accepted.checked)throw Error('スクショ単独レースの本人確認が必要です');day=C.stageStandaloneC(day,id,venue.value,Number(no.value),deadline.value,correction.checked);generation++;$('save-accept').checked=false;refresh();$('c-race').value=venue.value+'|'+Number(no.value);renderCMembers();syncControls();note('PDFなしのC候補入力欄を追加しました。まだC対象にはしていません。根拠画像・数値・順位を確認して記録してください。');});
   box.append(venue,no,deadline,al,add);card.append(box);
  }
  host.append(card);
 }
}
function renderCMembers(){
 captureC();const k=$('c-race').value,r=(day?C.allRaces(day):[]).find(r=>C.id(r)===k),host=$('c-members');host.replaceChildren();
 if(!r){cEditorKey=null;for(const id of ['c-order','c-excluded','c-note',...Array.from({length:6},(_,i)=>'c-rate-'+(i+1))])$(id).value='';$('c-image').replaceChildren();$('c-accept').checked=false;return;}
 const t=node('table',''),h=node('tr','');['艇','登録番号','選手名','級別',day.creation?.cStandalone?.[k]?'スクショ確認値（PDF未添付）':'PDFの2連対率（C根拠へ代用しません）'].forEach(v=>h.append(node('th',v)));t.append(h);
 for(const [i,b]of r.entrants.entries()){const tr=node('tr',''),m=day.members[k]?.[i];[b.boat_number,m?.registration_number||'未取得',m?.player_name||'未取得',b.grade??'未確認',b.national_top2_rate_percent===null?'未確認':b.national_top2_rate_percent+'%'].forEach(v=>tr.append(node('td',String(v))));t.append(tr)}host.append(t);
 cEditorKey=day.date+'|'+k;const c=day.creation?.cOriginals?.[k],draft=cDrafts.get(cEditorKey);
 const selector=$('c-image');selector.replaceChildren();selector.add(new Option('本人確認済みの根拠画像を選択',''));
 for(const [id,im]of Object.entries(day.creation?.cScreenshots||{}))if(im.identityConfirmed&&im.raceKey===k)selector.add(new Option(im.name,id));selector.value=c?.screenshotId||draft?.imageId||'';
 $('c-status').textContent=c?'記録済み：順位 '+c.order+'／除外 '+c.excluded+'／'+c.note+'／'+savedTime(c.createdAt):[1,2].includes(day.creation?.ckVersion)?'未記録。スクショの全国期別成績・2連率を6艇分入力し、順位・除外を確認してください。OCR候補を表示します。不確実な値は画像と照合して訂正してください。':'旧版のC原本は閲覧専用です。この入口から変更しません。';
 if(c||shownRecord||day.source){cDrafts.delete(cEditorKey);$('c-order').value=c?.order||'';$('c-excluded').value=c?.excluded||'';$('c-note').value=c?.note||'';$('c-accept').checked=false;for(let i=0;i<6;i++)$('c-rate-'+(i+1)).value=c?.rates?.[i]??'';}
 else{$('c-order').value=draft?.order||'';$('c-excluded').value=draft?.excluded||'';$('c-note').value=draft?.note||'';$('c-accept').checked=!!draft?.accepted;for(let i=0;i<6;i++)$('c-rate-'+(i+1)).value=draft?.rates?.[i]??'';}
}
$('c-race').onchange=()=>{renderCMembers();syncControls()};
$('c-image').onchange=()=>{const im=day?.creation?.cScreenshots?.[$('c-image').value];for(let i=0;i<6;i++)$('c-rate-'+(i+1)).value=im?.ocr?.rates?.[i]??'';for(const id of ['c-order','c-excluded','c-note'])$(id).value='';$('c-accept').checked=false;captureC();$('c-status').textContent='画像を切り替えました。旧画像の入力は引き継がず、新しいOCR候補を確認します。';};
async function extractOfficialC(){
 if(!day||shownRecord||day.source||day.sourcePending)throw Error('出走表を読み取った新規作成画面で実行してください');
 const response=await fetch('/creator/official-2026h2.json',{cache:'no-store'});if(!response.ok)throw Error('公式期別データを読み込めません');const data=await response.json();
 if(day.date<data.validFrom||day.date>data.validThrough)throw Error('このデータの適用期間は2026年7月1日〜12月31日です。新しい期のデータが必要です');
 let added=0,lateCount=0,missing=0,unchanged=0;const reasons=[],now=Date.now(),today=new Date(now+9*3600000).toISOString().slice(0,10);
 const baseline=draftBase?JSON.parse(draftBase.payload).day:null;
 for(const r of day.input.races){const key=C.id(r),m=day.members[key],one=m?.[0],entry=data.records[one?.registration_number];
  if(day.design.extraction.normal_exclusion_venues.includes(r.venue)||!notCancelled(r))continue;
  if(!entry||entry.r===null||!Array.isArray(m)||m.length!==6||m.some(b=>!data.records[b.registration_number]||!Number.isFinite(b.national_top2_rate_percent)||Math.abs(b.national_top2_rate_percent-data.records[b.registration_number].national)>0.11)){missing++;reasons.push(r.venue+r.race_number+'R');continue;}
  if(entry.r>50||day.creation.cOriginals[key])continue;
  const late=now>=Date.parse(day.date+'T'+r.deadline+':00+09:00');
  if(late&&(day.date!==today||(baseline&&C.allRaces(baseline).some(x=>C.id(x)===key)))){unchanged++;continue;}
  try{day=C.authorOfficialC(day,key,entry,now,{retrospective:late});added++;if(late)lateCount++;}catch(e){unchanged++;reasons.push(r.venue+r.race_number+'R：'+e.message)}
 }
 generation++;$('save-accept').checked=false;return 'C候補 '+added+'レース（うち締切後の事後参考 '+lateCount+'）。データ不足・全国数値不一致 '+missing+'件、保存履歴保護など '+unchanged+'件。'+(reasons.length?'確認対象：'+reasons.join('／')+'。':'')+'正式原本未照合。';
}
$('c-official-extract').onclick=()=>action(async()=>{const message=await extractOfficialC();refresh();note(message)});
$('c-image-start').onclick=()=>action(async()=>{refuseDiscardDraft();await reloadLedger();if(archives.some(r=>r.date===$('date').value))throw Error('この日は保存済みです。元データを維持して停止します');day=C.createImageDay($('date').value,design);generation++;draftBase=null;draftConflict=false;shownRecord=null;refresh();$('c-author').open=true;note('Cスクショのみの新規作成です。PDF未取得の6艇氏名・級別・勝率は推測しません。');});
async function readCImage(id){const im=day.creation.cScreenshots[id];try{const ocr=await ABCCImageOCR.recognize(im.dataUrl,m=>{if(m.status)status('端末内画像読取：'+m.status+' '+Math.round((m.progress||0)*100)+'%')});day=C.setCImageOCR(day,id,ocr);const p=ocr.identity,k=p.venue&&p.raceNumber?p.venue+'|'+p.raceNumber:'';if(C.allRaces(day).some(r=>C.id(r)===k))day=C.identifyCScreenshot(day,id,day.date,k,false);generation++;}catch(e){day=C.setCImageOCR(day,id,{status:'READ_FAILED',rates:[null,null,null,null,null,null],identity:{},warnings:[e.message]});generation++;}}

function cRateValues(){return Array.from({length:6},(_,i)=>{const v=$('c-rate-'+(i+1)).value.trim();return v===''?null:Number(v)})}
for(const id of ['c-order','c-excluded','c-note',...Array.from({length:6},(_,i)=>'c-rate-'+(i+1))])$(id).addEventListener('input',()=>{$('c-accept').checked=false;captureC();});
$('c-rank-preview').onclick=()=>{try{const q=C.cScreenshotRanking(cRateValues(),day.creation.ckVersion>=2);$('c-order').value=q.order;$('c-excluded').value=q.excluded;$('c-accept').checked=false;captureC();$('c-status').textContent='スクショ入力値の6艇順位：'+q.full+'／除外：'+q.excluded+'／除外後：'+q.order+'。画像と照合してチェックしてください（C未記録）。'}catch(e){note('停止：'+e.message)}};
$('c-record').onclick=()=>action(async()=>{if(shownRecord)throw Error('履歴閲覧中はC指定できません');day=C.authorCScreenshot(day,$('c-race').value,$('c-image').value,cRateValues(),$('c-order').value.trim(),$('c-excluded').value.trim(),$('c-note').value.trim(),$('c-accept').checked);generation++;$('save-accept').checked=false;selected=$('c-race').value;refresh();note('本人確認したスクショ根拠のCを記録しました。C○／△・推しはレース確認欄で独立指定します。')});
async function addCFiles(files){
 if(!files.length)return;if(shownRecord)throw Error('保存済み一覧は閲覧中です。未照合版から作成を再開してください。');
 if(!day){const date=$('date').value;await reloadLedger();const latest=archives.filter(r=>r.date===date).at(-1);if(latest){const parsed=await C.verify(latest);if(!C.resumable(parsed))throw Error('この日は固定保存されています。保存済み一覧を確認してください。');day=await C.resumeDraft(latest,latest);draftBase=copy(latest);draftConflict=false;}else{day=C.createImageDay(date,design);draftBase=null;draftConflict=false;}generation++;}
 if(files.length>30||files.some(f=>f.size>5*1024*1024)||files.reduce((n,f)=>n+f.size,0)>35*1024*1024)throw Error('画像は30枚・各5MB・合計35MB以内です。既存の画像も合計上限に含まれます');
 const ticket=generation,stamp=C.canon(day),images=[];
 for(const file of files){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('PNG/JPEG/WebPのスクショを選択してください');const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(Error('画像読取失敗'));fr.readAsDataURL(file)});await new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(Error('画像を表示できません'));im.src=dataUrl});images.push({name:file.name,dataUrl});}
 const next=await C.addCScreenshots(day,images);if(ticket!==generation||stamp!==C.canon(day))throw Error('画像読取中に入力が変わりました。元入力を保持します');day=next;generation++;$('save-accept').checked=false;$('c-images').value='';$('c-quick-file').value='';const pending=Object.entries(day.creation.cScreenshots).filter(([,im])=>!im.ocr);for(let i=0;i<pending.length;i++){status('画像を読み取り中：'+(i+1)+' / '+pending.length+'枚');await readCImage(pending[i][0]);}refresh();$('c-quick-panel').scrollIntoView({block:'start'});note('画像を読み取りました。開催情報と6艇の値を確認し、「C一覧に反映」を押してください。');
}
$('c-images').onchange=()=>{const files=[...$('c-images').files];return action(()=>addCFiles(files))};
$('c-quick-file').onchange=()=>{const files=[...$('c-quick-file').files];return action(()=>addCFiles(files))};
function renderList(){const target=$('list-host');target.replaceChildren();target.append(node('h2',day.date+'｜ABC一覧（'+(shownRecord?.draftSafety?'未保存入力控え・閲覧専用（正式履歴ではありません）':shownRecord?.imported?'添付JSON・閲覧専用／元記録：'+(shownRecord.originalKind==='CONFIRMED'?'利用者照合済み':'未照合'):shownRecord?.kind==='CONFIRMED'?'利用者照合済み':'未照合候補')+'）'));const nav=node('nav','');nav.setAttribute('aria-label','26区分へ移動');target.append(nav);for(const s of daily.sections()){const section=node('section','');section.id='integrated-'+s.id;section.dataset.section=s.id;section.append(node('h3',s.title));const b=node('button',s.title);b.type='button';b.onclick=()=>section.scrollIntoView({block:'start'});nav.append(b);
 const hint=node('p','⇆ 表は左右にスワイプできます');hint.className='scroll-hint';section.append(hint);const wrap=node('div','');wrap.className='horizontal';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',s.title+'。横にスクロールできます');const table=node('table',''),thead=node('thead',''),h=node('tr','');s.columns.forEach(c=>h.append(node('th',c)));thead.append(h);table.append(thead);const tbody=node('tbody','');tbody.dataset.block=s.id==='a-grade'?'a-grade-day':s.id;
 if(!s.rows.length){const tr=node('tr',''),td=node('td',['crossfire','crossfire-total','cf-image-master','cf-image-races','cf-image-total'].includes(s.id)?([1,2].includes(day.creation?.ckVersion)?'当日の参加未指定（買い目なし）':'未照合（指定原本未接続）'):'対象行なし／結果未更新');td.colSpan=s.columns.length;tr.append(td);tbody.append(tr)}
 for(const cells of s.rows){const tr=node('tr','');cells.forEach((v,i)=>{const td=node('td',v);if(typeof v==='string'&&v.includes('\n')){const pair=node('div','');pair.className='pair';for(const line of v.split('\n'))pair.append(node('div',line));td.replaceChildren(pair)}if(s.columns[i]==='場・R'){const x=computed.rows.find(x=>x.record.venue+x.record.race_number+'R'===v);if(x){const link=node('button',v);link.type='button';link.className='race-link';link.onclick=()=>{selected=x.key;renderCard();document.querySelectorAll('#races button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.race===selected)));syncControls();$('review-card').scrollIntoView({block:'start'})};td.replaceChildren(link,document.createTextNode(' '),daily.sourceLink(x.record,'出走表'));if(day.creation?.cOriginals?.[x.key]?.afterDeadline)td.append(node('span','（事後参考）'))}}tr.append(td)});tbody.append(tr)}table.append(tbody);wrap.append(table);section.append(wrap);target.append(section)}
 $('list-caption').textContent='表は指定の列順で表示します。買い目欄の投資は予想上の予定額です。実購入の的中率・回収率は上の当日集計を参照してください。';}
function updateHistoryStatus(){$('history-status').textContent='端末内 '+archives.length+'件';}
async function reloadLedger(){archives=await C.readAll();calendar();updateHistoryStatus();}
let month=new Date(Date.now()+9*3600000).toISOString().slice(0,7);
function calendar(){const [y,m]=month.split('-').map(Number),start=new Date(Date.UTC(y,m-1,1)),count=new Date(Date.UTC(y,m,0)).getUTCDate();$('calendar-month').textContent=y+'年'+m+'月';$('history-month').value=month;const box=$('calendar');box.replaceChildren();for(const text of ['日','月','火','水','木','金','土'])box.append(node('strong',text));for(let i=0;i<start.getUTCDay();i++)box.append(node('span',''));
 for(let d=1;d<=count;d++){const date=month+'-'+String(d).padStart(2,'0'),saved=archives.some(x=>x.date===date),imported=importedRecords.some(x=>x.date===date),b=node('button',String(d)+(saved?' ●':'')+(imported?' ◇':''));b.type='button';b.dataset.date=date;b.className=saved?'saved':imported?'imported':'';b.setAttribute('aria-label',date+(saved?' 端末内保存あり':'')+(imported?' 添付JSONあり':''));b.onclick=()=>action(()=>showHistory(date));box.append(b)}}
let historyGeneration=0;
async function showHistory(date){const historyTicket=++historyGeneration,box=$('history');box.replaceChildren();const saved=archives.filter(r=>r.date===date).sort((a,b)=>b.revision-a.revision),attached=importedRecords.filter(r=>r.date===date).sort((a,b)=>b.revision-a.revision);box.append(node('h3',date+'の一覧（●端末内）'));
 if(!saved.length&&!attached.length)box.append(node('p','この日の保存済み一覧はありません。'));
 for(const record of saved){const p=await C.verify(record);if(historyTicket!==historyGeneration)return;const line=node('div','');line.className='history-row';line.append(node('span','版'+record.revision+' '+(p.kind==='CONFIRMED'?'利用者照合済み':'未照合')+' '+savedTime(p.savedAt)));const open=node('button','一覧を再表示');open.onclick=()=>action(async()=>{refuseDiscardDraft();const parsed=await C.verify(record);generation++;day=copy(parsed.day);shownRecord=parsed;$('date').value=day.date;refresh();note('保存版'+record.revision+'を再読込：内容SHA一致。閲覧専用です。')});line.append(open);
  if(record.id===saved[0]?.id&&C.resumable(p)){const resume=node('button','未照合版から作成を再開');resume.type='button';resume.dataset.resume=record.id;resume.onclick=()=>action(async()=>{refuseDiscardDraft();await reloadLedger();const latest=archives.filter(x=>x.date===record.date).at(-1),next=await C.resumeDraft(record,latest);generation++;day=next;draftBase=copy(record);draftConflict=false;shownRecord=null;$('save-accept').checked=false;$('date').value=day.date;refresh();note('未照合版'+record.revision+'を複製して作成を再開しました。保存済み原本は変更せず、新しい保存版を追記します。')});line.append(resume)}
  box.append(line)}

 syncControls();
}
async function save(kind){if(!day||shownRecord)throw Error('未保存の一覧を選択してください');if(!$('save-accept').checked)throw Error('保存区分の確認欄を確認してください');if(kind==='CONFIRMED'&&!confirm('照合済み一覧を固定保存します。以後、この日付の買い目・指定は変更できません。保存しますか？'))return;
 const ticket=generation,stamp=C.canon(day);await reloadLedger();const records=archives.filter(x=>x.date===day.date),previous=records.at(-1);try{C.assertDraftBase(draftBase,previous)}catch(e){draftConflict=true;report(e.message);throw e;}if(records.some(x=>JSON.parse(x.payload).kind==='CONFIRMED'))throw Error('この日は確定済みです。変更・上書きできません');const targetDay=copy(day),record=await C.seal(targetDay,kind,previous);if(ticket!==generation||stamp!==C.canon(day))throw Error('保存準備中に入力が変更されました');try{await C.append(record)}catch(e){
   // Transaction outcome may be unknown after a timeout or connection failure.
   // Never automatically retry and never claim that a write did not occur.
   $('save-accept').checked=false;
   report('保存成否は未確認です。自動再送しません。カレンダーの履歴を確認してください。');
   throw Error('保存未確認：'+(e?.message||String(e))+'。二重登録を避けるため自動再送しません。入力内容は画面に保持しています。');
  }draftBase=copy(record);await reloadLedger();const p=await C.verify(record);shownRecord=p;refresh();await showHistory(day.date);note('保存版'+record.revision+'：保存→再読込→内容SHA一致（'+(kind==='CONFIRMED'?'利用者照合済み':'未照合のまま')+'）。必要ならテキストを保存してください。');}
// Analysis exports are explicit snapshots, not browser-ledger backups.
function analysisExport(){
 if(!day)throw Error('先に一覧を作成してください');
 const clean=copy(day);
 for(const image of Object.values(clean.creation?.cScreenshots||{})){delete image.dataUrl;image.imageBodyIncluded=false;}
 if(clean.source?.rawHtml){delete clean.source.rawHtml;clean.source.rawHtmlIncluded=false;}
 const result=C.compute(day);
 return {format:'BOATRACE_ABC_ANALYSIS_EXPORT',version:1,exportedAt:new Date().toISOString(),date:day.date,ruleVersion:day.ruleVersion,
  status:shownRecord?.originalKind||shownRecord?.kind||'UNVERIFIED_DRAFT',
  note:'一覧と出走情報・購入記録です。画像本体と外部原本は含みません。予想時刻・公式照合・実際の購入を証明するものではありません。',
  day:clean,counts:result.counts,rows:result.rows.map(x=>({key:x.key,group:x.group,color:x.color,record:x.record,members:x.members,selection:x.selection,normal:x.normal,normalExpression:x.normalExpression,hypothesis:x.hypothesis,hypExpression:x.hypExpression,eligible:x.eligible,cOrder:x.cOrder,cExcluded:x.cExcluded,issues:x.issues})),
  sections:daily.sections()};
}
$('open-result-viewer').onclick=()=>{
 if(busy)return;
 try{
 const data=analysisExport();
 if(!data.rows.length||data.sections.length!==26)throw Error('先に対象レースのある一覧を作成してください');
 const payload={format:data.format,version:data.version,date:data.date,status:data.status,note:data.note,sections:data.sections};
 const form=document.createElement('form');form.method='POST';form.action='/api/results-handoff';form.target='_self';
 const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(payload);form.append(input);document.body.append(form);
 note('その日の一覧を開いています…');HTMLFormElement.prototype.submit.call(form);
 }catch(error){note('移動できませんでした：'+error.message+'。保存済みの一覧は保持しています。');}
};
$('export-text').onclick=()=>action(async()=>{const data=analysisExport(),lines=['ABC 予想一覧',`開催日：${data.date}`,`書出日時：${data.exportedAt}`,`状態：${data.status}`,data.note,''];lines.push(...daily.textLines());for(const section of data.sections){lines.push('【'+section.title+'】',section.columns.join('\t'));for(const row of section.rows)lines.push(row.map(v=>String(v??'').replace(/[\t\r\n]+/g,' ')).join('\t'));lines.push('');}download('ABC_一覧_'+data.date+'.txt',lines.join('\r\n'),'text/plain;charset=utf-8');note('一覧をテキスト形式で書き出しました。端末でダウンロードを確認してください。');});
$('new-entry').onclick=()=>{
 if(busy)return;
 if(day&&!shownRecord&&!confirm('作成中の指定・買い目はまだ保存されていません。必要なら先にテキストを書き出すか端末内に保存してください。現在の入力を破棄して新規作成へ戻りますか？')){
  note('作成中の入力を保持しました。新規作成への切替は取り消しました。');return;
 }
 reset();
};
$('source').addEventListener('change',()=>{generation++;if(day&&!shownRecord){day.sourcePending=$('source').files.length>0;for(const s of Object.values(day.selections))s.reviewed=false;$('save-accept').checked=false;refresh()}});
for(const id of ['date','pdfs'])$(id).addEventListener('change',async()=>{
 if(id==='date'&&day&&!shownRecord){
  const requested=$('date').value,previous=day.date;$('date').value=previous;
  if(requested===previous)return;
  if(busy){note('処理中のため開催日訂正を停止しました。画像・OCR・元の日付は保持しています。');return;}
  if(C.canCorrectCImageDate(day)&&!draftBase){
   await action(async()=>{const ticket=generation,stamp=C.canon(day);await reloadLedger();if(ticket!==generation||stamp!==C.canon(day))throw Error('状態が変わったため開催日訂正を停止しました。元入力は保持しています');
    const next=C.correctCImageDate(day,requested,archives.map(r=>r.date));day=next;generation++;cDrafts.clear();cEditorKey=null;selected=null;draftConflict=false;$('save-accept').checked=false;$('pdf-checked').checked=false;$('coverage-checked').checked=false;$('date').value=day.date;refresh();$('c-author').open=true;
    note('開催日を'+previous+'から'+day.date+'へ訂正しました。画像・OCRは保持し、画像の日付・場・Rの確認は解除しました。各画像を訂正後の開催日と照合してください。C対象・指定は自動追加しません。');
   });return;
  }
 }
 if(day&&!shownRecord){
  // File inputs cannot be restored programmatically: clear only the new selection,
  // while leaving the already-parsed PDF data, choices and draft intact.
  $('date').value=day.date;if(id==='pdfs')$('pdfs').value='';
  note('作成中の入力があるため日付・添付PDFの変更を停止しました。元の入力内容は保持しています。新規日付は必要な内容を保存してから開始してください。');return;
 }
 reset();
});
$('cancel-source').onclick=()=>{if(busy||shownRecord||!day?.sourcePending)return;$('source').value='';day.sourcePending=false;generation++;$('save-accept').checked=false;refresh();note('未接続の添付選択を取り消しました。接続済み原本・C指定は保持しています。')};
$('parse').onclick=()=>action(()=>parsePdf());$('fetch-auto').onclick=()=>action(fetchOfficial);$('load-source').onclick=()=>action(loadSource);
$('header-saved').addEventListener('click',()=>{$('saved').open=true;});
$('header-result-update').onclick=()=>action(async()=>{
 if(!day)throw Error('先に公式情報から一覧を作成するか、「保存済みを見る」から一覧を開いてください。');
 $('purchase-panel').scrollIntoView({block:'start'});
 await daily.refreshAll();
});
for(const [id,key]of [['pdf-checked','originChecked'],['coverage-checked','coverageChecked']])$(id).onchange=()=>{if(day&&!shownRecord){day[key]=$(id).checked;generation++;$('save-accept').checked=false;refresh()}};
let backupCandidate=null,backupInspection=null;
async function storageMode(){const el=$('storage-mode');if(!navigator.storage?.persisted){el.textContent='保存状態はこの端末では確認できません。バックアップを別に保管してください。';return;}try{const yes=await navigator.storage.persisted();el.textContent=yes?'端末による自動削除を避ける保存設定が有効です。機器の故障や手動削除に備えてバックアップも保管してください。':'保存領域の保持は保証されていません。保存済み一覧のバックアップを保管してください。';}catch{el.textContent='保存状態を確認できません。バックアップを保管してください。';}}
$('storage-persist').onclick=()=>action(async()=>{if(!navigator.storage?.persist)throw Error('この端末は保存領域の保持設定に対応していません');const granted=await navigator.storage.persist();await storageMode();note(granted?'保存領域を保持する設定が有効です。バックアップも保管してください。':'この端末では保持が許可されませんでした。バックアップを保管してください。')});
$('backup-export').onclick=()=>action(async()=>{const records=await C.readAll();if(!records.length)throw Error('この画面には保存済み一覧がありません。元のブラウザまたはホーム画面で開いてください');const backup={format:'ABC_INTEGRATED_BACKUP_V1',records};await C.parseBackup(backup);download('ABC_一覧バックアップ_'+new Date(Date.now()+9*3600000).toISOString().slice(0,10)+'.json',JSON.stringify(backup),'application/json;charset=utf-8');note('バックアップの保存操作を開始しました。ファイルアプリの保存先を確認してください。購入記録は含まれません。')});
$('backup-file').onchange=()=>action(async()=>{backupCandidate=null;backupInspection=null;$('backup-restore').disabled=true;const f=$('backup-file').files[0];if(!f)return;if(f.size>60*1024*1024)throw Error('バックアップは60MB以内です');let b;try{b=JSON.parse(await f.text())}catch{throw Error('一覧バックアップを読み取れません')};const v=await C.inspectEmptyBackupRestore(b);backupCandidate=b;backupInspection=v;$('backup-status').textContent=v.canRestore?'復元可能：'+v.backupRecords+'版・'+v.backupDays+'日分（'+v.firstDate+'〜'+v.lastDate+'）。画像を含む場合があります。':'この画面に'+v.existingCount+'件の保存済み一覧があるため、上書き・統合はできません。';$('backup-restore').disabled=!v.canRestore;});
$('backup-restore').onclick=()=>action(async()=>{if(!backupCandidate||!backupInspection?.canRestore)throw Error('先に復元するファイルを選択してください');if(day&&!shownRecord)throw Error('作成中の未保存一覧があります。先に保存してください');const b=backupCandidate;backupCandidate=null;backupInspection=null;$('backup-restore').disabled=true;try{const out=await C.restoreEmptyBackup(b);await reloadLedger();$('backup-status').textContent=out.days+'日分・'+out.count+'版を復元し、保存後に再読込しました。購入記録は含まれません。';note('一覧を復元しました。「端末に保存した一覧」の日付から開けます。')}catch(e){$('backup-status').textContent='復元結果を確認できません。自動再試行せず、保存履歴を再読込して確認してください。';throw e}});
storageMode();
$('save-verified').onclick=()=>action(()=>save('CONFIRMED'));$('save-pending').onclick=()=>action(()=>save('UNVERIFIED'));
$('history-month').onchange=()=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test($('history-month').value)){month=$('history-month').value;calendar()}};
$('history-refresh').onclick=()=>action(reloadLedger);
for(const [id,delta]of [['prev-month',-1],['next-month',1]])$(id).onclick=()=>{const [y,m]=month.split('-').map(Number);month=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);calendar()};
function updateVenueCount(){const selected=[...document.querySelectorAll('#venue-list input:checked')];$('venue-count').textContent=selected.length?selected.length+'場を選択中':'選択なし（当日の全開催場）';}
for(const [code,name] of Object.entries(ABC_PDF_PROFILE.supported()).sort((a,b)=>Number(a[0])-Number(b[0]))){const label=node('label',''),input=document.createElement('input');input.type='checkbox';input.value=code;input.setAttribute('aria-label',name);input.onchange=updateVenueCount;label.append(input,document.createTextNode(' '+name));$('venue-list').append(label)}
$('venue-all').onclick=()=>{document.querySelectorAll('#venue-list input').forEach(e=>e.checked=true);updateVenueCount()};$('venue-clear').onclick=()=>{document.querySelectorAll('#venue-list input').forEach(e=>e.checked=false);updateVenueCount()};
for(let n=1;n<=12;n++)$('fetch-race').add(new Option(n+'R',String(n)));
$('date').value=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
await action(async()=>{
 await reloadLedger();
 const latest=archives.at(-1);
 if(!latest){note('準備完了：公式情報を取得するか、保存済み一覧を開いてください。');return;}
 // Only persisted, verified history is restored. Other tabs' unsaved drafts
 // and the saved original are never modified by opening the site.
 const parsed=await C.verify(latest);
 generation++;day=copy(parsed.day);shownRecord=parsed;$('date').value=day.date;
 month=day.date.slice(0,7);calendar();await showHistory(day.date);refresh();
 note(day.date+'の最新の保存済み一覧を開きました。公式結果を自動確認します。別の日を作成するときは「新規作成に戻る」を押してください。');
});
setInterval(()=>{if(day&&!shownRecord&&!busy)syncControls()},1000);
})();
