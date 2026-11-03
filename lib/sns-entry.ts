export type EntryBoat={lane:number;registration:string;name:string;grade:string;branch:string|null;birthplace:string|null;averageST:string|null;nationalWin:string|null;nationalTwo:string|null;nationalThree:string|null};
const text=(html:string)=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).normalize('NFKC').replace(/\s+/g,' ').trim();
const missing=/^[-―ー–—]$/;
function metric(value:string,max:number):string|null{if(missing.test(value))return null;if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)||Number(value)>max)throw Error('公式出走表の数値形式を確認できません。');return value;}
export function parseEntry(html:string,stamp:string,venue:string,race:number):EntryBoat[]{
 const links=[...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)];
 const identity=links.some(m=>{try{const u=new URL(m[1].replace(/&amp;/g,'&'),'https://www.boatrace.jp');return u.origin==='https://www.boatrace.jp'&&u.pathname==='/owpc/pc/race/racelist'&&u.searchParams.get('hd')===stamp&&u.searchParams.get('jcd')===venue&&u.searchParams.get('rno')===String(race);}catch{return false;}});
 if(!identity||!/<title[^>]*>[^<]*出走表/i.test(html))throw Error('公式出走表の日付・場・レースを確認できません。');
 const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
 const candidates=tables.filter(t=>/全国/.test(t)&&/平均ST/.test(t)&&/登録番号/.test(t));if(candidates.length!==1)throw Error('公式出走表の項目構成を確認できません。');
 const boats:EntryBoat[]=[];
 for(const body of candidates[0].matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)){
  const row=body[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i);if(!row)continue;
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
  if(!cells.length)continue;const laneText=text(cells[0]);if(!/^[1-6]$/.test(laneText))continue;
  if(cells.length<8)throw Error('出走取消・欠場または未対応の出走表です。');
  const profile=text(cells[2]),id=profile.match(/^(\d{4})\s*\/\s*(A1|A2|B1|B2)\b/);if(!id)throw Error('登録番号・級別を確認できません。');
  const names=[...cells[2].matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(m=>{try{const u=new URL(m[1].replace(/&amp;/g,'&'),'https://www.boatrace.jp');return u.origin==='https://www.boatrace.jp'&&u.pathname==='/owpc/pc/data/racersearch/profile'&&u.searchParams.get('toban')===id[1];}catch{return false;}});
  if(names.length!==1)throw Error('選手名と登録番号を照合できません。');const name=text(names[0][2]).replace(/\s/g,'');if(!name||name.length>30)throw Error('選手名が不正です。');
  const home=profile.match(/([^\s/]+)\s*\/\s*([^\s/]+)\s+\d{1,3}歳\s*\//);
  const st=text(cells[3]).match(/^F\d+\s+L\d+\s+(\S+)$/);if(!st)throw Error('平均STの項目を確認できません。');
  const national=text(cells[4]).split(' ');if(national.length!==3)throw Error('全国成績の3項目を確認できません。');
  const [nationalWin,nationalTwo,nationalThree]=national.map((s,i)=>metric(s,i===0?10:100));
  if(nationalTwo!==null&&nationalThree!==null&&Number(nationalTwo)>Number(nationalThree))throw Error('全国成績の整合性を確認できません。');
  boats.push({lane:Number(laneText),registration:id[1],name,grade:id[2],branch:home?.[1]??null,birthplace:home?.[2]??null,averageST:metric(st[1],1),nationalWin,nationalTwo,nationalThree});
 }
 if(boats.length!==6||new Set(boats.map(b=>b.lane)).size!==6||new Set(boats.map(b=>b.registration)).size!==6)throw Error('6艇の出走情報が揃っていません。');
 return boats.sort((a,b)=>a.lane-b.lane);
}
