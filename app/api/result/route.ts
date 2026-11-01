import { fetchOfficialHtml, parseDate, parseRace, parseResult, parseVenue, resultUrl } from "../../../lib/boatrace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { iso, stamp } = parseDate(params.get("date"));
    const venue = parseVenue(params.get("venue"));
    const race = parseRace(params.get("race"));
    const source = resultUrl(stamp, venue, race);
    const html = await fetchOfficialHtml(source);
    return Response.json({ date: iso, venue, race, source, retrievedAt: new Date().toISOString(), ...parseResult(html, stamp, venue, race) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "公式結果を取得できません。" }, { status: 502 });
  }
}
