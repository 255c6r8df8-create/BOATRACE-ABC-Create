// All upstream addresses are constructed here; client-supplied URLs are never fetched.
const ORIGIN = "https://www.boatrace.jp";
const MAX_HTML = 2_000_000;
const MAX_PDF = 5 * 1024 * 1024;

export function parseDate(value: string | null): { iso: string; stamp: string } {
  if (!value || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error("開催日が不正です。");
  const d = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error("開催日が不正です。");
  return { iso: value, stamp: value.replaceAll("-", "") };
}

export function parseVenue(value: string | null): string {
  if (!value || !/^(0[1-9]|1\d|2[0-4])$/.test(value)) throw new Error("開催場が不正です。");
  return value;
}

export function parseRace(value: string | null): number {
  if (!value || !/^(?:[1-9]|1[0-2])$/.test(value)) throw new Error("レース番号が不正です。");
  return Number(value);
}

export function dailyUrl(stamp: string): string {
  return `${ORIGIN}/owpc/pc/race/index?hd=${stamp}`;
}
export function listingUrl(stamp: string, venue: string): string {
  return `${ORIGIN}/owpc/pc/race/raceindex?jcd=${venue}&hd=${stamp}`;
}
export function pdfUrl(stamp: string, venue: string): string {
  return `${ORIGIN}/syussoupdf/${stamp.slice(0, 4)}/pb${venue}${stamp.slice(4)}.pdf`;
}
export function resultUrl(stamp: string, venue: string, race: number): string {
  return `${ORIGIN}/owpc/pc/race/raceresult?rno=${race}&jcd=${venue}&hd=${stamp}`;
}
export function payoutListUrl(stamp: string): string {
  return `${ORIGIN}/owpc/pc/race/pay?hd=${stamp}`;
}
export function publishedResultsFromPayoutList(html: string, stamp: string): Array<{ venue: string; race: number }> {
  const matches = new Map<string, { venue: string; race: number }>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    try {
      const u = new URL(match[2].replaceAll("&amp;", "&"), ORIGIN);
      if (u.origin !== ORIGIN || u.pathname !== "/owpc/pc/race/raceresult" || u.searchParams.get("hd") !== stamp) continue;
      const venue = parseVenue(u.searchParams.get("jcd")), race = parseRace(u.searchParams.get("rno"));
      matches.set(venue + ":" + race, { venue, race });
    } catch { /* Ignore links with an unsupported identity. */ }
  }
  return [...matches.values()].sort((a, b) => a.venue.localeCompare(b.venue) || a.race - b.race);
}

// Interpret only the ordinary, single 3連単 payout layout. Anything ambiguous
// stays unconfirmed rather than becoming a zero payout or an incorrect loss.
export function parseResult(html: string, stamp: string, venue: string, race: number) {
  const unconfirmed = (reason: string) => ({ status: "unconfirmed" as const, reason });
  const identity = `/owpc/pc/race/resultlist?jcd=${venue}&amp;hd=${stamp}`;
  const raceLink = `raceresult?rno=${race}&amp;jcd=${venue}&amp;hd=${stamp}`;
  if (!html.includes(identity) || !html.includes(raceLink)) return unconfirmed("公式ページの日付・場・レース番号を確認できません。");
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m => m[0]);
  const heading = (table: string, name: string) => new RegExp(`<th\\b[^>]*>\\s*${name}\\s*<\\/th>`, "i").test(table);
  const payoutTable = tables.find(t => heading(t, "勝式") && heading(t, "払戻金"));
  const finishTable = tables.find(t => heading(t, "着") && heading(t, "枠") && heading(t, "レースタイム"));
  const refundTable = tables.find(t => heading(t, "返還"));
  if (!payoutTable || !finishTable || !refundTable) return unconfirmed("結果・配当・返還欄が揃っていません。");
  const body = [...payoutTable.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)].map(m => m[1]).find(t => /3連単/.test(t));
  if (!body) return unconfirmed("3連単の結果がまだ確認できません。");
  const trs = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  if (trs.length !== 2 || !/3連単/.test(trs[0]) || /不成立|同着/.test(body)) return unconfirmed("3連単の特殊な結果は自動判定できません。");
  const boatNumbers = (s: string) => [...s.matchAll(/<span\b[^>]*class=["'][^"']*numberSet1_number[^"']*["'][^>]*>\s*([1-6])\s*<\/span>/gi)].map(m => Number(m[1]));
  const order = boatNumbers(trs[0]);
  const payoutMatch = trs[0].match(/<span\b[^>]*class=["'][^"']*is-payout1[^"']*["'][^>]*>\s*(?:&yen;|&#165;|¥)\s*([\d,]+)\s*<\/span>/i);
  const secondPayout = trs[1].match(/<span\b[^>]*class=["'][^"']*is-payout1[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if (order.length !== 3 || new Set(order).size !== 3 || !payoutMatch || !secondPayout || secondPayout[1].replace(/&nbsp;|\s/g, "") !== "") return unconfirmed("3連単の組番・配当が一意に確認できません。");
  const payout = Number(payoutMatch[1].replaceAll(",", ""));
  if (!Number.isSafeInteger(payout) || payout <= 0) return unconfirmed("3連単の配当を確認できません。");
  const finishes = [...finishTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]).map(row => {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]*>/g, "").trim().normalize("NFKC"));
    return cells.length >= 2 && /^[1-3]$/.test(cells[0]) && /^[1-6]$/.test(cells[1]) ? [Number(cells[0]), Number(cells[1])] : null;
  }).filter((x): x is number[] => x !== null);
  if (finishes.length !== 3 || finishes.some((x, i) => x[0] !== i + 1 || x[1] !== order[i])) return unconfirmed("着順と3連単の組番が一致しません。");
  const refundBody = refundTable.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (refundBody === undefined) return unconfirmed("返還欄の形式が確認できません。");
  const refunds = boatNumbers(refundBody);
  const remaining = refundBody.replace(/<span\b[^>]*class=["'][^"']*numberSet1_number[^"']*["'][^>]*>\s*[1-6]\s*<\/span>/gi, "").replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "");
  if (remaining || new Set(refunds).size !== refunds.length || refunds.some(x => order.includes(x))) return unconfirmed("返還艇を確認できません。");
  return { status: "confirmed" as const, order, payout, refunds };
}

async function upstream(url: string, expected: "html" | "pdf"): Promise<Response> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: expected === "pdf" ? "application/pdf" : "text/html" },
  });
  if (response.status >= 300 && response.status < 400) throw new Error("公式サイトの転送先を確認できないため、取得を停止しました。");
  if (!response.ok) throw new Error(`公式サイトから取得できませんでした（${response.status}）。`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > (expected === "pdf" ? MAX_PDF : MAX_HTML)) throw new Error("公式サイトの応答が大きすぎます。");
  return response;
}

