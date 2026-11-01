
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABC_PDF_STAGING=api;})(globalThis,function(){'use strict';
function input(F,candidate,selectedDate,{originalChecked=false,columnChecked=false}={}){
 if(!originalChecked||!columnChecked)throw Error('対象日・場・R・全6艇と全国期別列の原本照合が必要です');
 if(candidate?.profile!=='WAKAMATSU_PERIOD_2PAGE_V1'||candidate.races.length!==12||candidate.races.some(r=>r.race_date!==selectedDate||r.venue!=='若松'||r.extraction_confirmed!=='未確認')||candidate.automaticConfirmation!==false)throw Error('解析候補と選択日の対応が不正です');
 const d=F.fresh(selectedDate);d.sources=[JSON.parse(JSON.stringify(candidate.source))];d.races=candidate.races.map(r=>({...JSON.parse(JSON.stringify(r)),extraction_confirmed:'確認済み'}));d.coverage={complete:false,expected_races:candidate.races.map(r=>({venue:r.venue,race_number:r.race_number}))};return F.validate(d);
}
return {input};});
;window.ABC_PDF_WAKAMATSU_STAGING=window.ABC_PDF_STAGING;(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./pdf-profile.js'):root.ABC_PDF_PROFILE,typeof module==='object'&&module.exports?require('./vendor/l2-wakamatsu-staging.js'):root.ABC_PDF_WAKAMATSU_STAGING);if(typeof module==='object'&&module.exports)module.exports=api;else root.ABC_PDF_STAGING=api;})(globalThis,function(P,oldStage){'use strict';
const stop=s=>{throw Error(s)};
function input(F,candidate,selectedDate,proof={}){
 if(candidate?.profile==='WAKAMATSU_PERIOD_2PAGE_V1')return oldStage.input(F,candidate,selectedDate,proof);
 if(proof.originalChecked!==true||proof.columnChecked!==true)stop('全場の原本照合と全国期別列の確認が必要です');
 const code=candidate?.source?.venue_code,venue=P.newVenues()[code],stamp=selectedDate.replace(/-/g,'');
 if(candidate?.profile!=='OFFICIAL_PERIOD_A4_2PAGE_L3'||!venue||candidate.automaticConfirmation!==false||!Array.isArray(candidate.races)||candidate.races.length!==12||!Array.isArray(candidate.evidence)||candidate.evidence.length!==72||candidate.source.url!=='https://www.boatrace.jp/syussoupdf/'+selectedDate.slice(0,4)+'/pb'+code+stamp.slice(4)+'.pdf'||candidate.source.listing_url!=='https://www.boatrace.jp/owpc/pc/race/raceindex?jcd='+code+'&hd='+stamp)stop('場・日付・PDF根拠の対応が不正です');
 if(!/^[a-f0-9]{64}$/.test(candidate.source.sha256)||candidate.source.id!=='pdf-'+candidate.source.sha256)stop('PDF原本hashの対応が不正です');
 for(let i=0;i<12;i++){const r=candidate.races[i];if(r.venue!==venue||r.race_number!==i+1||r.race_date!==selectedDate||r.extraction_confirmed!=='未確認'||r.pdf_list_source_id!==candidate.source.id)stop('解析候補のレース識別・重複・確認状態が不正です');}
 // Rebind every value to its retained original text-position evidence. No recomputation.
 for(let i=0;i<72;i++){const e=candidate.evidence[i],r=candidate.races[Math.floor(i/6)],b=r.entrants[i%6];if(!e||['grade','win','top2'].some(k=>typeof e[k]?.text!=='string'||!Number.isFinite(e[k].x)||!Number.isFinite(e[k].y))||!/^[0-9]{1,2}\.[0-9]{1,2}$/.test(e.win.text)||!/^[0-9]{1,3}\.[0-9]{1,2}$/.test(e.top2.text)||e.race!==r.race_number||e.boat!==b.boat_number||e.grade.text!==b.grade||Number(e.win.text)!==b.national_win_rate||Number(e.top2.text)!==b.national_top2_rate_percent)stop('数値とPDF読取根拠が一致しません');}
 const d=F.fresh(selectedDate);d.sources=[JSON.parse(JSON.stringify(candidate.source))];d.races=candidate.races.map(r=>({...JSON.parse(JSON.stringify(r)),extraction_confirmed:'確認済み'}));d.coverage={complete:false,expected_races:candidate.races.map(r=>({venue:r.venue,race_number:r.race_number}))};return F.validate(d);
}
function combine(F,base,candidates,proof){if(!Array.isArray(candidates)||!candidates.length||candidates.length>24)stop('PDF件数は1～24件です');const seen=new Set();let out=F.validate(base);
 for(const c of candidates){const venue=c?.races?.[0]?.venue;if(!venue||seen.has(venue))stop('同じ場のPDFが重複しています。部分取込は行いません');seen.add(venue);out=F.merge(out,input(F,c,base.race_date,proof));}
 return out;
}
return {input,combine};});

