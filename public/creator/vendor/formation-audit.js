
/* v20: READ-ONLY structured formation audit for UNVERIFIED v18/v19 packages.
 * It cannot authenticate sources, timestamps, or actual betting, and never writes data.
 * A10 / B8 / C16 rules are based on the user-supplied formation memo.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCForecastBetAuditV20=api;})(globalThis,function(){'use strict';
 const CIRCLED=Object.fromEntries([...'①②③④⑤⑥'].map((c,i)=>[c,String(i+1)]));
 const fail=s=>{throw Error(s)};
 const ensure=(v,s)=>{if(!v)fail(s)};
 const isBlank=s=>!String(s??'').trim()||['―','—','未指定','未確定','未照合'].includes(String(s).trim());
 const digits=s=>String(s??'').replace(/[①②③④⑤⑥]/g,x=>CIRCLED[x]);
 const id=s=>{const m=/^(.+?)(1[0-2]|[1-9])R$/.exec(String(s||''));return m?m[1]+'|'+Number(m[2]):null};
 const unique=s=>new Set(s).size===s.length;
 const invalid=s=>!/^[1-6]+$/.test(s)||!unique(s);
 const rows=section=>section.rows.map(vals=>Object.fromEntries(section.columns.map((name,i)=>[name,vals[i]])));
 const get=(day,k)=>{const x=day.sections.find(s=>s.id===k);ensure(x,'26セクションの不足 '+k);return x};
 function parseLines(raw){
  if(isBlank(raw))return {state:'EMPTY',lines:[],bets:[],errors:[]};
  const values=String(raw).trim().split(/[\n;；]+/).map(s=>s.replace(/\s+/g,'').replace(/[－−–—ー‐]/g,'-')).filter(Boolean);
  const seen=new Set(),bets=[],lines=[],errors=[];
  for(const line of values){const parts=line.split('-').map(digits);if(parts.length!==3||parts.some(invalid)){errors.push('不正なフォーメーション「'+line+'」');continue}
   let n=0;
   for(const a of parts[0])for(const b of parts[1])for(const c of parts[2]){
    if(a===b||a===c||b===c)continue;const bet=a+b+c;
    if(seen.has(bet))errors.push('他の行と買い目が重複：'+bet);else{seen.add(bet);bets.push(bet);n++}
   }
   lines.push({line,points:n});
  }
  return {state:errors.length?'INVALID':'PARSED',lines,bets,errors};
 }
 const eq=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));
 const target=(p,score)=>{
  const issues=[...p.errors];if(p.bets.length!==score)issues.push('組合せ点数：'+p.bets.length+'点（規定'+score+'点）');return issues;
 };
 const actualSet=p=>new Set(p.bets);
 const expand=(items)=>{const out=new Set();for(const [a,b,c] of items)for(const x of a)for(const y of b)for(const z of c)if(x!==y&&y!==z&&x!==z)out.add(x+y+z);return out};
 function bExpected(normal,choice){
  ensure(normal.state==='PARSED'&&normal.lines.length===1,'B通常買い目の形式が未照合');
  const cols=normal.lines[0].line.split('-').map(digits);
  ensure(cols.length===3&&cols[0]==='1'&&cols[1].length===3&&cols[2].length===4,'B通常買い目の軸・列数が不正');
  const markers=normal.lines[0].line.split('-')[1].match(/[①②③④⑤⑥]/g)||[];
  ensure(markers.length===1,'B第2列の丸数字艇が1艇と確定できません');
  const marked=digits(markers[0]);const candidates=[...cols[1]].filter(x=>x!==marked);
  ensure(candidates.length===2&&candidates.includes(choice),'B第2軸は丸数字艇を除いた2候補のみ');
  ensure([...cols[1]].every(x=>cols[2].includes(x)),'B通常の2列目艇が3列目に不足');
  const other=candidates.find(x=>x!==choice),rest=[...cols[2]].filter(x=>x!==choice);
  ensure(other&&rest.length===3,'B8点生成に必要な艇が不足');
  const expected=expand([['1'+choice,'1'+choice,rest.join('')],['1'+choice,other,'1'+choice]]);
  ensure(expected.size===8,'Bの正しい8点を一意に確認できません');return {expected,candidates,marked};
 }
 function cExpected(rank,choiceLabel){
  const q=digits(rank);
  ensure(q.length===5&&!invalid(q)&&q.includes('1'),'C除外後の2連対率順が5艇として確定していません');
  ensure(q.indexOf('1')===3||q.indexOf('1')===4,'C仮説対象ではありません');
  ensure(choiceLabel==='○'||choiceLabel==='△','C指定は○または△');
  const first=q[0],designated=q[choiceLabel==='○'?1:2],remaining=[...q].filter(x=>x!==first).join('');
  const axis='1'+designated,third='1'+designated+q[3];
  ensure(unique(axis)&&unique(third),'C指定対象が1号艇または他の艇と重複');
  const expected=expand([[first,axis,remaining],[axis,first,remaining],[axis,third,first]]);
  ensure(expected.size===16,'Cの正しい16点を一意に確認できません');return {expected,designated};
 }
 const designationBoat=s=>{const m=digits(String(s||'')).match(/[1-6]/g)||[];return m.length===1?m[0]:null};
 function auditDay(contract,day){
  ensure(contract?.section_count===26&&day?.sections?.length===26&&day.sections.every((s,i)=>s.id===contract.sections[i].id&&JSON.stringify(s.columns)===JSON.stringify(contract.sections[i].columns)),'固定26セクションの列契約が不正');
  const base={a:new Map(),b:new Map(),c:new Map()},reports=[],blockers=[];
  for(const group of ['a','b','c'])for(const row of rows(get(day,group))){const k=id(row['場・R']);ensure(k&&!base[group].has(k),'通常レース重複・不正 '+group+':'+row['場・R']);base[group].set(k,row)}
  for(const [group,expectedCount] of [['a',12],['b',9]])for(const [k,row] of base[group]){
   const parsed=parseLines(row['買い目']),issues=target(parsed,expectedCount);
   // Normal bets can be visually formatted, but overlapping multiline forms are not assumed to be distinct.
   if(issues.length)blockers.push(group.toUpperCase()+' '+row['場・R']+'：'+issues.join(' / '));
   reports.push({section:group,race:row['場・R'],kind:'通常買い目',points:parsed.bets.length,status:issues.length?'STOP':'POINTS_VALID',issues});
  }
  const cases=[['a','a-hypo',10],['b','b-hypo',8],['c','c-hypo',16]];
  for(const [g,h,count] of cases)for(const row of rows(get(day,h))){
   const k=id(row['場・R']),source=base[g].get(k),issues=[];
   if(!source){issues.push('通常'+g.toUpperCase()+'の対象レースがない');blockers.push(h+' '+row['場・R']+'：'+issues.join(' / '));reports.push({section:h,race:row['場・R'],kind:'仮説',points:0,status:'STOP',issues});continue}
   const parsed=parseLines(row['仮説買い目']);const betEmpty=isBlank(row['仮説買い目']);
   const ds=String(row['指定']||'').trim(),notSpecified=(g!=='a'&&isBlank(ds));
   if(notSpecified){if(!betEmpty||!isBlank(row['点数'])||!isBlank(row['投資']))issues.push('未指定なのに買い目・点数・投資がある');
    reports.push({section:h,race:row['場・R'],kind:'未指定・行を保持',points:0,status:issues.length?'STOP':'PENDING_DESIGNATION',issues});if(issues.length)blockers.push(h+' '+row['場・R']+'：'+issues.join(' / '));continue}
   if(betEmpty){issues.push('指定済みなのに仮説買い目がない');}
   else{issues.push(...target(parsed,count));
    if(g==='a'){
     if(source['色']!=='🔴')issues.push('A10点は🔴限定');
     const n=parseLines(source['買い目']);
     const chosen=new Set(n.bets.join('').split('')); // selected 4 boats from normal A formation
     if(chosen.size!==4||!chosen.has('1'))issues.push('通常Aの使用4艇を一意に特定できない');
     else {
      const first=parsed.lines[0]?.line.split('-').map(digits)||[];
      if(parsed.lines.length!==2||first.length!==3||first[0]!=='1'||new Set(first[1]).size!==3||first[1]!==first[2]||!eq(new Set(first[1]),new Set([...chosen].filter(x=>x!=='1'))))issues.push('A10点の1着1号艇6点側が通常Aの相手3艇と不一致');
      const head=parsed.lines[1]?.line.split('-').map(digits)||[];
      if(head.length!==3||head[0].length!==2||head[1]!=='1'||!eq(new Set(head[2]),new Set([...chosen].filter(x=>x!=='1')))||![...head[0]].every(x=>chosen.has(x)&&x!=='1'))issues.push('A10点の折り返し4点側が指定4艇と不一致');
      // The top-2 ranking among other 3 boats is not in the HTML, so not independently attested.
      issues.push('折り返し1着候補2艇の全国2連対率順位の独立証拠が未接続');
     }
    } else if(g==='b'){
     try{const choice=designationBoat(ds);ensure(choice,'B第2軸の実艇番指定が不明');const {expected}=bExpected(parseLines(source['買い目']),choice);if(!eq(actualSet(parsed),expected))issues.push('B8点の買い目組合せが第2軸と通常B買い目に一致しません')}
     catch(e){issues.push(e.message)}
    } else if(g==='c'){
     try{const symbol=ds.startsWith('○')?'○':ds.startsWith('△')?'△':null;
      const {expected,designated}=cExpected(source['2連対率順'],symbol);const named=designationBoat(ds);
      if(named&&named!==designated)issues.push('C○△指定の実艇番が2連対率順と不一致');
      if(!eq(actualSet(parsed),expected))issues.push('C16点の買い目組合せが○△指定と順位に一致しません')}
     catch(e){issues.push(e.message)}
    }
   }
   if(!betEmpty){if(String(row['点数']).trim()!==String(count))issues.push('点数欄は'+count+'が必要');if(String(row['投資']).replace(/[,，円\s]/g,'')!==String(count*100))issues.push('投資欄は'+(count*100)+'円が必要')}
   if(issues.length)blockers.push(h+' '+row['場・R']+'：'+issues.join(' / '));
   reports.push({section:h,race:row['場・R'],kind:'仮説',points:parsed.bets.length,status:issues.length?'STOP':'FORMATION_MATCH_ONLY',issues});
  }
  return {format:'ABC_V20_BET_AUDIT_READ_ONLY',date:day.date,counts:{A:base.a.size,B:base.b.size,C:base.c.size},reports,blockers,
   note:'未照合候補の買い目表記・点数・指定整合のみ。結果前の真正性、公式PDF網羅性、C確認済み証拠、正式承認は未検証。',
   officialVerified:false,formalSaveAllowed:false,canUseAsFormalList:false};
 }
 async function auditPackage(contract,pack){await globalThis.ABCForecastPackageV18.verify(contract,pack);return auditDay(contract,pack.record)}
 return {parseLines,bExpected,cExpected,auditDay,auditPackage};
});

