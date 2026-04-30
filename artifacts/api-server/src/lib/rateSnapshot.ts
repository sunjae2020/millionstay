import { db, exchangeRatesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

/**
 * Returns the latest known "1 X = N AUD" rate for the given currency.
 * Returns 1 for AUD, null when no rate is registered.
 *
 * Used to snapshot the exchange rate at transaction creation time so
 * that downstream AUD-based accounting reports are not affected by
 * later rate updates.
 */
export async function getRateToAud(currency: string | null | undefined): Promise<string | null> {
  const c = (currency ?? "AUD").toString().toUpperCase();
  if (c === "AUD") return "1";

  // Prefer X -> AUD direction (stored as 1 X = rate AUD)
  const directRows = await db
    .select()
    .from(exchangeRatesTable)
    .where(and(eq(exchangeRatesTable.from_currency, c), eq(exchangeRatesTable.to_currency, "AUD")))
    .orderBy(desc(exchangeRatesTable.effective_date), desc(exchangeRatesTable.id))
    .limit(1);
  if (directRows[0]) {
    const r = Number(directRows[0].rate);
    if (Number.isFinite(r) && r > 0) return r.toFixed(8);
  }

  // Fallback: AUD -> X (1 AUD = rate X) → invert
  const invRows = await db
    .select()
    .from(exchangeRatesTable)
    .where(and(eq(exchangeRatesTable.from_currency, "AUD"), eq(exchangeRatesTable.to_currency, c)))
    .orderBy(desc(exchangeRatesTable.effective_date), desc(exchangeRatesTable.id))
    .limit(1);
  if (invRows[0]) {
    const r = Number(invRows[0].rate);
    if (Number.isFinite(r) && r > 0) return (1 / r).toFixed(8);
  }

  return null;
}
