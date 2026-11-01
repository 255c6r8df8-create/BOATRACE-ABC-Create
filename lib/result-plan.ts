export type PublishedRace = { date: string; stamp: string; venue: string; race: number };
export type CachedRace = { date: string; venue: string; race: number; status: string; retrieved_at: string };

export function planResults(tasks: PublishedRace[], existing: CachedRace[], now: number) {
  const known = new Map(existing.map(r => [r.date + "|" + r.venue + "|" + r.race, r]));
  const record = (t: PublishedRace) => known.get(t.date + "|" + t.venue + "|" + t.race);
  const priority = (t: PublishedRace) => { const row = record(t); return !row ? 0 : row.status !== "confirmed" ? 1 : 2; };
  return tasks.filter(t => {
    const old = record(t), age = old ? now - Date.parse(old.retrieved_at) : 0;
    return !old || old.status !== "confirmed" && age >= 2 * 60 * 60_000 || old.status === "confirmed" && age >= 12 * 60 * 60_000;
  }).sort((a, b) => priority(a) - priority(b));
}
