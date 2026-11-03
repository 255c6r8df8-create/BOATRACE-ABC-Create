/* Read-only copies made before leaving the creator. Not formal forecast records. */
(function(root){'use strict';
 const DB='BOATRACE_ABC_TRANSFER_COPIES_V1',FORMAT='ABC_RESULT_TRANSFER_COPY_V1';
 function create({core:C,indexedDB=root.indexedDB}={}){
  const clone=x=>JSON.parse(JSON.stringify(x)),ensure=(ok,message)=>{if(!ok)throw Error(message)};
  const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  async function verify(record){
   ensure(record?.format===FORMAT&&typeof record.id==='string'&&record.id.length>0&&record.id.length<120,'引き渡し控えの形式が違います');
   const {sha256,...body}=record;ensure(await C.sha(C.canon(body))===sha256,'引き渡し控えの内容が一致しません');
   const p=record.payload;ensure(p?.format==='BOATRACE_ABC_ANALYSIS_EXPORT'&&/^20\d\d-\d\d-\d\d$/.test(p.date)&&p.date===record.date&&Number.isFinite(Date.parse(record.savedAt)),'引き渡し控えの日付が違います');
   ensure(Array.isArray(p.sections)&&p.sections.length===26&&new Set(p.sections.map(s=>s.id)).size===26,'引き渡し控えの26区分が揃っていません');
   for(const s of p.sections)ensure(typeof s.id==='string'&&Array.isArray(s.columns)&&s.columns.every(v=>typeof v==='string')&&Array.isArray(s.rows)&&s.rows.every(r=>Array.isArray(r)&&r.length===s.columns.length&&r.every(v=>typeof v==='string')),'引き渡し控えの表を確認できません');
   const d=await C.verifyDraftSafetyCopy(record.safetyCopy);ensure(d.date===record.date,'入力控えと一覧の日付が違います');
   return clone(record);
  }
  async function open(){
   ensure(indexedDB,'引き渡し控えを保存できません。元の一覧は画面に保持しています');
   return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,1);let done=false;const timer=setTimeout(()=>stop(Error('控えの保存領域に接続できません。元の一覧は画面に保持しています')),10000);
    function stop(e){if(done)return;done=true;clearTimeout(timer);reject(e)}
    r.onupgradeneeded=()=>{if(done){r.transaction.abort();return;}r.result.createObjectStore('copies',{keyPath:'id'});};
    r.onerror=()=>stop(r.error);r.onblocked=()=>stop(Error('別の画面が控えを使用しています。移動せず停止しました'));
    r.onsuccess=()=>{if(done){r.result.close();return;}done=true;clearTimeout(timer);const db=r.result;db.onversionchange=()=>db.close();resolve(db);};
   });
  }
  async function readAll(){const db=await open();try{const records=await request(db.transaction('copies').objectStore('copies').getAll());for(const r of records)await verify(r);return records.sort((a,b)=>a.date.localeCompare(b.date)||a.savedAt.localeCompare(b.savedAt));}finally{db.close();}}
  async function append(records){
   for(const r of records)await verify(r);const ids=new Set();for(const r of records){ensure(!ids.has(r.id),'控えに重複した識別子があります');ids.add(r.id);}
   const db=await open();try{await new Promise((resolve,reject)=>{
    let cause;const tx=db.transaction('copies','readwrite'),store=tx.objectStore('copies'),get=store.getAll();
    get.onsuccess=()=>{try{const existing=new Map(get.result.map(r=>[r.id,r]));for(const r of records){const old=existing.get(r.id);ensure(!old||C.canon(old)===C.canon(r),'同じ識別子の控えが異なります。上書きせず停止しました');}for(const r of records)if(!existing.has(r.id))store.add(clone(r));}catch(e){cause=e;tx.abort();}};
    tx.oncomplete=resolve;tx.onabort=()=>reject(cause||tx.error||Error('控えを保存できません。元の一覧は画面に保持しています'));tx.onerror=()=>reject(tx.error);
   });}finally{db.close();}
   const after=await readAll();for(const r of records)ensure(after.some(x=>x.id===r.id&&C.canon(x)===C.canon(r)),'控えの保存後の確認ができません。再送せず停止しました');return after;
  }
  async function save(payload,safetyCopy){
   ensure(root.crypto?.randomUUID,'この画面では安全な控えの識別子を作れません。元の一覧は保持しています');
   const body={format:FORMAT,id:root.crypto.randomUUID(),date:payload.date,savedAt:new Date().toISOString(),payload:clone(payload),safetyCopy:clone(safetyCopy)};
   ensure(new TextEncoder().encode(C.canon(body)).length<=60000000,'引き渡し控えが60MBを超えます。元の入力を保持して停止しました');
   const record={...body,sha256:await C.sha(C.canon(body))};await append([record]);return record;
  }
  async function importCopy(value){const record=await verify(value);await append([record]);return record;}
  return {readAll,verify,save,importCopy,DB,FORMAT};
 }
 root.ABCTransferCopies={create,DB,FORMAT};
})(globalThis);
