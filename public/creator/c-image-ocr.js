/* Local-only My Forecast OCR. Every recognized value remains a candidate until owner confirmation. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCCImageOCR=api;})(globalThis,function(root){'use strict';
const VERSION='C_IMAGE_OCR_20261027_2',VENUES='桐生 戸田 江戸川 平和島 多摩川 浜名湖 蒲郡 常滑 津 三国 びわこ 住之江 尼崎 鳴門 丸亀 児島 宮島 徳山 下関 若松 芦屋 福岡 唐津 大村'.split(' ');
const normalize=s=>String(s||'').normalize('NFKC').replace(/[−–—]/g,'-').replace(/(\d)\s*[.．]\s*(\d)/g,'$1.$2');
const compact=s=>normalize(s).replace(/\s/g,'');
const number=s=>{const m=/^(\d{1,3}\.\d{1,2})%?$/.exec(compact(s));return m&&Number(m[1])<=100?Number(m[1]):null};
const uniq=xs=>[...new Set(xs)];
function parse(data){
 const text=normalize(data?.text||''),flat=compact(text),lines=[];
 for(const block of data?.blocks||[])for(const p of block.paragraphs||[])for(const line of p.lines||[])lines.push(line);
 const candidates=[];let period=false,section='';
 // Both the national-period anchor and the 2-ren label are required; never use another rate source.
 for(const line of text.split(/\r?\n/)){
  const c=compact(line);if(/全国期別/.test(c)){period=true;section='全国期別';}
  else if(/全国近況|当地|モーター|ボート成績/.test(c)){period=false;section=c;}
  if(period&&/2連(?:対)?率/.test(c)){const values=[...normalize(line).matchAll(/(?<![\d.])(\d{1,3}\.\d{1,2})%?(?![\d.])/g)].map(m=>Number(m[1])).filter(v=>v<=100);if(values.length===6)candidates.push({rates:values,confidence:Number(data.confidence)||0,method:'national-period-labelled-row'});}
 }
 for(let i=0;i<lines.length;i++){
  const line=lines[i],c=compact(line.text||line.words?.map(w=>w.text).join(''));
  if(!/2連(?:対)?率/.test(c))continue;
  const before=lines.slice(Math.max(0,i-5),i+1).map(x=>compact(x.text||x.words?.map(w=>w.text).join(''))).join('|');
  if(!/全国期別/.test(before)||/全国期別[^|]*(?:\|[^|]*)*\|[^|]*(?:全国近況|当地|モーター)/.test(before))continue;
  const values=(line.words||[]).map(w=>({value:number(w.text),confidence:Number(w.confidence)||0,x:w.bbox?.x0||0})).filter(w=>w.value!==null).sort((a,b)=>a.x-b.x);
  if(values.length===6)candidates.push({rates:values.map(w=>w.value),confidence:Math.min(...values.map(w=>w.confidence)),method:'national-period-word-row'});
 }

 // Vertical six-racer tables: locate the national-period subcolumn, then require all six lane rows.
 const words=lines.flatMap(l=>l.words||[]);
 const spans=pattern=>{const out=[];for(const line of lines){const ws=line.words||[];for(let i=0;i<ws.length;i++){let t='',used=[];for(let j=i;j<Math.min(i+6,ws.length);j++){t+=compact(ws[j].text);used.push(ws[j]);if(pattern.test(t)&&used.every(w=>w.bbox)){out.push({text:t,bbox:{x0:Math.min(...used.map(w=>w.bbox.x0)),x1:Math.max(...used.map(w=>w.bbox.x1)),y0:Math.min(...used.map(w=>w.bbox.y0)),y1:Math.max(...used.map(w=>w.bbox.y1))}});break;}}}}return out;};
 const anchors=spans(/^全国期別(?:成績)?$/);
 for(const label of spans(/^2連(?:対)?率$/)){
  const b=label.bbox,cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,parents=anchors.filter(a=>a.bbox.y1<=b.y1&&cy-a.bbox.y1<150&&Math.abs((a.bbox.x0+a.bbox.x1)/2-cx)<200);
  if(parents.length!==1)continue;const values=[];
  for(const lane of [1,2,3,4,5,6]){
   const laneWords=words.filter(w=>compact(w.text)===String(lane)&&w.bbox&&w.bbox.y0>b.y1&&w.bbox.x1<b.x0),matches=[];
   for(const l of laneWords){const ly=(l.bbox.y0+l.bbox.y1)/2;for(const w of words){const v=number(w.text);if(v===null||!w.bbox)continue;const wy=(w.bbox.y0+w.bbox.y1)/2,wx=(w.bbox.x0+w.bbox.x1)/2;if(Math.abs(wy-ly)<Math.max(12,l.bbox.y1-l.bbox.y0)&&Math.abs(wx-cx)<Math.max(24,(b.x1-b.x0)/2))matches.push({value:v,confidence:Number(w.confidence)||0});}}
   if(matches.length!==1){values.length=0;break;}values.push(matches[0]);
  }
  if(values.length===6)candidates.push({rates:values.map(v=>v.value),confidence:Math.min(...values.map(v=>v.confidence)),method:'national-period-vertical-column'});
 }
 const unique=uniq(candidates.map(c=>JSON.stringify(c.rates))),chosen=unique.length===1?candidates.find(c=>JSON.stringify(c.rates)===unique[0]):null;
 const dates=uniq([...flat.matchAll(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})(?:日)?/g)].map(m=>m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0')));
 const monthDays=uniq([...flat.matchAll(/(?:^|[^\d])(\d{1,2})月(\d{1,2})日/g)].map(m=>m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0')));
 const venues=uniq(flat.match(new RegExp(VENUES.slice().sort((a,b)=>b.length-a.length).join('|'),'g'))||[]),rs=uniq([...flat.matchAll(/(?<!\d)(1[0-2]|[1-9])R/g)].map(m=>Number(m[1])));
 const times=uniq([...flat.matchAll(/(?:締切(?:予定)?|投票締切)[^\d]{0,5}([0-2]?\d):([0-5]\d)/g)].map(m=>m[1].padStart(2,'0')+':'+m[2]).filter(t=>t<'24:00'));
 return {version:VERSION,status:chosen?'READ_CANDIDATE':'NEEDS_CONFIRMATION',rates:chosen?chosen.rates:[null,null,null,null,null,null],rateConfidence:chosen?.confidence??0,rateMethod:chosen?.method??null,identity:{date:dates.length===1?dates[0]:null,monthDay:monthDays.length===1?monthDays[0]:null,venue:venues.length===1?venues[0]:null,raceNumber:rs.length===1?rs[0]:null,deadline:times.length===1?times[0]:null},warnings:[...(!chosen?['全国期別成績の2連率6艇を一意に読めませんでした。他の数値では補完しません。']:[]),...(chosen&&chosen.confidence<80?['認識信頼度が低いため全6値の目視確認が必要です。']:[]),...(dates.length!==1||venues.length!==1||rs.length!==1?['開催日・場・Rに未確認または複数候補があります。']:[])],text:text.slice(0,20000)};
}
function compareIdentity(ocr,date,venue,no){const p=ocr?.identity;if(!p)return 'INCOMPLETE';if(p.date&&p.date!==date||p.monthDay&&p.monthDay!==date.slice(5)||p.venue&&p.venue!==venue||p.raceNumber&&p.raceNumber!==Number(no))return 'MISMATCH';return p.date&&p.venue&&p.raceNumber?'MATCH':'INCOMPLETE';}
// Retry only the numeric area of a positively identified national-period row.
// No punctuation substitution: a second OCR must actually read six decimal values.
function nationalRateRects(data){
 const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])),out=[];let period=false;
 for(const l of lines){const t=compact(l.text||l.words?.map(w=>w.text).join(''));
  if(/全国期別/.test(t))period=true;else if(/全国近況|当地|モーター|ボート成績/.test(t))period=false;
  if(!period||!/2連(?:対)?率/.test(t))continue;const ws=l.words||[];let label='',end=null;
  for(const w of ws){label+=compact(w.text);if(/^2連(?:対)?率$/.test(label)){end=w.bbox?.x1;break;}if(label.length>8)break;}
  const box=l.bbox;if(end&&box&&box.x1>end+30)out.push({left:Math.floor(end+2),top:Math.max(0,box.y0-4),width:Math.ceil(box.x1-end+4),height:Math.ceil(box.y1-box.y0+8)});
 }return out;
}
async function refineNumericRows(data,read){
 if(parse(data).rates.every(v=>v!==null))return data;
 const texts=[];for(const rectangle of nationalRateRects(data)){const result=await read(rectangle),values=[...String(result).matchAll(/(?<![\d.])(\d{1,3}\.\d{1,2})(?![\d.])/g)].map(m=>m[1]);if(values.length===6&&values.every(v=>Number(v)<=100))texts.push('全国期別成績\n2連率 '+values.join(' '));}
 return {...data,text:data.text+'\n'+texts.join('\n')};
}

// Explicit template for the official desktop My Forecast table photographed on iPhone.
// Geometry is accepted only with one header, six regular grid rows and the lane 3..6 colours.
// This yields candidates, never confirmation. Header text/year can remain unreadable.
function officialForecastGrid(canvas){
 const {width:w,height:h}=canvas,px=canvas.getContext('2d').getImageData(0,0,w,h).data;
 const rgb=(x,y)=>{const i=(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4;return [px[i],px[i+1],px[i+2]]};
 const blue=([r,g,b])=>b>110&&b>r*1.25&&b>g*1.10,grid=([r,g,b])=>r<205&&b>r+10&&b>g+5;
 const groups=(values,gap=1)=>{const out=[];for(const n of values){const last=out.at(-1);if(last&&n-last.at(-1)<=gap)last.push(n);else out.push([n]);}return out};
 const ys=[];for(let y=0;y<h;y++){let n=0,total=0;for(let x=Math.floor(w*.04);x<w*.96;x+=2){total++;if(blue(rgb(x,y)))n++;}if(n/total>.55)ys.push(y);}
 const bands=groups(ys).map(a=>({top:a[0],bottom:a.at(-1)+1})).filter(b=>b.bottom-b.top>=4),found=[];
 for(const header of bands.filter(b=>b.top>h*.15&&b.top<h*.75&&b.bottom-b.top>w*.055&&b.bottom-b.top<w*.15)){
  const xs=[];for(let x=0;x<w;x++){let n=0,total=0;for(let y=header.top;y<header.bottom;y+=2){total++;if(blue(rgb(x,y)))n++;}if(n/total>.6)xs.push(x);}if(!xs.length)continue;
  const left=xs[0],right=xs.at(-1)+1,width=right-left;if(width<w*.75)continue;
  const edges=[];for(let y=header.bottom+1;y<Math.min(h,header.bottom+width*.8);y++){let n=0,total=0;for(let x=left+2;x<right-2;x+=2){total++;if(grid(rgb(x,y)))n++;}if(n/total>.7)edges.push(y);}
  const lines=groups(edges,2).map(a=>Math.round((a[0]+a.at(-1))/2)).filter(y=>y-header.bottom>width*.035),ends=[];for(const y of lines)if(!ends.length||y-ends.at(-1)>width*.035)ends.push(y);if(ends.length<6)continue;
  const bounds=[header.bottom,...ends.slice(0,6)],heights=bounds.slice(1).map((y,i)=>y-bounds[i]),mean=heights.reduce((a,b)=>a+b,0)/6;if(mean<width*.055||mean>width*.14||heights.some(v=>Math.abs(v-mean)>mean*.1))continue;
  const colours=[2,3,4,5].map(i=>rgb(left+width*.05,bounds[i]+heights[i]*.65));
  if(!((a=>a[0]>130&&a[1]<150&&a[2]<150)(colours[0])&&(a=>a[2]>130&&a[0]<120)(colours[1])&&(a=>a[0]>160&&a[1]>140&&a[2]<160)(colours[2])&&(a=>a[1]>80&&a[1]>a[0]*1.1&&a[1]>a[2]*1.1)(colours[3])))continue;
  const rband=bands.filter(b=>b.bottom<header.top&&b.bottom-b.top<width*.035&&b.bottom-b.top>width*.01).at(-1);
  const active=(top,bottom,min,max)=>{if(top<0)return null;const xx=[];for(let x=left;x<right;x++){let n=0,total=0;for(let y=Math.floor(top);y<bottom;y++){total++;const [r,g,b]=rgb(x,y);if(r<100&&g<150&&b>100&&b>r*1.4)n++;}if(n/total>.65)xx.push(x);}const candidates=groups(xx,Math.ceil(width*.025)).map(a=>({x:a[0],width:a.at(-1)-a[0]+1})).filter(a=>a.width>width*min&&a.width<width*max&&a.x>left+width*.2);return candidates.length===1?candidates[0]:null;};
  const race=rband&&active(rband.top,rband.bottom,.035,.1),date=rband&&active(rband.top-width*.065,rband.top-width*.01,.12,.2);
  found.push({template:'OFFICIAL_MY_FORECAST_DESKTOP_V1',header:{left,top:header.top,width,height:header.bottom-header.top},bounds,rateColumn:{left:left+width*.304,top:header.bottom,width:width*.059,height:bounds.at(-1)-header.bottom},venue:{left:left+width*.025,top:header.top-width*.35,width:width*.11,height:width*.055},date:date?{left:date.x,top:rband.top-width*.065,width:date.width,height:width*.027}:null,race:race?{left:race.x,top:rband.top,width:race.width,height:width*.03}:null,deadline:race?{left:race.x,top:rband.top+width*.031,width:race.width,height:width*.031}:null});
 }
 return found.length===1?found[0]:null;
}
// Deterministic cubic enlargement retains the small decimal-point pixels that
// bilinear Canvas resizing erased in the real official screenshot.
function enlargeCubic(source,width,height){
 const sw=source.width,sh=source.height,p=source.getContext('2d').getImageData(0,0,sw,sh),canvas=root.document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),d=ctx.createImageData(width,height);
 const cubic=v=>{v=Math.abs(v);return v<=1?(1.5*v-2.5)*v*v+1:v<2?((-0.5*v+2.5)*v-4)*v+2:0};
 const xweights=Array.from({length:width},(_,x)=>{const sx=(x+.5)*sw/width-.5,ix=Math.floor(sx);return [-1,0,1,2].map(dx=>({x:Math.max(0,Math.min(sw-1,ix+dx)),v:cubic(sx-ix-dx)}))});
 for(let y=0;y<height;y++){const sy=(y+.5)*sh/height-.5,iy=Math.floor(sy),yw=[-1,0,1,2].map(dy=>({y:Math.max(0,Math.min(sh-1,iy+dy)),v:cubic(sy-iy-dy)}));for(let x=0;x<width;x++){const c=[0,0,0];for(const a of yw)for(const b of xweights[x]){const j=(a.y*sw+b.x)*4,f=a.v*b.v;for(let k=0;k<3;k++)c[k]+=f*p.data[j+k];}const i=(y*width+x)*4;for(let k=0;k<3;k++)d.data[i+k]=Math.round(c[k]);d.data[i+3]=255;}}
 ctx.putImageData(d,0,0);return canvas;
}
function cropCanvas(source,r,scale=8,whiteText=false){
 const left=Math.max(0,Math.floor(r.left)),top=Math.max(0,Math.floor(r.top)),width=Math.min(source.width-left,Math.round(r.width)),height=Math.min(source.height-top,Math.round(r.height));if(width<2||height<2)throw Error('画像の切出し範囲を確認できません');
 const small=root.document.createElement('canvas');small.width=width;small.height=height;const ctx=small.getContext('2d');ctx.drawImage(source,left,top,width,height,0,0,width,height);
 if(whiteText){const pixels=ctx.getImageData(0,0,width,height);for(let i=0;i<pixels.data.length;i+=4){const cutoff=whiteText==='dim'?90:145,n=pixels.data[i]>cutoff&&pixels.data[i+1]>cutoff&&pixels.data[i+2]>cutoff?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;}ctx.putImageData(pixels,0,0);}
 const canvas=enlargeCubic(small,Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));small.width=small.height=1;return canvas;
}
async function readOfficialForecast(canvas,worker,layout){
 const result={rates:[null,null,null,null,null,null],identity:{},template:layout.template,sourceRequiresConfirmation:true,rateRects:[]};
 // Read the complete, bounded column so the OCR keeps all six rows in context.
 const col={...layout.rateColumn,top:layout.rateColumn.top+1,height:layout.rateColumn.height-2};result.rateRects=[col];
 const strip=cropCanvas(canvas,col,Math.min(8,3200/col.height));
 try{await worker.reinitialize('eng');await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'0123456789.'});const data=(await worker.recognize(strip,{}, {text:true,blocks:true})).data;
  const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])),values=[];
  for(let i=0;i<6;i++){const row=[];for(const line of lines){const value=number(line.text||line.words?.map(w=>w.text).join('')),box=line.bbox;if(value===null||!box)continue;const y=col.top+(box.y0+box.y1)/2*col.height/strip.height,top=layout.bounds[i],end=layout.bounds[i+1];if(y>top+(end-top)*.5&&y<end)row.push(value);}values.push(row.length===1?row[0]:null);}result.rates=values;result.rateConfidence=Number(data.confidence)||0;
 }finally{strip.width=strip.height=1;}
 async function read(r,white,chars){if(!r)return '';const c=cropCanvas(canvas,r,8,white);try{await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:chars||''});return String((await worker.recognize(c,{}, {text:true})).data.text||'');}finally{c.width=c.height=1;}}
 await worker.reinitialize('jpn');const venue=compact(await read(layout.venue,false));const vv=VENUES.filter(v=>venue.includes(v));if(vv.length===1)result.identity.venue=vv[0];
 const date=compact(await read(layout.date,'dim'));let dm=/(\d{1,2})月(\d{1,2})日/.exec(date);if(!dm&&layout.date){await worker.reinitialize('eng');const digits=compact(await read(layout.date,'dim','0123456789'));dm=/^(\d{2})(\d{2})$/.exec(digits);}if(!dm&&layout.date){const r=layout.date,ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,xs=[];for(let x=Math.ceil(r.left);x<r.left+r.width;x++){let n=0;for(let y=Math.ceil(r.top+r.height*.18);y<r.top+r.height*.88;y++){const i=(y*canvas.width+x)*4;if(pixels[i]>90&&pixels[i+1]>90&&pixels[i+2]>90)n++;}if(n>=Math.max(2,Math.floor(r.height*.12)))xs.push(x);}const glyphs=[];for(const x of xs){const a=glyphs.at(-1);if(a&&x-a.at(-1)===1)a.push(x);else glyphs.push([x]);}if(glyphs.length===6&&glyphs.every(g=>g.length<r.width*.13)){const part=(a,b)=>({left:glyphs[a][0]-1,top:r.top+2,width:glyphs[b].at(-1)-glyphs[a][0]+3,height:r.height-3}),month=compact(await read(part(0,1),'dim','0123456789')),day=compact(await read(part(3,4),'dim','0123456789'));if(/^\d{1,2}$/.test(month)&&/^\d{1,2}$/.test(day))dm=['',month,day];}}if(dm&&Number(dm[1])>=1&&Number(dm[1])<=12&&Number(dm[2])>=1&&Number(dm[2])<=31)result.identity.monthDay=dm[1].padStart(2,'0')+'-'+dm[2].padStart(2,'0');
 const race=compact(await read(layout.race,true,'0123456789R'));const rm=/^(1[0-2]|[1-9])R?$/.exec(race);if(rm)result.identity.raceNumber=Number(rm[1]);
 const time=compact(await read(layout.deadline,false,'0123456789:'));if(/^([01]\d|2[0-3]):[0-5]\d$/.test(time))result.identity.deadline=time;
 return result;
}

const base=root.document?new URL('.',root.document.currentScript?.src||root.document.baseURI).href:null;
async function recognize(dataUrl,onProgress=()=>{}){
 if(!base||!root.Tesseract)throw Error('端末内OCRモジュールを読み込めません');
 const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('画像を表示できません'));im.src=dataUrl});
 const factor=Math.min(1,2200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 let worker,timer,finished=false;
 try{
  const job=(async()=>{worker=await root.Tesseract.createWorker('jpn+eng',1,{workerPath:new URL('vendor/ocr/worker.min.js',base).href,corePath:new URL('vendor/ocr/',base).href,langPath:new URL('vendor/ocr/',base).href,cacheMethod:'none',gzip:true,workerBlobURL:true,logger:m=>onProgress(m)});if(finished){await worker.terminate();throw Error('OCRの待機を終了しました');}await worker.setParameters({tessedit_pageseg_mode:'6'});const layout=officialForecastGrid(canvas),result=layout?{data:{text:'',blocks:[]}}:await worker.recognize(canvas,{}, {text:true,blocks:true});let parsed;
   if(layout){const scoped=await readOfficialForecast(canvas,worker,layout);parsed=parse(result.data);parsed.rates=scoped.rates;parsed.status=scoped.rates.every(v=>v!==null)?'READ_CANDIDATE':'NEEDS_CONFIRMATION';parsed.rateMethod='official-forecast-six-row-column';parsed.rateConfidence=scoped.rateConfidence||0;parsed.identity={date:null,monthDay:null,venue:null,raceNumber:null,deadline:null,...scoped.identity};parsed.warnings=['全国期別2連率の列を公式表レイアウトから切り出しました。列見出し・6艇と読取値を画像で本人確認してください。','画像に年がない場合、開催年は自動確定しません。開催日・場・Rを本人確認してください。',...(parsed.status==='NEEDS_CONFIRMATION'?['6艇の小数値を一意に読めないため記録前の確認が必要です。']:[])];parsed.recognition={template:scoped.template,sourceRequiresConfirmation:true,rateRects:scoped.rateRects};
   }else{const refined=await refineNumericRows(result.data,async rectangle=>{await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789. %'});return (await worker.recognize(canvas,{rectangle},{text:true})).data.text});parsed=parse(refined);}
   return {...parsed,readAt:new Date().toISOString(),ocrWidth:canvas.width,ocrHeight:canvas.height};})();
  return await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCRが90秒以内に完了しませんでした。画像は保持します。')),90000)})]);
 }finally{finished=true;clearTimeout(timer);if(worker)await worker.terminate();canvas.width=canvas.height=1;}
}
return {VERSION,VENUES,parse,compareIdentity,nationalRateRects,refineNumericRows,officialForecastGrid,recognize};
});
