import { env } from "cloudflare:workers";
import { fetchOfficialHtml, parseDate, parseResult, payoutListUrl, publishedResultsFromPayoutList, resultUrl } from "./boatrace";
import { planResults } from "./result-plan";

// Keep each unattended run bounded; the next scheduled run resumes the queue.
const BATCH_LIMIT = 16;
// A run is bounded to 16 lookups, leaving time before the next five-minute run.
const LOCK_MS = 4 * 60_000;

function database(): D1Database {
  if (!env.DB) throw new Error("公式結果の保存領域を利用できません。");
  return env.DB;
}

export async function readCachedResults(date: string) {
  parseDate(date);
  const rows = await database().prepare("SELECT payload FROM official_results WHERE date = ? ORDER BY venue, race").bind(date).all<{ payload: string }>();
  return rows.results.map(row => { try { return JSON.parse(row.payload); } catch { return null; } }).filter(Boolean);
}

export async function refreshOfficialResults(now = Date.now(), limit = BATCH_LIMIT) {
  const db = database();
  const lock = await db.prepare("INSERT INTO result_jobs (id, started_ms) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET started_ms = excluded.started_ms WHERE result_jobs.started_ms < ?")
    .bind("official", now, now - LOCK_MS).run();
  if (!lock.meta.changes) return { status: "throttled", message: "前回の更新から時間が経っていません。" };

  const today = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
  const yesterday = new Date(now + 9 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
  const dates = [today, yesterday], tasks: Array<{ date: string; stamp: string; venue: string; race: number }> = [], failures: string[] = [];
  for (const date of dates) {
    const { stamp } = parseDate(date);
    try {
      const html = await fetchOfficialHtml(payoutListUrl(stamp));
      for (const item of publishedResultsFromPayoutList(html, stamp)) tasks.push({ date, stamp, ...item });
    } catch (error) { failures.push(date + "の公式払戻一覧を取得できませんでした。"); }
  }
  const existing = await db.prepare("SELECT date, venue, race, status, retrieved_at FROM official_results WHERE date IN (?, ?)")
    .bind(today, yesterday).all<{ date: string; venue: string; race: number; status: string; retrieved_at: string }>();
  const pending = planResults(tasks, existing.results, now);
  const batch = pending.slice(0, Math.max(1, Math.min(BATCH_LIMIT, Math.floor(limit)))), statements: D1PreparedStatement[] = [];
  let confirmed = 0, unconfirmed = 0;
  for (let i = 0; i < batch.length; i += 2) {
    const values = await Promise.all(batch.slice(i, i + 2).map(async item => {
      const source = resultUrl(item.stamp, item.venue, item.race), retrievedAt = new Date().toISOString();
      try {
        const html = await fetchOfficialHtml(source);
        return { ...item, data: { date: item.date, venue: item.venue, race: item.race, source, retrievedAt, ...parseResult(html, item.stamp, item.venue, item.race) } };
      } catch {
        return { ...item, data: { date: item.date, venue: item.venue, race: item.race, source, retrievedAt, status: "unconfirmed", reason: "公式結果を取得できませんでした。後で再確認します。" } };
      }
    }));
    for (const value of values) {
      if (value.data.status === "confirmed") confirmed++; else unconfirmed++;
      statements.push(db.prepare("INSERT INTO official_results (date, venue, race, status, payload, retrieved_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date, venue, race) DO UPDATE SET status = excluded.status, payload = excluded.payload, retrieved_at = excluded.retrieved_at")
        .bind(value.date, value.venue, value.race, value.data.status, JSON.stringify(value.data), value.data.retrievedAt));
    }
    if (i + 2 < batch.length) await new Promise(resolve => setTimeout(resolve, 300));
  }
  if (statements.length) await db.batch(statements);
  return { status: failures.length ? "partial" : "ok", checkedDays: dates, published: tasks.length, checked: batch.length, confirmed, unconfirmed, remaining: Math.max(0, pending.length - batch.length), failures };
}
