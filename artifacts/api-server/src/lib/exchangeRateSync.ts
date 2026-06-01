import { db, exchangeRatesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const PROVIDER_URL = "https://open.er-api.com/v6/latest/AUD";

type SyncResult = {
  ok: boolean;
  updated: string[];
  skipped: string[];
  error?: string;
  fetched_at?: string;
};

function todayInSydney(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function listTrackedCurrencies(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ code: exchangeRatesTable.from_currency })
    .from(exchangeRatesTable)
    .where(sql`${exchangeRatesTable.to_currency} = 'AUD'`);
  return rows.map((r: { code: string }) => r.code).filter((c: string) => c && c !== "AUD");
}

type ProviderResult =
  | { ok: true; rates: Record<string, number>; fetched_at?: string }
  | { ok: false; error: string };

// Fetch the latest provider rates (1 AUD = X) without touching the database.
async function fetchProviderRates(): Promise<ProviderResult> {
  const res = await fetch(PROVIDER_URL, {
    headers: { "User-Agent": "millionstay/exchange-rate-sync" },
  });
  if (!res.ok) {
    return { ok: false, error: `provider HTTP ${res.status}` };
  }
  const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  if (data.result !== "success" || !data.rates) {
    return { ok: false, error: "provider returned non-success" };
  }
  return { ok: true, rates: data.rates, fetched_at: data.time_last_update_utc };
}

export type LiveRates = {
  ok: boolean;
  error?: string;
  fetched_at?: string;
  // code -> "1 code = N AUD" (8 decimals)
  rates: Record<string, string>;
};

// Live rates expressed as "1 X = N AUD" for every currency the provider returns.
// Read-only preview for the admin UI; does not persist anything.
export async function getLiveRatesVsAud(): Promise<LiveRates> {
  try {
    const r = await fetchProviderRates();
    if (!r.ok) return { ok: false, error: r.error, rates: {} };
    const rates: Record<string, string> = { AUD: "1.00000000" };
    for (const [code, audPerUnit] of Object.entries(r.rates)) {
      if (code === "AUD") continue;
      if (typeof audPerUnit === "number" && audPerUnit > 0) {
        rates[code] = (1 / audPerUnit).toFixed(8);
      }
    }
    return { ok: true, fetched_at: r.fetched_at, rates };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err), rates: {} };
  }
}

export async function syncExchangeRates(): Promise<SyncResult> {
  try {
    const provider = await fetchProviderRates();
    if (!provider.ok) {
      return { ok: false, updated: [], skipped: [], error: provider.error };
    }
    const data = { rates: provider.rates, time_last_update_utc: provider.fetched_at };

    const tracked = await listTrackedCurrencies();
    const updated: string[] = [];
    const skipped: string[] = [];
    const date = todayInSydney();

    for (const code of tracked) {
      const audPerUnit = data.rates[code]; // 1 AUD = audPerUnit X
      if (!audPerUnit || audPerUnit <= 0) {
        skipped.push(code);
        continue;
      }
      // Store as 1 X = (1 / audPerUnit) AUD
      const rateXtoAUD = (1 / audPerUnit).toFixed(8);
      await db
        .insert(exchangeRatesTable)
        .values({
          from_currency: code,
          to_currency: "AUD",
          rate: rateXtoAUD,
          source: "auto",
          effective_date: date,
        })
        .onConflictDoUpdate({
          target: [exchangeRatesTable.from_currency, exchangeRatesTable.to_currency, exchangeRatesTable.effective_date],
          set: { rate: rateXtoAUD, source: "auto", updated_at: new Date() },
        });
      updated.push(code);
    }

    logger.info({ updated, skipped, date }, "Exchange rates synced");
    return { ok: true, updated, skipped, fetched_at: data.time_last_update_utc };
  } catch (err: any) {
    logger.error({ err }, "Exchange rate sync failed");
    return { ok: false, updated: [], skipped: [], error: err?.message ?? String(err) };
  }
}

export type SyncInfo = {
  last_sync_at: string | null;
  last_effective_date: string | null;
  last_source: string | null;
  tracked_count: number;
};

export async function getSyncInfo(): Promise<SyncInfo> {
  const rows = await db.execute(sql`
    SELECT MAX(updated_at) AS last_sync_at,
           MAX(effective_date::text) AS last_effective_date
    FROM exchange_rates
    WHERE source = 'auto'
  `);
  const r: any = (rows as any)[0] ?? {};
  const tracked = await listTrackedCurrencies();
  return {
    last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
    last_effective_date: r.last_effective_date ?? null,
    last_source: "auto",
    tracked_count: tracked.length,
  };
}
