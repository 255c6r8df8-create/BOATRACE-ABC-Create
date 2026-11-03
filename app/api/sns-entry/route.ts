import {fetchOfficialHtml,parseDate,parseVenue,parseRace} from '../../../lib/boatrace';
import {parseEntry} from '../../../lib/sns-entry';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'};
export async function OPTIONS(){return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});}
export async function GET(request:Request){
 let date,venue,race;
 try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>!['date','venue','race'].includes(k)||p.getAll(k).length!==1))throw Error('選択項目が不正です。');date=parseDate(p.get('date'));venue=parseVenue(p.get('venue'));race=parseRace(p.get('race'));}catch(e){return Response.json({error:e instanceof Error?e.message:'選択項目が不正です。'},{status:400,headers});}
 const source=`https://www.boatrace.jp/owpc/pc/race/racelist?rno=${race}&jcd=${venue}&hd=${date.stamp}`;
 try{const html=await fetchOfficialHtml(source);const boats=parseEntry(html,date.stamp,venue,race);return Response.json({schema:1,date:date.iso,venue,race,source,retrievedAt:new Date().toISOString(),boats},{headers});}catch(e){return Response.json({error:e instanceof Error?e.message:'公式出走表を取得できませんでした。',date:date.iso,venue,race,source},{status:422,headers});}
}
