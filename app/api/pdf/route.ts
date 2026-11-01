import { fetchVerifiedPdf, parseDate, parseVenue } from "../../../lib/boatrace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { stamp } = parseDate(params.get("date"));
    const venue = parseVenue(params.get("venue"));
    const bytes = await fetchVerifiedPdf(stamp, venue);
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "出走表を取得できません。" }, { status: 502 });
  }
}
