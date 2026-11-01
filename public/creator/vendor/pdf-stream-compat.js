/* PDF.js 5.6.205 text streams: Safari compatibility only.
 * Leave native implementations untouched; no file, network or storage access.
 * Upstream context: https://github.com/mozilla/pdf.js/issues/21924
 */
(function(root){'use strict';
 const stream=root.ReadableStream,iterator=root.Symbol?.asyncIterator;
 if(typeof stream!=='function'||!iterator)return;
 const proto=stream.prototype;
 if(typeof proto[iterator]==='function')return;
 Object.defineProperty(proto,iterator,{configurable:true,writable:true,
  value:async function*({preventCancel=false}={}){
   const reader=this.getReader();let finished=false;
   try{
    while(true){
     const next=await reader.read();
     if(next.done){finished=true;return;}
     yield next.value;
    }
   }finally{
    try{if(!finished&&!preventCancel)await reader.cancel();}
    finally{reader.releaseLock();}
   }
  }
 });
})(globalThis);
