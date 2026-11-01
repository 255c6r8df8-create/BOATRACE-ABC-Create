import { isResultsOwner } from "../../../lib/result-auth";
import { refreshOfficialResults } from "../../../lib/result-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isResultsOwner(request)) return Response.json({ error: "サイト所有者のログインが必要です。" }, { status: 403 });
  const html = '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>公式結果の接続確認</title><body><main><h1>公式結果の接続確認</h1><p>所有者として公式の公開結果を1件取得し、保存を確認します。購入内容は送信しません。</p><form method="post"><button type="submit">公式結果の更新を確認</button></form></main></body></html>';
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isResultsOwner(request)) return Response.json({ error: "サイト所有者のログインが必要です。" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "更新元を確認できません。" }, { status: 403 });
  try { return Response.json(await refreshOfficialResults(Date.now(), 1), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "公式結果を更新できません。" }, { status: 503 }); }
}
