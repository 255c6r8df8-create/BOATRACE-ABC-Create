/* v18: Pre-result source HTML intake and portable UNVERIFIED forecast package.
   No bet generation, no formal confirmation, no app writes, and no timestamp attestation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCForecastPackageV18=api;})(globalThis,function(){'use strict';
 const PACK='ABC_V18_UNVERIFIED_FORECAST_PACKAGE',HASH=/^[0-9a-f]{64}$/;
 const guard=(condition,message)=>{if(!condition)throw Error(message)};
 const blank=(s)=>['','―','—','未確定','未照合'].includes(String(s??'').trim());
 const key=(s)=>{const m=/^(.+?)(1[0-2]|[1-9])R$/.exec(s||'');return m?m[1]+'|'+Number(m[2]):null};
 const records=s=>s.rows.map(v=>Object.fromEntries(s.columns.map((k,i)=>[k,v[i]])));
 const section=(day,id)=>{const s=day.sections.find(x=>x.id===id);guard(s,'26区分が不足：'+id);return s};
 const cMarks=['◎','○','△','×','▲','外',''];
 function inspect(contract,day){
  guard(contract?.section_count===26&&contract?.requires_all_26_sections===true&&contract.sections?.length===26,'正式26区分の契約がありません');
  guard(day?.format==='ABC_V13_ISOLATED_UNVERIFIED_LIST_DAY'&&day.version===1&&day.formalSave===false&&day.officialVerified===false&&day.sourceKind==='USER_HTML_UNVERIFIED','入力は未照合HTMLに限定');
  guard(day.sectionCount===26&&day.sections?.length===26&&/^20\d\d-\d\d-\d\d$/.test(day.date),'日付または区分が不正');
  guard(day.date>'2026-10-23','10月23日以前の固定原本を新規予想候補として取り込みません');
  day.sections.forEach((s,i)=>{const expected=contract.sections[i];guard(s.id===expected.id&&JSON.stringify(s.columns)===JSON.stringify(expected.columns),'26区分の列順不一致：'+s.id);guard(Array.isArray(s.rows)&&s.rows.length<=600,'区分のレース行数が不正：'+s.id);for(const row of s.rows)guard(Array.isArray(row)&&row.length===s.columns.length&&row.every(v=>typeof v==='string'&&v.length<4000),'セル内容が不正：'+s.id)});
  const issues=[],warnings=[],ids=new Map(),groups={a:0,b:0,c:0},all=[];
  for(const s of day.sections){
   const rows=records(s);
   for(let idx=0;idx<rows.length;idx++){
    const r=rows[idx],loc=s.id+' '+(idx+1)+'行';
    // Outcome values anywhere in the *source* invalidate pre-result packaging.
    for(const col of ['結果','結果印','判定','指定判定','公式配当',...(s.id==='a-grade'?['1着','2着','3着']:[])]){
     if(col in r&&!blank(r[col]))issues.push(loc+'：結果確定後の値「'+col+'」があるため予想時点原本として受け付けません');
    }
    if(['a','b','c'].includes(s.id)){
     const id=key(r['場・R']);if(!id){issues.push(loc+'：場・Rが不正');continue}
     if(ids.has(id))issues.push(loc+'：A/B/C通常に重複レース '+r['場・R']);else ids.set(id,s.id);
     if(!/^\d{2}:\d{2}$/.test(r['締切']||''))issues.push(loc+'：締切が不正');
     if(['a','b'].includes(s.id)){
      if(!['🔴','🔵','🟢'].includes(r['色']))issues.push(loc+'：色が🔴🔵🟢以外');
      if(!['','◎','○','指定なし'].includes(r['狙い']))issues.push(loc+'：狙いが◎○指定なし以外');
      if(blank(r['買い目']))issues.push(loc+'：通常買い目がありません');
     } else {
      if(!['','推し'].includes(r['推し']))issues.push(loc+'：C推しの値が不正');
      if(blank(r['2連対率順'])||blank(r['除外']))issues.push(loc+'：Cの2連対率順・除外が不足');
     }
     groups[s.id]++;all.push({group:s.id.toUpperCase(),race:r['場・R'],deadline:r['締切'],color:r['色']||'―',aim:s.id==='c'?r['推し']:r['狙い'],k:s.id==='a'?r['k除外']:s.id==='b'?r['k型']:'―',normalBet:r['買い目']||'C通常欄では非表示'});
    }
   }
  }
  // A screenshot/HTML prepared after results must not be relabeled as a pre-result package.
  // Derived score tables are accepted only when outcome-dependent fields are zero/blank.
  const derived=new Set(['確定数','結果確定数','配当確認数','的中数','的中R','確定R','的中払戻','公式配当合計','平均配当','1着','2着','3着','3着以下','2着以内','回数']);
  const outcomeSections=new Set(['a-total','a-hypo-total','a-color','a-one','a-mark','b-total','b-hypo-total','b-color','ab-aim','c-total','c-push','c-hypo-total','c-mark','total','crossfire-total','cf-image-total']);
  for(const s of day.sections)if(outcomeSections.has(s.id))for(const row of records(s))for(const [name,value] of Object.entries(row))if(derived.has(name)&&!blank(value)&&!/^0(?:\.0+)?%?$/.test(String(value).replace(/,/g,''))){issues.push(s.id+'：結果由来の集計値が入力済み（'+name+'）');}
  if(!all.length)issues.push('A/B/C通常レースがありません');
  const ordinary=new Map();for(const id of ['a','b','c'])for(const r of records(section(day,id))){const k=key(r['場・R']);if(k)ordinary.set(id+'|'+k,r)}
  for(const id of ['a-hypo','b-hypo','c-hypo']){
   const expected={ 'a-hypo':['a','10'], 'b-hypo':['b','8'], 'c-hypo':['c','16'] }[id];const seen=new Set();
   for(const r of records(section(day,id))){const k=key(r['場・R']);if(!k){issues.push(id+'：場・Rが不正');continue}
    if(seen.has(k))issues.push(id+'：同一レース重複');seen.add(k);
    const base=ordinary.get(expected[0]+'|'+k);if(!base)issues.push(id+'：通常'+expected[0].toUpperCase()+'に存在しないレース '+r['場・R']);
    if(id==='a-hypo'&&base&&base['色']!=='🔴')issues.push('A10点仮説には🔴以外を含められません');
    if(!blank(r['点数'])&&r['点数']!==expected[1])issues.push(id+'：指定点数とA10/B8/C16が不一致');
    const hasBet=!blank(r['仮説買い目']);const hasDesignation=id==='b-hypo'?!blank(r['指定']):id==='c-hypo'?!blank(r['指定']):true;
    if(!hasDesignation&&(hasBet||!blank(r['点数'])||!blank(r['投資'])))issues.push(id+'：未指定なのに買い目・点数・投資があります');
    if(id==='c-hypo'&&hasDesignation&&!/^[○△]/.test(r['指定']))issues.push('C仮説指定は○または△のみ');
   }
  }
  const aRed=new Set(records(section(day,'a')).filter(r=>r['色']==='🔴').map(r=>key(r['場・R'])));
  const aHyp=new Set(records(section(day,'a-hypo')).map(r=>key(r['場・R'])));
  for(const id of aRed)if(!aHyp.has(id))issues.push('A🔴10点仮説の対象行が不足：'+id);
  if(groups.b!==section(day,'b-hypo').rows.length)issues.push('B8点仮説の対象行は通常Bの全件が必要です（未指定でも掲載）');
  const bHyp=new Set(records(section(day,'b-hypo')).map(r=>key(r['場・R'])));
  for(const r of records(section(day,'b')))if(!bHyp.has(key(r['場・R'])))issues.push('B8点仮説の対象行が不足：'+r['場・R']);
  const circled={'①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6'};
  const cEligible=new Set();
  for(const r of records(section(day,'c'))){const str=String(r['2連対率順']||'').replace(/[①②③④⑤⑥]/g,m=>circled[m]);
   if(!/^[1-6]{5}$/.test(str)||new Set(str).size!==5||!str.includes('1')){issues.push('Cの2連対率順が5艇として確定していません：'+r['場・R']);continue}
   const ex=String(r['除外']||'').replace(/[①②③④⑤⑥]/g,m=>circled[m]);
   if(!/^[1-6]$/.test(ex)||str.includes(ex))issues.push('C除外艇と2連対率順が不一致：'+r['場・R']);
   const pos=str.indexOf('1')+1;if(pos===4||pos===5)cEligible.add(key(r['場・R']));
  }
  const cHyp=new Set(records(section(day,'c-hypo')).map(r=>key(r['場・R'])));
  for(const id of cEligible)if(!cHyp.has(id))issues.push('C16点仮説の対象行が不足（指定なしでも掲載）：'+id);
  for(const id of cHyp)if(!cEligible.has(id))issues.push('C16点仮説の対象条件に該当しない行：'+id);

  warnings.push('HTMLだけでは予想の作成時刻・公式PDF完全性・確認済みCの独立した根拠は証明できません');
  return {format:'ABC_V18_FORECAST_INSPECTION',date:day.date,counts:{A:groups.a,B:groups.b,C:groups.c},races:all,issues,warnings,packageExportAllowed:issues.length===0,formalSaveAllowed:false,officialVerified:false};
 }
 async function sha(text){guard(typeof text==='string'&&globalThis.crypto?.subtle,'SHA-256が利用できません。HTTPSまたはlocalhostで開いてください');const b=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('')}
 async function prepare(contract,day,rawHtml,readAt){const report=inspect(contract,day);guard(report.packageExportAllowed,'不正・不足項目があるため予想候補パックを作成できません');guard(typeof rawHtml==='string'&&rawHtml.length>0&&rawHtml.length<8_000_000,'元HTMLが空または容量超過');guard(typeof readAt==='string'&&!Number.isNaN(Date.parse(readAt)),'読込日時が不正');
  const body={format:PACK,version:1,date:day.date,sourceHtmlSha256:await sha(rawHtml),readAt,sourceAuthenticity:'USER_SUBMITTED_NOT_ATTESTED',status:'UNVERIFIED_FORECAST_CANDIDATE',formalSave:false,officialVerified:false,betGenerated:false,sectionCount:26,sections:day.sections,counts:report.counts};
  const payload=JSON.stringify(body);return {format:'ABC_V18_FORECAST_PACKAGE_BACKUP',version:1,record:body,payloadSha256:await sha(payload),restorableToProduction:false};
 }
 async function verify(contract,exported){guard(exported?.format==='ABC_V18_FORECAST_PACKAGE_BACKUP'&&exported.version===1&&exported.restorableToProduction===false&&HASH.test(exported.payloadSha256),'候補パック形式が不正');const body=exported.record;guard(body?.format===PACK&&body.version===1&&body.formalSave===false&&body.officialVerified===false&&body.betGenerated===false&&body.status==='UNVERIFIED_FORECAST_CANDIDATE'&&body.sourceAuthenticity==='USER_SUBMITTED_NOT_ATTESTED'&&body.sectionCount===26&&HASH.test(body.sourceHtmlSha256),'正式データと混同する候補パックは拒否');guard(await sha(JSON.stringify(body))===exported.payloadSha256,'候補パックに改変を検出');
  const day={format:'ABC_V13_ISOLATED_UNVERIFIED_LIST_DAY',version:1,date:body.date,sectionCount:26,sourceKind:'USER_HTML_UNVERIFIED',formalSave:false,officialVerified:false,sections:body.sections};const check=inspect(contract,day);guard(check.packageExportAllowed&&JSON.stringify(check.counts)===JSON.stringify(body.counts),'候補パックの内容に不一致');return check;
 }
 return {PACK,inspect,prepare,verify};
});
