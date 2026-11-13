(function(root){'use strict';
 const HOST='https://boatrace-abc-app.pages.dev',TYPE='ABC_FIXED_BASE_HOST_V1';let sequence=0;
 function available(){return !!root.parent&&root.parent!==root&&typeof root.addEventListener==='function';}
 function request(action,record){if(!available())return Promise.resolve({ok:false,unavailable:true});return new Promise(resolve=>{const requestId='fixed-'+Date.now()+'-'+(++sequence);let timer;const finish=value=>{root.removeEventListener('message',receive);clearTimeout(timer);resolve(value);};const receive=e=>{if(e.origin!==HOST||e.source!==root.parent||e.data?.type!==TYPE||e.data.requestId!==requestId)return;finish(e.data);};root.addEventListener('message',receive);timer=setTimeout(()=>finish({ok:false,error:'アプリ本体の保存機能がまだ更新されていません'}),2500);try{root.parent.postMessage({type:TYPE,requestId,action,...(record?{record}: {})},HOST);}catch(e){finish({ok:false,error:e.message});}});}
 async function read(){const result=await request('read');if(!result.ok)return {...result,records:[]};if(!Array.isArray(result.records))return {ok:false,records:[],error:'本体保存の応答形式が不正です'};const records=[],errors=[];for(const record of result.records){try{root.ABCFixedBaseModel.verifySnapshot(record);records.push(record);}catch(e){errors.push(e.message);}}return {ok:true,records,errors};}
 async function save(record){try{root.ABCFixedBaseModel.verifySnapshot(record);}catch(e){return {ok:false,error:e.message};}return request('save',record);}
 root.ABCFixedBaseHost=Object.freeze({read,save,available});
})(globalThis);
