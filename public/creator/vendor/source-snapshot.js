
/* v13 isolated day snapshots: pure canonicalization/validation with zero storage effects.
 * Does not attest official results, bets or user authorization. */
(function(root,factory){const obj=factory();if(typeof module==='object'&&module.exports)module.exports=obj;else root.ABCListSnapshotCoreV13=obj;})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const FORMAT='ABC_V13_ISOLATED_UNVERIFIED_LIST_DAY';
 const dateOk=(s)=>/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s||'')&&new Date(s+'T00:00:00Z').toISOString().startsWith(s);
 function ensure(x,msg){if(!x)throw new Error(msg)}
 const safeText=(str)=>String(str||'').trim().replace(/[\t\r ]+/g,' ').replace(/\n\s+/g,'\n');
 function extract(doc,baseContract){
  ensure(doc&&typeof doc.querySelectorAll==='function','HTML解析不可');
  let contract;try{contract=JSON.parse(doc.querySelector('#list-template-contract')?.textContent||'')}catch(e){throw Error('26区分テンプレート契約がありません')}
  ensure(contract.format==='BOAT_RACE_LIST_HTML'&&contract.section_count===26&&contract.requires_all_26_sections===true&&Array.isArray(contract.sections)&&contract.sections.length===26,'26区分テンプレート契約の形式が違います');
  ensure(dateOk(contract.target_date)&&contract.reject_reused_daily_data===true,'開催日または日付再使用禁止の契約値が不正です');
  const provenance=doc.querySelector('#pre-result-10-18-provenance');
  if(provenance){let meta;try{meta=JSON.parse(provenance.textContent)}catch(e){throw Error('元データの来歴JSONが破損')}ensure(meta.date===contract.target_date,'元データの来歴日付が異なります。過去の一覧の流用を拒否')}
  const heading=doc.querySelector('h1')?.textContent||'';const [y,m,d]=contract.target_date.split('-');
  ensure(heading.includes(`${Number(y)}年${Number(m)}月${Number(d)}日`)||heading.includes(`${y}/${m}/${d}`)||heading.includes(contract.target_date),'見出しの日付が契約値と一致しません');
  ensure(baseContract&&Array.isArray(baseContract.sections)&&baseContract.sections.length===26,'照合基準の契約がありません');
  ensure(contract.sections.every((v,i)=>v.id===baseContract.sections[i].id&&v.data_block===baseContract.sections[i].data_block&&JSON.stringify(v.columns)===JSON.stringify(baseContract.sections[i].columns)),'26区分の列・順序が固定テンプレートと異なります');
  const sections=[];let totalRows=0;
  const allNames=new Set();
  for(const config of contract.sections){
   ensure(!allNames.has(config.id),'セクション識別子が重複');allNames.add(config.id);
   const sec=doc.querySelectorAll(`section[id="${config.id}"]`);
   ensure(sec.length===1,'セクションが欠損または重複: '+config.id);
   const body=sec[0].querySelectorAll('tbody[data-block]');
   ensure(body.length===1&&body[0].getAttribute('data-block')===config.data_block,'データ領域が欠損・重複: '+config.id);
   const table=body[0].closest('table');ensure(table&&sec[0].contains(table),'表形式が不正: '+config.id);
   const columns=[...table.querySelectorAll('thead tr:first-child th')].map(x=>safeText(x.textContent));
   ensure(JSON.stringify(columns)===JSON.stringify(config.columns),'見出し列が不一致: '+config.id);
   const rows=[];
   for(const tr of body[0].children){ensure(tr.tagName==='TR','表の行に想定外の要素');const cells=[...tr.children];ensure(cells.length===columns.length&&cells.every(c=>c.tagName==='TD'),'表のセル数が不一致: '+config.id);
    const vals=cells.map(td=>{const multi=td.querySelectorAll('.pair > div');return multi.length?[...multi].map(x=>safeText(x.textContent)).join('\n'):safeText(td.textContent)});
    rows.push(vals);totalRows++;
   }
   sections.push({id:config.id,title:safeText(sec[0].querySelector('h2')?.textContent||config.title),columns,rows});
  }
  ensure(sections.filter(s=>['a','b','c'].includes(s.id)).reduce((v,s)=>v+s.rows.length,0)>0,'ABC通常一覧が空です');
  ensure(totalRows<5000,'レース・集計行数が多すぎます');
  return {format:FORMAT,version:1,date:contract.target_date,templateVersion:String(contract.version),sectionCount:26,sourceKind:'USER_HTML_UNVERIFIED',officialVerified:false,formalSave:false,sections};
 }
 function validate(day,baseContract){
  ensure(day&&day.format===FORMAT&&day.version===1&&dateOk(day.date)&&day.sourceKind==='USER_HTML_UNVERIFIED'&&day.officialVerified===false&&day.formalSave===false,'隔離・未照合一覧ではありません');
  ensure(day.sectionCount===26&&Array.isArray(day.sections)&&day.sections.length===26,'26セクションが揃っていません');
  ensure(baseContract&&baseContract.sections.length===26,'固定列契約がありません');
  let normalRows=0;
  day.sections.forEach((section,i)=>{
   const b=baseContract.sections[i];ensure(section.id===b.id&&JSON.stringify(section.columns)===JSON.stringify(b.columns),'保存一覧の列構造が不一致');
   ensure(typeof section.title==='string'&&Array.isArray(section.rows)&&section.rows.length<1000,'保存一覧の行形式が不正');
   section.rows.forEach(cells=>ensure(Array.isArray(cells)&&cells.length===b.columns.length&&cells.every(v=>typeof v==='string'&&v.length<4000),'保存一覧のセルが不正'));
   if(['a','b','c'].includes(section.id))normalRows+=section.rows.length;
  });
  ensure(normalRows>0,'ABC一覧が空です');return day;
 }
 async function hash(s){ensure(typeof s==='string'&&globalThis.crypto?.subtle,'SHA-256は安全なブラウザ環境でのみ利用できます');const ab=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(ab),v=>v.toString(16).padStart(2,'0')).join('')}
 async function verifyRow(row,baseContract){
  ensure(row&&typeof row==='object'&&dateOk(row.date)&&row.format==='ABC_V13_APPEND_ONLY_RECORD'&&row.version===1&&row.scope==='owner-sandbox-preview'&&row.verifiedOfficial===false&&row.formalSave===false,'保存レコードの形式が不正');
  ensure(typeof row.payload==='string'&&row.payload.length<8_000_000&&/^[a-f\d]{64}$/.test(row.payloadSha256||'')&&/^[a-f\d]{64}$/.test(row.sourceSha256||''),'保存レコードのSHA形式が不正');
  ensure(await hash(row.payload)===row.payloadSha256,'保存一覧の内容SHA-256が不一致');
  let day;try{day=JSON.parse(row.payload)}catch(e){throw Error('保存一覧のJSONが破損')}
  validate(day,baseContract);ensure(day.date===row.date,'保存日付と内容の日付が不一致');return day;
 }
 return {FORMAT,dateOk,extract,validate,hash,verifyRow};
});

