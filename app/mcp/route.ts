import { refreshOfficialResults } from "../../lib/result-cache";
import { isResultsOwner } from "../../lib/result-auth";

export const dynamic = "force-dynamic";

const tools = [{
  name: "refresh_official_results",
  description: "公式の払戻一覧と結果ページから公開レース結果を取得し、サイトの公開情報キャッシュを更新します。購入内容や個人の予想にはアクセスしません。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
}];

export async function POST(request: Request) {
  let body: { id?: string | number | null; method?: string; params?: { name?: string; arguments?: unknown } };
  try { body = await request.json(); } catch { return Response.json({ error: "不正な要求" }, { status: 400 }); }
  const reply = (result: unknown) => Response.json({ jsonrpc: "2.0", id: body.id ?? null, result });
  if (body.method === "server/discover") return reply({ supportedVersions: ["2026-07-28"], capabilities: { tools: {} } });
  if (body.method === "initialize") return reply({ protocolVersion: "2026-07-28", capabilities: { tools: {} }, serverInfo: { name: "boat-official-results", version: "1.0.0" } });
  if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (body.method === "tools/list") return reply({ tools });
  if (body.method !== "tools/call" || body.params?.name !== "refresh_official_results") return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not found" } });
  if (!isResultsOwner(request)) return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32001, message: "更新はサイト所有者だけが実行できます。" } }, { status: 403 });
  try {
    const result = await refreshOfficialResults();
    return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
  } catch (error) {
    return reply({ isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "公式結果の更新に失敗しました。" }] });
  }
}
