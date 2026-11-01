import { parseDate } from "../../../lib/boatrace";
import { readCachedResults } from "../../../lib/result-cache";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { iso } = parseDate(new URL(request.url).searchParams.get("date"));
    return Response.json({ date: iso, results: await readCachedResults(iso) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "公式結果を読み込めません。" }, { status: 503 });
  }
}
