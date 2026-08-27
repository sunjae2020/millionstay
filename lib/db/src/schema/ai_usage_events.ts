import { pgTable, serial, text, integer, boolean, numeric, timestamp, index } from "drizzle-orm/pg-core";

/**
 * One row per AI API call — the usage meter behind Settings → Integrations.
 *
 * Written by the metering wrapper in `lib/ai/client.ts`, so every call site is
 * covered without each one remembering to log. Failures are recorded too
 * (`ok = false`): a provider that is erroring is exactly what an admin needs to
 * see, and dropping failed calls would make a broken key look like idleness.
 *
 * `cost_usd` is an ESTIMATE computed from the price table in `lib/ai/pricing.ts`,
 * not a billed amount — null when the model has no price entry. numeric(12,6)
 * because a single Haiku translation costs a fraction of a cent, and Drizzle
 * returns numerics as strings, so wrap reads in Number().
 *
 * No prompt or response text is stored. The meter answers "how much, on what,
 * how often"; message content already lives in the feature's own tables under
 * its own retention rules, and copying it here would create a second, unmanaged
 * copy of customer data.
 */
export const aiUsageEventsTable = pgTable("ai_usage_events", {
  id: serial("id").primaryKey(),
  /** AiTaskId from lib/ai/tasks.ts, e.g. 'cs_translate'. */
  task: text("task").notNull(),
  /** AiProviderId from lib/ai/providers.ts, e.g. 'anthropic'. */
  provider: text("provider").notNull(),
  /** Bare model name as sent to the vendor, without the provider prefix. */
  model: text("model").notNull(),
  input_tokens: integer("input_tokens").notNull().default(0),
  output_tokens: integer("output_tokens").notNull().default(0),
  cache_read_tokens: integer("cache_read_tokens").notNull().default(0),
  cache_write_tokens: integer("cache_write_tokens").notNull().default(0),
  latency_ms: integer("latency_ms").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  /** Vendor error message when ok = false. Truncated by the writer. */
  error: text("error"),
  cost_usd: numeric("cost_usd", { precision: 12, scale: 6 }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // The meter always filters by date first, then groups by task or provider.
  index("idx_ai_usage_created").on(table.created_at),
  index("idx_ai_usage_task_created").on(table.task, table.created_at),
  index("idx_ai_usage_provider_created").on(table.provider, table.created_at),
]);
