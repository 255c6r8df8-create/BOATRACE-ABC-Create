(function(root){'use strict';
root.ABCFixedBaseView={create(ctx){
 const F=root.ABCFixedBase,M=root.ABCFixedBaseModel,$=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 let dayDate=null,supplements={},model=null,selected='',busy=false,prior=null,readonly=false,viewingSaved=false,loadError='',loadingLedger=false,op=0,readSerial=0;
 const panel=el('section');panel.id='fixed-base-panel';panel.className='panel';panel.hidden=true;$('list-host').before(panel);
 const note=t=>{const n=$('fixed-status');if(n)n.textContent=t;};
 const records=()=>ctx.getDay()?.input.races||[],key=r=>r.venue+'|'+r.race_number,closed=r=>Date.now()>=Date.parse(dayDate+'T'+r.deadline+':00+09:00');
 const legacyIds=['review','list-host','list-caption','c-quick-panel','c-official-extract','add-normal','add-hypothesis'];
 function database(){return new Promise((resolve,reject)=>{const q=indexedDB.open('BOATRACE_FIXED_BASE_20261112',1);q.onupgradeneeded=()=>{const s=q.result.createObjectStore('records',{keyPath:'id'});s.createIndex('date','date');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
 async function latest(date){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('records'),q=tx.objectStore('records').index('date').getAll(date);q.onsuccess=()=>{const rs=q.result.sort((a,b)=>a.revision-b.revision);for(const r of rs)M.verifySnapshot(r);resolve(rs.at(-1)||null);};q.onerror=()=>reject(q.error);});}finally{db.close();}}
 async function save(){
  if(readonly||loadError||busy||loadingLedger)throw Error('この一覧は保存できません');
  const day=ctx.getDay(),token=op,snapshot=M.createSnapshot(day,supplements,prior);snapshot.id=dayDate+'|'+snapshot.revision;
  busy=true;render();const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),s=tx.objectStore('records'),q=s.index('date').getAll(dayDate);let why;
   q.onsuccess=()=>{try{if(op!==token)throw Error('保存中に表示が変わりました');const last=q.result.sort((a,b)=>a.revision-b.revision).at(-1)||null;if(JSON.stringify(last)!==JSON.stringify(prior))throw Error('別画面で保存版が変わりました。上書きせず停止しました');s.add(snapshot);}catch(e){why=e;tx.abort();}};
   tx.oncomplete=resolve;tx.onabort=()=>reject(why||tx.error);tx.onerror=()=>{};
  });prior=snapshot;const backup=M.writeBackup(snapshot);db.close();busy=false;render();note('固定ベースの入力・買い目を保存しました。'+(backup.ok?'予備保存も完了。':'予備保存は未完了：'+backup.error));}finally{db.close();busy=false;}
 }
 function download(name,data,type){const a=el('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 function button(label,handler,disabled=false){const b=el('button',label);b.type='button';b.disabled=disabled;b.onclick=async()=>{try{await handler();}catch(e){note('停止：'+e.message);}};return b;}
 function setSupplement(k,value){const r=records().find(r=>key(r)===k);if(readonly||!r||closed(r)||loadError||loadingLedger)throw Error('締切後または閲覧専用の入力は変更できません');supplements={...supplements,[k]:value};op++;}
 async function fetchOne(k){const d=ctx.getDay(),r=records().find(r=>key(r)===k);if(!r||readonly||closed(r))throw Error('締切前の取得済みレースを選択してください');
  const token=op,date=dayDate,code=Object.entries(root.ABC_PDF_PROFILE.supported()).find(([,name])=>name===r.venue)?.[0];
  let p=supplements[k]?.official;
  if(!p){const res=await fetch('/api/sns-entry?date='+encodeURIComponent(date)+'&venue='+code+'&race='+r.race_number,{cache:'no-store'});p=await res.json();if(!res.ok)throw Error(p.error||'公式出走表を取得できません');}
  if(token!==op||date!==dayDate)throw Error('取得中に入力が変わりました。再取得してください');M.validateProfile(d,r,p);
  const previous=supplements[k]||{},course=previous.course||M.officialPeriodCourse(d,r);
  setSupplement(k,{...previous,official:p,...(course?{course}:{})});
 }
 async function fetchSelected(){if(busy)throw Error('取得中です');busy=true;render();try{await fetchOne(selected);}finally{busy=false;render();}}
 async function fetchAll(){if(busy)throw Error('取得中です');const wanted=records().filter(r=>!closed(r)&&(!supplements[key(r)]?.official||!supplements[key(r)]?.course)).map(key);busy=true;render();let good=0;const errors=[];const date=dayDate;
  try{for(const k of wanted){if(date!==dayDate||readonly)break;try{await fetchOne(k);good++;}catch(e){errors.push(k+'：'+e.message);}note('公式出走表を取得中 '+(good+errors.length)+' / '+wanted.length);}}finally{busy=false;render();note('取得 '+good+'R'+(errors.length?'／未取得 '+errors.join('／'):''));}}
 function render(){
  const day=ctx.getDay();if(!day||ctx.getShownRecord()||day.date<'2026-11-12'){panel.hidden=true;return;}panel.hidden=false;
  if(dayDate!==day.date){dayDate=day.date;op++;supplements={};prior=null;loadError='';loadingLedger=true;const serial=++readSerial;
   latest(dayDate).then(record=>{if(serial!==readSerial||dayDate!==day.date)return;if(record){prior=record;supplements=record.supplements;}
    if(!viewingSaved)for(const r of records()){const k=key(r),s=supplements[k];if(!closed(r)&&s?.official&&!s.course){M.validateProfile(day,r,s.official);const course=M.officialPeriodCourse(day,r);if(course)supplements={...supplements,[k]:{...s,course}};}}
    loadingLedger=false;render();}).catch(e=>{if(serial!==readSerial)return;loadingLedger=false;loadError='保存済み固定ベースを読み取れません：'+e.message;render();});}
  readonly=!!ctx.getShownRecord()||viewingSaved;panel.replaceChildren();
  panel.append(el('h2',day.date+'｜固定ベース A・B・C・D・E・K'),el('p','2026年11月12日確定版。表示した買い目を分類ごとに確認できます。旧版の保存記録は変更しません。'));
  const status=el('p',loadError||'公式全国成績・平均STと、旧版で使用していた公式期別1コース率を自動取得します。適用期間外・データ不足の場合は判定待ちになります。');status.id='fixed-status';status.setAttribute('role','status');panel.append(status);
  const actions=el('div');actions.className='secondary-actions';actions.append(button('全レースの判定データを自動取得',fetchAll,busy||readonly||loadingLedger||!!loadError),button('固定ベースの入力・買い目を保存',save,busy||readonly||loadingLedger||!!loadError));panel.append(actions);
  try{model=M.compute(day,supplements);}catch(e){panel.append(el('p','判定停止：'+e.message));return;}
  panel.append(el('p',Object.entries(model.counts).map(([g,n])=>g+' '+n+'R').join(' ／ ')+' ／ 重複除外 '+model.uniqueRaces+'R ／ 取得済み '+model.receivedRaces+'R'));
  const selector=el('select');selector.id='fixed-race';selector.setAttribute('aria-label','固定ベースの確認レース');
  for(const r of records()){const o=el('option',r.venue+r.race_number+'R　'+r.deadline);o.value=key(r);selector.append(o);}
  if(!records().some(r=>key(r)===selected))selected=records()[0]?key(records()[0]):'';selector.value=selected;selector.onchange=()=>{selected=selector.value;render();};panel.append(selector,button('このレースの公式全国成績・STを取得',fetchSelected,busy||readonly||loadingLedger||!selected||!!loadError||closed(records().find(r=>key(r)===selected))));
  const r=records().find(r=>key(r)===selected);
  if(r){const s=supplements[selected]||{},box=el('details');box.open=true;box.append(el('summary',r.venue+r.race_number+'Rの判定根拠'));
   const a=el('a','公式出走表を確認 ↗');a.href=M.officialURL(day.date,r);a.target='_blank';a.rel='noopener noreferrer';box.append(a);
   if(s.official){const wrap=el('div');wrap.className='horizontal';const table=el('table'),head=el('tr');for(const v of ['艇','選手','級別','全国勝率','全国2連対率','平均ST'])head.append(el('th',v));table.append(head);for(const b of s.official.boats){const tr=el('tr');for(const v of [b.lane,b.name,b.grade,b.nationalWin??'欠損',b.nationalTwo??'欠損',b.averageST??'欠損'])tr.append(el('td',String(v)));table.append(tr);}wrap.append(table);box.append(wrap);}
   if(s.course?.source==='OFFICIAL_PERIOD_FILE')box.append(el('p','①の期別1コース2連対率：'+s.course.value+'％（'+s.course.runs+'走）／公式期別データから自動取得。適用 '+s.course.validFrom+'〜'+s.course.validThrough));
   const locked=readonly||busy||loadingLedger||!!loadError||closed(r),label=el('label','①の期別1コース2連対率（％）'),input=el('input');input.id='fixed-course';input.type='number';input.min='0';input.max='100';input.step='0.01';input.value=s.course?.value??'';input.disabled=locked;label.append(input);box.append(label);
   const sourceLabel=el('label','日和の確認元URL'),source=el('input');source.id='fixed-course-source';source.type='url';source.value=s.course?.source||'';source.placeholder='https://kyoteibiyori.com/…';source.disabled=locked;sourceLabel.append(source);box.append(sourceLabel);
   box.append(button('当レースの期別1コース率を確認して反映',()=>{const c={date:day.date,key:selected,value:input.value,source:source.value,confirmed:true,confirmedAt:new Date().toISOString()};M.validateCourse(day,r,c);setSupplement(selected,{...s,course:c});render();},locked));
   if(closed(r))box.append(el('p','締切後のため入力・買い目の変更はできません。'));panel.append(box);
  }
  for(const group of ['A','B','C','D','E','K']){
   const rs=model.rows.filter(x=>x.group===group),sec=el('section');sec.dataset.fixedGroup=group;sec.append(el('h3',group+'一覧　'+new Set(rs.map(x=>x.key)).size+'R'+(rs.length!==new Set(rs.map(x=>x.key)).size?' ／'+rs.length+'型':'')));
   if(!rs.length)sec.append(el('p','該当する買い目はありません。未確認項目があるレースは下の判定待ちに表示します。'));
   for(const x of rs){const card=el('article');card.className='fixed-race-card';card.append(el('h4',x.record.venue+x.record.race_number+'R ／締切 '+x.record.deadline+' ／'+x.points+'点'+(x.axis?' ／軸'+x.axis:'')),el('p',(x.patterns||[]).map(p=>({'A-RED-A2-01':'🔴・①A2','A-RED-A2-ABABA-02':'①〜⑤がABABA','B-TOP3-124-134-135':'全国率順124・134・135','C-2A2-RATE1':'②A2・全国率1位・平均ST差0.05秒以上','C-5A1':'⑤A1・平均ST差0.03秒以上','E13-K4':'E K・13型の基本4点','B-K-002':'採用済みK基本形','B-K-003':'K基本形・全国率5位④'})[p]||p).join(' ／ ')||'採用済み一般形16点'));
    const forms=el('div');forms.className='fixed-forms';for(const line of x.forms)forms.append(el('div',line));card.append(forms);
    card.append(button('購入入力欄にこの買い目を表示',()=>{if(closed(x.record))throw Error('締切後の買い目は購入候補へ転記できません');ctx.daily.focus(x.key);$('purchase-input').value=x.tickets.map(t=>t+' 100').join('\n');$('purchase-input').dispatchEvent(new Event('input',{bubbles:true}));note('購入入力欄へ表示しました。金額を確認して購入記録を保存してください。');},busy||closed(x.record)));
    sec.append(card);
   }panel.append(sec);
  }
  const held=el('details');held.id='fixed-held';held.append(el('summary','判定待ち '+model.held.length+'件'));
  for(const x of model.held)held.append(el('p',x.record.venue+x.record.race_number+'R【'+x.group+'】'+x.reason));panel.append(held);
  const ex=el('div');ex.className='secondary-actions';ex.append(button('固定ベースのJSONを保存',()=>{const s=M.createSnapshot(day,supplements,prior);download('固定ベース_'+day.date+'.json',JSON.stringify(s,null,2),'application/json');},busy||!!loadError),button('買い目テキストを保存',()=>{const lines=[day.date+' 固定ベース '+F.VERSION];for(const x of model.rows)lines.push('',x.group+' '+x.record.venue+x.record.race_number+'R '+x.points+'点',...x.forms);download('固定ベース_買い目_'+day.date+'.txt',lines.join('\n'),'text/plain;charset=utf-8');},busy));panel.append(ex);
 }
 function hideLegacy(){const day=ctx.getDay(),active=!!day&&!ctx.getShownRecord()&&day.date>='2026-11-12';if($('candidate-build'))$('candidate-build').textContent=day&&!active?'旧版ルールの保存記録｜'+(day.ruleVersion||'旧版'):'2026年11月12日固定ベース｜A12点・B9点・C/D16点・E10点・K4点';const storageTitle=$('storage-help')?.querySelector('h2');if(storageTitle)storageTitle.textContent=active?'旧版一覧の保存とバックアップ':'一覧の保存とバックアップ';for(const id of legacyIds){const n=$(id);if(n)n.hidden=active;}
  for(const id of ['export-text','open-result-viewer'])if($(id)){$(id).hidden=active;} const listLink=document.querySelector('a[href="#list-host"],a[href="#fixed-base-panel"]');if(listLink)listLink.setAttribute('href',active?'#fixed-base-panel':'#list-host'); const oldSave=$('save-pending')?.closest('.panel');if(oldSave)oldSave.hidden=active;
  // History always uses its original renderer. New fixed-base data has its own ledger.
  panel.hidden=!active;
 }
 const openSaved=button('保存済み固定ベースを開く',async()=>{const date=$('date').value,record=await latest(date);if(!record)throw Error('この日の固定ベース保存はありません');ctx.restore(record);dayDate=date;readSerial++;op++;prior=record;supplements=record.supplements;viewingSaved=true;ctx.refresh();});$('intake').append(openSaved);
 return {render(){render();hideLegacy();},reset(){dayDate=null;readSerial++;op++;supplements={};prior=null;viewingSaved=false;loadingLedger=false;panel.hidden=true;hideLegacy();},getModel:()=>model};
}};
})(globalThis);
