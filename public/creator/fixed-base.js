/* Confirmed 2026-11-12 rules. Pure functions; never mutate historical days.
 * An absent metric is pending, never zero. C/D geometry is separate from entry.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCFixedBase=api;})(globalThis,function(){'use strict';
const VERSION='FIXED_BASE_20261112';
const fail=s=>{throw Error(s)};
function hundredths(v,label,max){
 if(v===null||v===undefined||v==='')return null;
 const s=String(v);if(!/^\d+(?:\.\d{1,2})?$/.test(s))fail(label+'は小数2桁以内で指定してください');
 const [a,b='']=s.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>max*100)fail(label+'が範囲外です');return n;
}
function boats(input){
 if(!Array.isArray(input)||input.length!==6)fail('出走6艇が必要です');
 return input.map((b,i)=>{if(b.boat!==i+1||!['A1','A2','B1','B2'].includes(b.grade))fail('艇番・級別が不正です');
 return {...b,rate100:hundredths(b.rate,'全国2連対率',100),win100:hundredths(b.win,'全国勝率',10),st100:hundredths(b.averageST,'平均ST',1)};});
}
const pending=(...reasons)=>({status:'pending',reasons});
const no=reason=>({status:'not_applicable',reason});
function ranked(bs){if(bs.some(b=>b.rate100===null))fail('全国2連対率6艇が不足');return [...bs].sort((a,b)=>b.rate100-a.rate100||a.boat-b.boat);}
function expand(forms){const set=new Set();for(const [a,b,c]of forms)for(const x of a)for(const y of b)for(const z of c)if(x!==y&&x!==z&&y!==z)set.add(`${x}-${y}-${z}`);return [...set].sort();}
function result(group,axis,forms,points,extra={}){const tickets=expand(forms);if(tickets.length!==points)fail(group+'点数不一致');return {status:'eligible',ruleVersion:VERSION,group,axis,forms:forms.map(f=>f.map(p=>p.join('')).join('-')),tickets,points,...extra};}
function keepPair(input,a,b){const bs=boats(input),x=bs[a-1],y=bs[b-1];if(!x||!y||a===b)fail('比較艇が不正です');if(x.win100===null||y.win100===null)return pending('比較艇の全国勝率不足');const ax=x.win100>=450,by=y.win100>=450;return {status:'selected',boat:ax!==by?(ax?a:b):Math.min(a,b)};}
function highest(bs){
 const rate=Math.max(...bs.map(b=>b.rate100)),tied=bs.filter(b=>b.rate100===rate);
 if(tied.length===1)return {status:'selected',boat:tied[0].boat};
 if(tied.some(b=>b.win100===null))return pending('軸同率比較の全国勝率不足');
 return {status:'selected',boat:[...tied].sort((a,b)=>b.win100-a.win100||a.boat-b.boat)[0].boat};
}
function layout(input){
 const bs=boats(input);if(bs.some(b=>b.rate100===null))return pending('全国2連対率6艇が不足');
 const order=ranked(bs).map(b=>b.boat),excluded=Math.max(...order.slice(4)),remaining=order.filter(b=>b!==excluded),left=remaining.slice(0,3),right=remaining.slice(3),basic=highest(left.map(b=>bs[b-1]));
 if(basic.status==='pending')return basic;
 let swapped=false;if(basic.boat===6){const inner=Math.min(...right);left[left.indexOf(6)]=inner;right[right.indexOf(inner)]=6;swapped=true;}
 return {status:'ready',order,excluded,left,right,swapped};
}
function general16(input,axis,l=layout(input)){
 if(l.status!=='ready')return l;
 if(l.excluded===axis)return no('必須軸が除外艇に一致');
 if(!l.left.includes(axis))return no('軸が左3艇に含まれない');
 const forms=[];for(const other of l.left.filter(b=>b!==axis))for(const right of l.right)forms.push([[axis,other,right],[axis,other,right],[other,right]]);
 return result('GENERAL16',axis,forms,16,{layout:l});
}
function evaluateB(input){
 const bs=boats(input);if(bs.some(b=>b.rate100===null))return pending('全国2連対率6艇が不足');
 const order=ranked(bs).map(b=>b.boat);if(!['124','134','135'].includes(order.slice(0,3).join('')))return no('Bの全国率上位3艇の並びに非該当');
 const second=order.slice(0,4).filter(b=>b!==1),third=[...second,order[4]];
 return result('B',1,[[[1],second,third]],9,{patterns:['B-TOP3-124-134-135'],order});
}
function evaluateC(input,{originalC=false}={}){
 if(!originalC)return no('元抽出Cではない');
 const bs=boats(input),l=layout(input);if(l.status!=='ready')return l;
 if(l.order.indexOf(1)<4)return no('①の全国2連対率が5位・6位ではない');
 const raw=[];
 if(bs[1].grade==='A2'&&l.order[0]===2&&l.left.includes(2))raw.push({axis:2,gap:5,pattern:'C-2A2-RATE1'});
 if(bs[4].grade==='A1'&&l.left.includes(5))raw.push({axis:5,gap:3,pattern:'C-5A1'});
 if(!raw.length)return no('Cの採用2パターンに非該当');
 const unknown=[],qualified=[];
 for(const p of raw){if(bs[0].st100===null||bs[p.axis-1].st100===null)unknown.push(p.axis);else if(bs[0].st100-bs[p.axis-1].st100>=p.gap)qualified.push(p);}
 // An unresolved inner candidate could win priority; do not silently choose ⑤.
 const chosen=qualified.sort((a,b)=>a.axis-b.axis)[0];
 if(unknown.length&&(!chosen||unknown.some(a=>a<chosen.axis)))return pending('①と候補軸の平均STが不足');
 if(!chosen)return no('平均ST差の採用条件に非該当');
 const out=general16(input,chosen.axis,l);return {...out,group:'C',patterns:qualified.map(p=>p.pattern),selectedPattern:chosen.pattern,STDifference:(bs[0].st100-bs[chosen.axis-1].st100)/100};
}
function evaluateD(input,{originalA=false,periodOneCourseRate=null}={}){
 if(!originalA)return no('元抽出Aではない');
 const bs=boats(input),course=hundredths(periodOneCourseRate,'期別1コース2連対率',100);
 if(course===null)return pending('対象時点の期別1コース2連対率が不足');
 const cap=bs[0].grade.startsWith('A')?7000:6500;if(course>cap)return no('Dの期別1コース率の条件に非該当');
 const l=layout(input);if(l.status!=='ready')return l;
 const chosen=highest(l.left.map(b=>bs[b-1]));if(chosen.status!=='selected')return chosen;
 return {...general16(input,chosen.boat,l),group:'D'};
}
function evaluateA(input,{originalA=false,normalA=null}={}){
 const bs=boats(input);if(!originalA||bs[0].grade!=='A2')return no('元A・①A2に非該当');
 if(!normalA)return pending('保存通常A12点の生成結果が不足');
 if(normalA.color!=='🔴')return no('A🔴ではない');
 const forms=[[[...String(normalA.first)].map(Number),[...String(normalA.second)].map(Number),[...String(normalA.third)].map(Number)]];
 const patterns=['A-RED-A2-01'];if(bs.slice(0,5).map(b=>b.grade[0]).join('')==='ABABA')patterns.push('A-RED-A2-ABABA-02');
 return result('A',null,forms,12,{patterns});
}
const K_POLICY=Object.freeze({"id":"CONFIRMED_K_20261112","source":"固定ベース_確定確認書_20261112.json / K、最新確定記録.json / K_current","entry":{"nationalFirstBoat":1,"nationalSecondBoat":5,"topFourBoats":[1,2,3,5]},"firstBoats":[1],"secondRateRanks":[3,5],"thirdRateRanks":[2,4],"points":4,"refinement":{"nationalFifthBoat":4,"sameFormation":true},"additionalCandidateRules":[]});
function evaluateK(input){
 const bs=boats(input);if(bs.some(b=>b.rate100===null))return pending('全国2連対率6艇が不足');
 const q=ranked(bs).map(b=>b.boat);
 // Preserve the separately adopted K entry, never add these 4 bets to current B9.
 if(q[0]!==K_POLICY.entry.nationalFirstBoat||q.slice(0,4).sort((a,b)=>a-b).join('')!==K_POLICY.entry.topFourBoats.join('')||q[1]!==K_POLICY.entry.nationalSecondBoat)return no('採用済みK基本条件に非該当');
 const patterns=['B-K-002'];if(q[4]===K_POLICY.refinement.nationalFifthBoat)patterns.push('B-K-003');
 return result('K',1,[[K_POLICY.firstBoats,K_POLICY.secondRateRanks.map(rank=>q[rank-1]),K_POLICY.thirdRateRanks.map(rank=>q[rank-1])]],K_POLICY.points,{patterns,order:q});
}
function evaluateLegacyKs(input,{raceNumber}={}){
 const bs=boats(input);if(bs.some(b=>b.rate100===null))return [pending('全国2連対率6艇が不足')];
 const q=ranked(bs).map(b=>b.boat),top4=q.slice(0,4).sort((a,b)=>a-b).join('');
 if(q[0]!==1||!['1234','1235','1345'].includes(top4))return [];
 const rows=[],add=(id,second,third)=>{const v=result('K',1,[[[1],second,third]],4,{patterns:[id],order:q});const same=rows.find(x=>x.tickets.join('|')===v.tickets.join('|'));if(same)same.patterns.push(id);else rows.push(v);};
 const base=evaluateK(input);if(base.status==='eligible')rows.push(base);
 if(bs[1].grade==='B1'&&q[1]===2)add('B-DEL2-01',[3,4],[2,5]);
 if(bs[0].grade==='B1'&&bs[1].rate100<bs[3].rate100)add('B-DEL2-02',[3,4],[2,5]);
 if(bs[2].rate100>4000&&bs[3].grade==='A2')add('B-DEL3-01',[2,4],[3,5]);
 const gap=bs[2].rate100-bs[3].rate100;if(top4==='1234'&&gap>=500&&gap<1000)add('B-DEL3-02',[2,4],[3,5]);
 if(bs[2].grade==='B2')add('B5-02',[2,5],[3,4]);
 if(bs[3].grade==='B2'&&Number.isInteger(raceNumber)&&raceNumber>=7&&raceNumber<=12)add('B5-03',[3,5],[2,4]);
 if(bs[4].rate100>3000&&bs[4].rate100<=4000&&bs[2].grade==='B1')add('B5-04',[2,5],[3,4]);
 return rows;
}
function evaluateKs(input){
 const base=evaluateK(input);return base.status==='not_applicable'?[]:[base];
}
function evaluateE13(input){
 const bs=boats(input);
 if(bs.some(b=>b.rate100===null))return pending('全国2連対率6艇が不足');
 if(Math.abs(bs[0].rate100-bs[2].rate100)>=1000||!bs[1].grade.startsWith('B'))return no('13型の近率・②B級条件に非該当');
 const chosen=keepPair(input,2,6);if(chosen.status!=='selected')return chosen;
 const third=[chosen.boat,5].sort((a,b)=>a-b),prototype=result('K',1,[[[1],[3,4],third]],4,{patterns:['E13-K4']});
 const promoted=promoteE(input,prototype);return {...promoted,patterns:['13型'],prototype,selection:{compared:[2,6],kept:chosen.boat,threshold:4.5}};
}
function promoteE(input,confirmedK){
 const bs=boats(input);if(bs.some(b=>b.rate100===null))return pending('全国2連対率6艇が不足');
 const patterns=[];if(Math.abs(bs[0].rate100-bs[1].rate100)<1000)patterns.push('12型');
 if(Math.abs(bs[0].rate100-bs[2].rate100)<1000&&bs[1].grade.startsWith('B'))patterns.push('13型');
 if(!patterns.length)return no('Eの12型・13型に非該当');
 if(confirmedK?.status!=='eligible'||confirmedK.group!=='K'||confirmedK.points!==4)return pending('採用済みK4点の確定配置が不足');
 const parsed=confirmedK.forms.map(s=>s.split('-').map(p=>[...p].map(Number)));
 if(parsed.length!==1||parsed[0][0].join('')!=='1'||parsed[0][1].length!==2||parsed[0][2].length!==2||new Set([...parsed[0][1],...parsed[0][2]]).size!==4||[...parsed[0][1],...parsed[0][2]].includes(1))fail('EのK原型が不正です');
 const [,xy,zw]=parsed[0];if(patterns.includes('13型')&&[...xy].sort((a,b)=>a-b).join('')!=='34')patterns.splice(patterns.indexOf('13型'),1);if(!patterns.length)return no('13型の①−③④の骨格に非該当');return result('E',1,[...parsed,[xy,[1],[...xy,...zw]]],10,{patterns});
}
return Object.freeze({VERSION,K_POLICY,boats,layout,expand,keepPair,general16,evaluateA,evaluateB,evaluateC,evaluateD,evaluateK,evaluateKs,evaluateLegacyKs,evaluateE13,promoteE});
});
