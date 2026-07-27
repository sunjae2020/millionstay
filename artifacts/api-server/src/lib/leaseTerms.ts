import { db, accommodationCatalogTable, promotionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Resolve the lease terms a contract should inherit from an accommodation
 * product (숙박상품), so contract creation auto-fills 보증금 / 월세 / 프로모션 from
 * the selected 보증금/월세 tier. The values are DEFAULTS — callers apply them
 * only where the contract field is otherwise empty, leaving them free to be
 * changed manually afterwards.
 *
 * `effective_monthly` already has the linked Active promotion applied (프로모션
 * 반영); `standard_monthly` is the pre-discount rate.
 */
export async function resolveLeaseTermsFromProduct(
  productId: number | null | undefined,
): Promise<{
  deposit_amount: number | null;   // 보증금
  standard_monthly: number | null; // 정상 월세
  effective_monthly: number | null;// 프로모션 반영 월세
  promotion_id: number | null;
  promotion_name: string | null;
  currency: string | null;
} | null> {
  if (!productId) return null;
  const [p] = await db
    .select({
      price: accommodationCatalogTable.price,
      deposit_amount: accommodationCatalogTable.deposit_amount,
      currency: accommodationCatalogTable.currency,
      promotion_id: accommodationCatalogTable.promotion_id,
      promotion_name: promotionsTable.name,
      discount_amount: promotionsTable.discount_amount,
      discount_percentage: promotionsTable.discount_percentage,
    })
    .from(accommodationCatalogTable)
    .leftJoin(promotionsTable, and(
      eq(promotionsTable.id, accommodationCatalogTable.promotion_id),
      eq(promotionsTable.status, "Active"),
    ))
    .where(eq(accommodationCatalogTable.id, productId));
  if (!p) return null;

  const price = p.price != null ? Number(p.price) : null;
  let effective = price;
  if (price != null && p.promotion_id) {
    if (p.discount_amount != null) effective = price - Number(p.discount_amount);
    else if (p.discount_percentage != null) effective = Math.round(price * (1 - Number(p.discount_percentage) / 100));
  }
  // Never let a promo push the effective rate above the standard rate.
  if (effective != null && price != null && effective > price) effective = price;

  return {
    deposit_amount: p.deposit_amount != null ? Number(p.deposit_amount) : null,
    standard_monthly: price,
    effective_monthly: effective,
    promotion_id: p.promotion_id ?? null,
    promotion_name: p.promotion_name ?? null,
    currency: p.currency ?? null,
  };
}
