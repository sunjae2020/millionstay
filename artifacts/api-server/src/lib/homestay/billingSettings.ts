// Global homestay rent-billing settings, stored as a JSON blob in the
// integration_settings KV (key `homestay_billing`). Per-placement overrides on
// homestay_placements (billing_cycle_weeks / billing_method) take precedence.
import { eq } from "drizzle-orm";
import { db, integrationSettings } from "@workspace/db";

export const HOMESTAY_BILLING_KEY = "homestay_billing";

export interface HomestayBillingSettings {
  /** Rent billing cycle length in WEEKS (default 4 = four-weekly). */
  cycle_weeks: number;
  /** Default payment method for generated charges. */
  default_method: "card" | "bank_transfer";
  /** Card processing surcharge percent (added to card payments). */
  surcharge_pct: number;
  /** Days before the billing date to generate the pending charge. */
  lead_days: number;
}

export const DEFAULT_BILLING_SETTINGS: HomestayBillingSettings = {
  cycle_weeks: 4,
  default_method: "card",
  surcharge_pct: 2,
  lead_days: 0,
};

export async function getHomestayBillingSettings(): Promise<HomestayBillingSettings> {
  try {
    const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.key, HOMESTAY_BILLING_KEY)).limit(1);
    if (!row?.value) return { ...DEFAULT_BILLING_SETTINGS };
    const parsed = JSON.parse(row.value) as Partial<HomestayBillingSettings>;
    return {
      cycle_weeks: clampInt(parsed.cycle_weeks, DEFAULT_BILLING_SETTINGS.cycle_weeks, 1, 52),
      default_method: parsed.default_method === "bank_transfer" ? "bank_transfer" : "card",
      surcharge_pct: clampNum(parsed.surcharge_pct, DEFAULT_BILLING_SETTINGS.surcharge_pct, 0, 20),
      lead_days: clampInt(parsed.lead_days, DEFAULT_BILLING_SETTINGS.lead_days, 0, 30),
    };
  } catch {
    return { ...DEFAULT_BILLING_SETTINGS };
  }
}

export async function saveHomestayBillingSettings(s: HomestayBillingSettings): Promise<void> {
  const value = JSON.stringify({
    cycle_weeks: clampInt(s.cycle_weeks, 4, 1, 52),
    default_method: s.default_method === "bank_transfer" ? "bank_transfer" : "card",
    surcharge_pct: clampNum(s.surcharge_pct, 2, 0, 20),
    lead_days: clampInt(s.lead_days, 0, 0, 30),
  });
  await db.insert(integrationSettings)
    .values({ key: HOMESTAY_BILLING_KEY, value, updated_at: new Date() })
    .onConflictDoUpdate({ target: integrationSettings.key, set: { value, updated_at: new Date() } });
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function clampNum(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
