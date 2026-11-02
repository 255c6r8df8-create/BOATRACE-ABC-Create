// Same-origin first hop: the creator's document policy need not allow an external form action.
const DESTINATION = 'https://boatrace-abc-results.pages.dev/handoff';
const entities: Record<string,string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escape = (text: string) => text.replace(/[&<>"']/g, c => entities[c]!);
export async function POST(request: Request) {
  try {
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('一覧の移動形式が不正です。', { status: 415 });
    const reader=request.body?.getReader(); if(!reader)return new Response('一覧がありません。',{status:400});
    const chunks: Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8_000_000){await reader.cancel();return new Response('一覧の容量が大きすぎます。',{status:413});}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const form=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(form.getAll('payload').length!==1)return new Response('一覧の移動データが不正です。',{status:400});
    const payload=JSON.parse(form.get('payload')!);
    if(payload.format!=='BOATRACE_ABC_ANALYSIS_EXPORT'||!/^20\d{2}-\d{2}-\d{2}$/.test(payload.date)||!Array.isArray(payload.sections)||payload.sections.length!==26)return new Response('開催日と26項目を確認できません。作成画面の保存内容は保持されています。',{status:400});
    const nonce=crypto.randomUUID().replaceAll('-','');
    const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>一覧を開いています</title></head><body><p>その日の一覧を開いています…</p><form action="${DESTINATION}" method="POST" target="_self"><input type="hidden" name="payload" value="${escape(JSON.stringify(payload))}"><noscript><button type="submit">この一覧を開く</button></noscript></form><script nonce="${nonce}">HTMLFormElement.prototype.submit.call(document.forms[0]);</script></body></html>`;
    return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; form-action ${DESTINATION}; base-uri 'none'; frame-ancestors 'self' https://boatrace-abc-app.pages.dev`}});
  } catch {return new Response('一覧を移動できませんでした。作成画面の保存内容は保持されています。',{status:400});}
}
