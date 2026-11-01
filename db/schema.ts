import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Only public official results are stored here. Purchases and forecasts stay on the device.
export const officialResults = sqliteTable("official_results", {
  date: text("date").notNull(),
  venue: text("venue").notNull(),
  race: integer("race").notNull(),
  status: text("status").notNull(),
  payload: text("payload").notNull(),
  retrievedAt: text("retrieved_at").notNull(),
}, (table) => [primaryKey({ columns: [table.date, table.venue, table.race] })]);

export const resultJobs = sqliteTable("result_jobs", {
  id: text("id").primaryKey(),
  startedMs: integer("started_ms").notNull(),
});
