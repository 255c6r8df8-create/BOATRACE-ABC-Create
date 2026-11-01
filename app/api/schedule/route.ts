import { dailyUrl, fetchOfficialHtml, parseDate, statusesFromDaily, venuesFromDaily } from "../../../lib/boatrace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { iso, stamp } = parseDate(new URL(request.url).searchParams.get("date"));
    const url = dailyUrl(stamp);
    const html = await fetchOfficialHtml(url);
    const venues = venuesFromDaily(html, stamp);
    if (!venues.length) return Response.json({ error: "公式開催一覧から開催場を確認できません。開催がない日や公開前の可能性があります。", source: url }, { status: 422 });
    return Response.json({ date: iso, venues, statuses: statusesFromDaily(html, stamp, venues), source: url, retrievedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "開催一覧を取得できません。" }, { status: 502 });
  }
}