export async function fetchOfficialHtml(url: string): Promise<string> {
  const response = await upstream(url, "html");
  const html = await response.text();
  if (html.length > MAX_HTML || !/<html[\s>]/i.test(html)) throw new Error("公式ページの形式を確認できません。");
  return html;
}

export function venuesFromDaily(html: string, stamp: string): string[] {
  const venues = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    try {
      const url = new URL(match[2].replaceAll("&amp;", "&"), ORIGIN);
      const venue = url.searchParams.get("jcd");
      if (url.origin === ORIGIN && url.pathname === "/owpc/pc/race/raceindex" && url.searchParams.get("hd") === stamp && venue && /^(0[1-9]|1\d|2[0-4])$/.test(venue)) venues.add(venue);
    } catch { /* Ignore links which cannot be parsed. */ }
  }
  return [...venues].sort();
}

export function statusesFromDaily(html: string, stamp: string, venues: string[]) {
  type Status = { venue: string; cancelledFrom: number | null; blocked: boolean; reason: string };
  const byVenue = new Map<string, Status>();
  for (const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const codes = venuesFromDaily(row, stamp);
    if (codes.length !== 1) continue;
    const venue = codes[0], text = row.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').replace(/\s+/g, '');
    const from = text.match(/(1[0-2]|[1-9])R以降中止(?:順延)?/);
    const whole = text.match(/(?:開催|全(?:レース|R))中止(?:順延)?/);
    const unusual = /中止|順延|打切|不成立/.test(text);
    const current: Status = { venue, cancelledFrom: from ? Number(from[1]) : whole ? 1 : null, blocked: unusual && !from && !whole, reason: from?.[0] || whole?.[0] || (unusual ? '開催状況を自動判定できません' : '') };
    const prior = byVenue.get(venue);
    if (!prior) byVenue.set(venue, current);
    else if (prior.blocked || current.blocked || prior.cancelledFrom !== current.cancelledFrom) {
      byVenue.set(venue, { venue, cancelledFrom: null, blocked: true, reason: '開催状況が複数あり一致を確認できません' });
    }
  }
  return venues.map(venue => byVenue.get(venue) || { venue, cancelledFrom: null, blocked: true, reason: '開催場の状態を確認できません' });
}

export async function fetchVerifiedPdf(stamp: string, venue: string): Promise<ArrayBuffer> {
  // Both requests have a fixed official origin. Never return a PDF until its
  // exact link has been found on the corresponding official race listing.
  const [listing, response] = await Promise.all([
    fetchOfficialHtml(listingUrl(stamp, venue)),
    upstream(pdfUrl(stamp, venue), "pdf"),
  ]);
  const expectedPath = `/syussoupdf/${stamp.slice(0, 4)}/pb${venue}${stamp.slice(4)}.pdf`;
  if (!listing.includes(expectedPath)) throw new Error("選択した日・場に対応する公式出走表のリンクを確認できません。");
  const data = await response.arrayBuffer();
  if (data.byteLength > MAX_PDF || data.byteLength < 100 || new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") {
    throw new Error("取得した出走表の形式を確認できません。");
  }
  return data;
}
