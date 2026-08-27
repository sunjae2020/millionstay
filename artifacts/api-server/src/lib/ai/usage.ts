/**
 * The AI usage meter: one writer, and the aggregate reads behind the admin.
 *
 * Recording is fire-and-forget by design. A meter that can fail a translation
 * because its own INSERT failed would be worse than no meter, so `recordUsage`
 * swallows its errors — the AI call has already succeeded (or failed) by the
 * time it runs, and its outcome is the caller's answer, not the meter's.
 */

import { db, aiUsageEventsTable } from "@workspace/db";
import { and, gte, lte, sql } from "drizzle-orm";
import { estimateCostUsd } from "./pricing.js";

export interface UsageRecord {
  task: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
  ok: boolean;
  error?: string | null;
}

/** Vendor error strings can be enormous; the meter only needs the headline. */
const MAX_ERROR_CHARS = 500;

export function recordUsage(rec: UsageRecord): void {
  const cost = estimateCostUsd(rec.provider, rec.model, {
    input: rec.inputTokens,
    output: rec.outputTokens,
    cacheRead: rec.cacheReadTokens,
    cacheWrite: rec.cacheWriteTokens,
  });

  void db
    .insert(aiUsageEventsTable)
    .values({
      task: rec.task,
      provider: rec.provider,
      model: rec.model,
      input_tokens: rec.inputTokens,
      output_tokens: rec.outputTokens,
      cache_read_tokens: rec.cacheReadTokens,
      cache_write_tokens: rec.cacheWriteTokens,
      latency_ms: rec.latencyMs,
      ok: rec.ok,
      error: rec.error ? rec.error.slice(0, MAX_ERROR_CHARS) : null,
      // Drizzle numerics are strings on the way in as well as out.
      cost_usd: cost === null ? null : String(cost),
    })
    .catch(() => {
      // Metering must never surface as a feature failure.
    });
}

/**
 * Pull the usage counters out of a provider response. Anthropic reports cache
 * hits separately (and does NOT fold them into `input_tokens`), which is the
 * whole reason prompt caching shows up as a saving; the Gemini adapter reports
 * neither, so those columns stay zero for it.
 */
export function tokensFromResponse(msg: any): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
} {
  const u = msg?.usage ?? {};
  return {
    inputTokens: Number(u.input_tokens ?? 0) || 0,
    outputTokens: Number(u.output_tokens ?? 0) || 0,
    cacheReadTokens: Number(u.cache_read_input_tokens ?? 0) || 0,
    cacheWriteTokens: Number(u.cache_creation_input_tokens ?? 0) || 0,
  };
}

export interface UsageTotals {
  calls: number;
  failures: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  /** Null when nothing was recorded in range. */
  avg_latency_ms: number | null;
}

export interface UsageBreakdownRow extends UsageTotals {
  key: string;
}

export interface UsageSummary {
  from: string;
  to: string;
  totals: UsageTotals;
  by_task: UsageBreakdownRow[];
  by_provider: UsageBreakdownRow[];
  by_model: UsageBreakdownRow[];
  by_day: UsageBreakdownRow[];
}

/** Shared aggregate columns, so every breakdown reports the same numbers. */
const AGG = {
  calls: sql<number>`count(*)::int`,
  failures: sql<number>`count(*) filter (where not ${aiUsageEventsTable.ok})::int`,
  input_tokens: sql<number>`coalesce(sum(${aiUsageEventsTable.input_tokens}), 0)::bigint`,
  output_tokens: sql<number>`coalesce(sum(${aiUsageEventsTable.output_tokens}), 0)::bigint`,
  cache_read_tokens: sql<number>`coalesce(sum(${aiUsageEventsTable.cache_read_tokens}), 0)::bigint`,
  cache_write_tokens: sql<number>`coalesce(sum(${aiUsageEventsTable.cache_write_tokens}), 0)::bigint`,
  cost_usd: sql<string>`coalesce(sum(${aiUsageEventsTable.cost_usd}), 0)`,
  avg_latency_ms: sql<string | null>`avg(${aiUsageEventsTable.latency_ms}) filter (where ${aiUsageEventsTable.ok})`,
};

function normaliseRow(row: any): UsageTotals {
  return {
    calls: Number(row.calls ?? 0),
    failures: Number(row.failures ?? 0),
    input_tokens: Number(row.input_tokens ?? 0),
    output_tokens: Number(row.output_tokens ?? 0),
    cache_read_tokens: Number(row.cache_read_tokens ?? 0),
    cache_write_tokens: Number(row.cache_write_tokens ?? 0),
    cost_usd: Number(row.cost_usd ?? 0),
    avg_latency_ms: row.avg_latency_ms == null ? null : Math.round(Number(row.avg_latency_ms)),
  };
}

const EMPTY_TOTALS: UsageTotals = {
  calls: 0,
  failures: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  cost_usd: 0,
  avg_latency_ms: null,
};

/**
 * Everything the admin meter renders, for one date range, in five queries.
 * `from`/`to` are inclusive instants, resolved by the caller from `?days=`.
 */
export async function usageSummary(from: Date, to: Date): Promise<UsageSummary> {
  const range = and(gte(aiUsageEventsTable.created_at, from), lte(aiUsageEventsTable.created_at, to));

  const [totalsRow] = await db.select(AGG).from(aiUsageEventsTable).where(range);

  async function breakdown(col: any): Promise<UsageBreakdownRow[]> {
    const rows = await db
      .select({ key: col, ...AGG })
      .from(aiUsageEventsTable)
      .where(range)
      .groupBy(col)
      .orderBy(sql`coalesce(sum(${aiUsageEventsTable.cost_usd}), 0) desc`);
    return rows.map((r: any) => ({ key: String(r.key), ...normaliseRow(r) }));
  }

  const dayCol = sql<string>`to_char(${aiUsageEventsTable.created_at}, 'YYYY-MM-DD')`;
  const byDayRows = await db
    .select({ key: dayCol, ...AGG })
    .from(aiUsageEventsTable)
    .where(range)
    .groupBy(dayCol)
    .orderBy(sql`1 asc`);

  const [by_task, by_provider, by_model] = await Promise.all([
    breakdown(aiUsageEventsTable.task),
    breakdown(aiUsageEventsTable.provider),
    breakdown(aiUsageEventsTable.model),
  ]);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: totalsRow ? normaliseRow(totalsRow) : { ...EMPTY_TOTALS },
    by_task,
    by_provider,
    by_model,
    by_day: byDayRows.map((r: any) => ({ key: String(r.key), ...normaliseRow(r) })),
  };
}
