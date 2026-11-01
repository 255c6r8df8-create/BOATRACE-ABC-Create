
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABC_PDF_PROFILE=api;})(globalThis,function(){'use strict';
const fail=s=>{throw Error('PDF解析保留：'+s)},norm=s=>s.normalize('NFKC').replace(/\s/g,'');
function parse(pages,{date,url,listingUrl,sha256}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(pages)||pages.length!==2||!/^[a-f0-9]{64}$/.test(sha256))fail('対応形式・日付・原本hashを確認できません');
 const stamp=date.replace(/-/g,''),wanted='https://www.boatrace.jp/syussoupdf/'+date.slice(0,4)+'/pb20'+stamp.slice(4)+'.pdf',listing='https://www.boatrace.jp/owpc/pc/race/raceindex?jcd=20&hd='+stamp;
 if(url!==wanted||listingUrl!==listing)fail('若松公式PDF一覧との日付・URL対応が一致しません');
 const races=[],evidence=[];for(let pi=0;pi<pages.length;pi++){
  const p=pages[pi];if(p.width!==595||p.height!==842||!Array.isArray(p.items)||p.items.length>10000)fail('ページ寸法・文字形式が未対応です');
  const items=p.items.filter(x=>typeof x.str==='string'&&x.str.trim()).map(x=>{if(![x.x,x.y].every(Number.isFinite)||Math.abs(x.x)>2000||Math.abs(x.y)>2000)fail('文字座標が不正です');return {...x,s:norm(x.str)};});
  const near=(s,x,y)=>items.filter(t=>t.s===s&&Math.abs(t.x-x)<3&&Math.abs(t.y-y)<3);
  const dateText=Number(date.slice(0,4))+'年'+Number(date.slice(5,7))+'月'+Number(date.slice(8))+'日';
  if(near(dateText,16.9,791.8).length!==1||near('若松',113.9,778.45).length!==1||near('出走予定表',243.16,764.03).length!==1)fail('PDF本文の日付・場・帳票名が一致しません');
  if(near('全国期別',256.6,733).length!==1||near('全国近況',321.4,733).length!==1||near('勝率',270.6,722).length!==1||near('2連率',296,722).length!==1)fail('全国期別／全国近況の列境界を確認できません');
  const headers=items.filter(t=>/^([1-9]|1[0-2])R$/.test(t.s)&&t.x>=15&&t.x<=28).sort((a,b)=>b.y-a.y);
  if(headers.length!==6)fail('1ページ6レースの見出しが揃いません');
  for(let hi=0;hi<headers.length;hi++){
   const h=headers[hi],no=Number(h.s.slice(0,-1));if(no!==pi*6+hi+1)fail('レース番号の欠落・重複・順序不整合');
   const time=items.filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t.s)&&Math.abs(t.y-h.y)<2&&t.x>=325&&t.x<=335);if(time.length!==1)fail(no+'Rの締切が一意ではありません');
   const bottom=headers[hi+1]?.y??40,boats=items.filter(t=>/^[1-6]$/.test(t.s)&&t.x>=12&&t.x<=20&&t.y<h.y&&t.y>bottom).sort((a,b)=>b.y-a.y);if(boats.length!==6)fail(no+'Rの6艇が揃いません');
   function field(boat,min,max,pattern,name){const hits=items.filter(t=>Math.abs(t.y-boat.y)<=2.5&&t.x>=min&&t.x<max);if(hits.length!==1||!pattern.test(hits[0].s))fail(no+'R '+boat.s+'号艇の'+name+'が不明／重複');return hits[0];}
   const entrants=boats.map((b,i)=>{if(Number(b.s)!==i+1)fail('艇番号の欠落・重複');const g=field(b,222,235,/^(A1|A2|B1|B2)$/,'級別'),w=field(b,265,290,/^\d{1,2}\.\d{1,2}$/,'全国期別勝率'),t=field(b,294,319,/^\d{1,3}\.\d{1,2}$/,'全国期別2連率');if(Number(w.s)>10||Number(t.s)>100)fail('全国値の範囲外');evidence.push({page:pi+1,race:no,boat:i+1,grade:{text:g.s,x:g.x,y:g.y},win:{text:w.s,x:w.x,y:w.y},top2:{text:t.s,x:t.x,y:t.y}});return {boat_number:i+1,grade:g.s,national_win_rate:Number(w.s),national_top2_rate_percent:Number(t.s)};});
   races.push({race_date:date,venue:'若松',race_number:no,deadline:time[0].s,entrants,pdf_list_source_id:'pdf-'+sha256,extraction_confirmed:'未確認'});
  }
 }
 return {profile:'WAKAMATSU_PERIOD_2PAGE_V1',columns:{national_win_rate:'全国期別／勝率',national_top2_rate_percent:'全国期別／2連率',not_used:'全国近況／2連率'},source:{id:'pdf-'+sha256,kind:'official-pdf-list',url,listing_url:listingUrl,sha256,page:'1-2',column_mapping:'全国期別の勝率・2連率（原本照合前）'},races,evidence,automaticConfirmation:false};
}
return {parse};});
;window.ABC_PDF_WAKAMATSU=window.ABC_PDF_PROFILE;(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./vendor/l2-wakamatsu-profile.js'):root.ABC_PDF_WAKAMATSU);if(typeof module==='object'&&module.exports)module.exports=api;else root.ABC_PDF_PROFILE=api;})(globalThis,function(oldParser){'use strict';
const NEW_VENUES={'04':'平和島','05':'多摩川','06':'浜名湖','09':'津','10':'三国','11':'びわこ','12':'住之江','13':'尼崎','14':'鳴門','17':'宮島','21':'芦屋','22':'福岡','24':'大村','02':'戸田','03':'江戸川','07':'蒲郡','08':'常滑','15':'丸亀','16':'児島','18':'徳山','19':'下関','23':'唐津'};
const SUPPORTED={...NEW_VENUES,'20':'若松'};
const fail=s=>{throw Error('PDF解析保留：'+s)},norm=s=>s.normalize('NFKC').replace(/\s/g,'');
function parseCommon(pages,{date,url,listingUrl,sha256}){
 const match=/^https:\/\/www\.boatrace\.jp\/syussoupdf\/(\d{4})\/pb(\d{2})(\d{4})\.pdf$/.exec(url),code=match?.[2],venue=NEW_VENUES[code];if(!venue)fail('未対応または未実証の場です');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(pages)||pages.length!==2||!/^[a-f0-9]{64}$/.test(sha256))fail('対応形式・日付・原本hashを確認できません');
 const stamp=date.replace(/-/g,''),wanted='https://www.boatrace.jp/syussoupdf/'+date.slice(0,4)+'/pb'+code+stamp.slice(4)+'.pdf',listing='https://www.boatrace.jp/owpc/pc/race/raceindex?jcd='+code+'&hd='+stamp;
 if(url!==wanted||listingUrl!==listing)fail('公式PDF一覧との日付・URL対応が一致しません');
 const races=[],evidence=[];for(let pi=0;pi<pages.length;pi++){
  const p=pages[pi];if(p.width!==595||p.height!==842||!Array.isArray(p.items)||p.items.length>10000)fail('ページ寸法・文字形式が未対応です');
  const items=p.items.filter(x=>typeof x.str==='string'&&x.str.trim()).map(x=>{if(![x.x,x.y].every(Number.isFinite)||Math.abs(x.x)>2000||Math.abs(x.y)>2000)fail('文字座標が不正です');return {...x,s:norm(x.str)};});
  const near=(s,x,y)=>items.filter(t=>t.s===s&&Math.abs(t.x-x)<3&&Math.abs(t.y-y)<3);
  const dateText=Number(date.slice(0,4))+'年'+Number(date.slice(5,7))+'月'+Number(date.slice(8))+'日';
  if(near(dateText,16.9,791.8).length!==1||near(venue,113.9,778.45).length!==1||near('出走予定表',243.16,764.03).length!==1)fail('PDF本文の日付・場・帳票名が一致しません');
  if(near('全国期別',256.6,733).length!==1||near('全国近況',321.4,733).length!==1||near('勝率',270.6,722).length!==1||near('2連率',296,722).length!==1)fail('全国期別／全国近況の列境界を確認できません');
  const headers=items.filter(t=>/^([1-9]|1[0-2])R$/.test(t.s)&&t.x>=15&&t.x<=28).sort((a,b)=>b.y-a.y);
  if(headers.length!==6)fail('1ページ6レースの見出しが揃いません');
  for(let hi=0;hi<headers.length;hi++){
   const h=headers[hi],no=Number(h.s.slice(0,-1));if(no!==pi*6+hi+1)fail('レース番号の欠落・重複・順序不整合');
   const time=items.filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t.s)&&Math.abs(t.y-h.y)<2&&t.x>=325&&t.x<=335);if(time.length!==1)fail(no+'Rの締切が一意ではありません');
   const bottom=headers[hi+1]?.y??40,boats=items.filter(t=>/^[1-6]$/.test(t.s)&&t.x>=12&&t.x<=20&&t.y<h.y&&t.y>bottom).sort((a,b)=>b.y-a.y);if(boats.length!==6)fail(no+'Rの6艇が揃いません');
   function field(boat,min,max,pattern,name){const hits=items.filter(t=>Math.abs(t.y-boat.y)<=2.5&&t.x>=min&&t.x<max);if(hits.length!==1||!pattern.test(hits[0].s))fail(no+'R '+boat.s+'号艇の'+name+'が不明／重複');return hits[0];}
   const entrants=boats.map((b,i)=>{if(Number(b.s)!==i+1)fail('艇番号の欠落・重複');const g=field(b,222,235,/^(A1|A2|B1|B2)$/,'級別'),w=field(b,265,290,/^\d{1,2}\.\d{1,2}$/,'全国期別勝率'),t=field(b,294,319,/^\d{1,3}\.\d{1,2}$/,'全国期別2連率');if(Number(w.s)>10||Number(t.s)>100)fail('全国値の範囲外');evidence.push({page:pi+1,race:no,boat:i+1,grade:{text:g.s,x:g.x,y:g.y},win:{text:w.s,x:w.x,y:w.y},top2:{text:t.s,x:t.x,y:t.y}});return {boat_number:i+1,grade:g.s,national_win_rate:Number(w.s),national_top2_rate_percent:Number(t.s)};});
   races.push({race_date:date,venue,race_number:no,deadline:time[0].s,entrants,pdf_list_source_id:'pdf-'+sha256,extraction_confirmed:'未確認'});
  }
 }
 return {profile:'OFFICIAL_PERIOD_A4_2PAGE_L3',columns:{national_win_rate:'全国期別／勝率',national_top2_rate_percent:'全国期別／2連率',not_used:'全国近況／2連率'},source:{id:'pdf-'+sha256,kind:'official-pdf-list',url,listing_url:listingUrl,sha256,page:'1-2',venue_code:code,column_mapping:'全国期別の勝率・2連率（原本照合前）'},races,evidence,automaticConfirmation:false};
}
function parse(pages,context){if(/^https:\/\/www\.boatrace\.jp\/syussoupdf\/\d{4}\/pb20\d{4}\.pdf$/.test(context.url))return oldParser.parse(pages,context);return parseCommon(pages,context);}
function contextForFile(name,date){const m=/^pb(\d{2})(\d{4})(?: \(\d+\))?\.pdf$/i.exec(name);if(!m||!SUPPORTED[m[1]]||!/^\d{4}-\d{2}-\d{2}$/.test(date)||m[2]!==date.replace(/-/g,'').slice(4))fail('公式PDF名・場・選択日が一致しません。1ファイルならURLを明示してください');const stamp=date.replace(/-/g,'');return {code:m[1],venue:SUPPORTED[m[1]],url:'https://www.boatrace.jp/syussoupdf/'+date.slice(0,4)+'/pb'+m[1]+m[2]+'.pdf',listingUrl:'https://www.boatrace.jp/owpc/pc/race/raceindex?jcd='+m[1]+'&hd='+stamp};}
return {parse,contextForFile,supported:()=>({...SUPPORTED}),newVenues:()=>({...NEW_VENUES})};});

