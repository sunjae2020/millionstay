// Generate an itemized, booking-linked invoice from a homestay placement.
//
// Builds a Draft invoice (invoices) + N invoice_line_items rows from the
// placement's financial fields (placement fee, deposit, first month) plus any
// priced placement services (airport pickup, initial settlement, ...).
//
// Idempotent per placement: the invoice description carries a marker
// (`Homestay <placement_ref> — initial invoice`); if one already exists for the
// placement's booking_id with that marker we return it instead of duplicating.
//
// Money columns are numeric → Drizzle returns/accepts strings. Wrap reads with
// Number() and writes with String(); totals are rounded to cents.
import { and, eq, ilike } from "drizzle-orm";
import { DEFAULT_CURRENCY } from "../currency.js";
import {
  db,
  invoicesTable,
  invoiceLineItemsTable,
  homestayPlacementsTable,
  homestayPlacementServicesTable,
  bookingsTable,
} from "@workspace/db";
import { getRateToAud } from "../rateSnapshot.js";
import { serviceLabel } from "../documents/i18n.js";

/** Round to 2 decimal places (cents). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Replicated from routes/invoices.ts (the local helper there is not exported). */
async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  const count = rows.length + 1;
  return `MS-INV-${year}-${String(count).padStart(5, "0")}`;
}

type LineItemInput = {
  label: string;
  quantity: number;
  unit_amount: number;
  line_type?: string; // "revenue" (default) | "deposit" (H-402)
};

export type PlacementInvoiceResult = typeof invoicesTable.$inferSelect & {
  line_items: (typeof invoiceLineItemsTable.$inferSelect)[];
};

/**
 * Create a Draft, itemized, booking-linked invoice for a homestay placement.
 * Returns the created (or pre-existing, idempotent) invoice with its line items.
 * Throws if the placement is not found.
 */
export async function createPlacementInvoice(
  placementId: number,
): Promise<PlacementInvoiceResult> {
  const [placement] = await db
    .select()
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.id, placementId))
    .limit(1);
  if (!placement) {
    throw new Error(`Placement ${placementId} not found`);
  }

  const currency = placement.currency || DEFAULT_CURRENCY;
  const marker = `Homestay ${placement.placement_ref} — initial invoice`;

  // Idempotency: reuse an existing invoice for this booking carrying the marker.
  if (placement.booking_id != null) {
    const existingRows = await db
      .select()
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.booking_id, placement.booking_id),
          ilike(invoicesTable.description, `%${placement.placement_ref}%`),
        ),
      );
    const existing = existingRows.find((r) => r.description === marker);
    if (existing) {
      const lineItems = await db
        .select()
        .from(invoiceLineItemsTable)
        .where(eq(invoiceLineItemsTable.invoice_id, existing.id))
        .orderBy(invoiceLineItemsTable.sort_order);
      return { ...existing, line_items: lineItems };
    }
  }

  // Build line items from the placement's financial fields.
  const lines: LineItemInput[] = [];
  const placementFee = Number(placement.placement_fee);
  if (placementFee > 0) {
    lines.push({ label: "Homestay placement fee", quantity: 1, unit_amount: placementFee });
  }
  const deposit = Number(placement.deposit);
  if (deposit > 0) {
    lines.push({ label: "Security deposit", quantity: 1, unit_amount: deposit, line_type: "deposit" });
  }
  const monthlyFee = Number(placement.monthly_fee);
  if (monthlyFee > 0) {
    lines.push({ label: "First month homestay fee", quantity: 1, unit_amount: monthlyFee });
  }

  // Priced placement services (airport pickup, initial settlement, ...).
  const services = await db
    .select()
    .from(homestayPlacementServicesTable)
    .where(eq(homestayPlacementServicesTable.placement_id, placementId))
    .orderBy(homestayPlacementServicesTable.id);
  for (const svc of services) {
    const price = Number(svc.price);
    if (price > 0) {
      // Invoice line labels are stored at creation time; use English (the
      // invoice document re-renders the stored label verbatim).
      lines.push({ label: serviceLabel("en", svc.service_type), quantity: 1, unit_amount: price });
    }
  }

  // Sum line totals → invoice amount (rounded to cents).
  const amount = round2(
    lines.reduce((sum, l) => sum + round2(l.quantity * l.unit_amount), 0),
  );

  // Resolve the billing account from the placement's booking, if any.
  let accountId: number | null = null;
  if (placement.booking_id != null) {
    const [booking] = await db
      .select({ account_id: bookingsTable.account_id })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, placement.booking_id))
      .limit(1);
    accountId = booking?.account_id ?? null;
  }

  const invoice_ref = await nextInvoiceRef();
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      invoice_ref,
      booking_id: placement.booking_id ?? null,
      account_id: accountId,
      amount: String(amount),
      currency,
      exchange_rate_to_aud: await getRateToAud(currency),
      status: "Draft",
      due_date: null,
      description: marker,
    })
    .returning();

  let line_items: (typeof invoiceLineItemsTable.$inferSelect)[] = [];
  if (lines.length > 0) {
    line_items = await db
      .insert(invoiceLineItemsTable)
      .values(
        lines.map((l, i) => ({
          invoice_id: invoice!.id,
          label: l.label,
          line_type: l.line_type ?? "revenue",
          quantity: String(l.quantity),
          unit_amount: String(round2(l.unit_amount)),
          total_amount: String(round2(l.quantity * l.unit_amount)),
          sort_order: i,
        })),
      )
      .returning();
  }

  return { ...invoice!, line_items };
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Extend a placement's stay to `newMoveOut` and bill the extra period as an
 * itemized, booking-linked invoice (weekly-equivalent of the monthly fee ×
 * extra weeks). Updates placement.move_out_date and the linked booking's
 * check_out_date. Returns the new invoice (or null when there is nothing to
 * charge, e.g. monthly_fee is 0). Throws on a not-found or invalid date.
 */
export async function createExtensionInvoice(
  placementId: number,
  newMoveOut: string,
): Promise<PlacementInvoiceResult | null> {
  const [placement] = await db
    .select()
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.id, placementId))
    .limit(1);
  if (!placement) throw new Error(`Placement ${placementId} not found`);

  const oldEnd = placement.move_out_date || placement.move_in_date;
  if (!oldEnd) throw new Error("Placement has no move-in/out date to extend from");
  const extraDays = daysBetween(oldEnd, newMoveOut);
  if (extraDays <= 0) throw new Error("new_move_out_date must be after the current move-out date");

  // Move the stay window forward (placement + its booking).
  await db
    .update(homestayPlacementsTable)
    .set({ move_out_date: newMoveOut, updated_at: new Date() })
    .where(eq(homestayPlacementsTable.id, placementId));
  if (placement.booking_id != null) {
    await db
      .update(bookingsTable)
      .set({ check_out_date: newMoveOut, updated_at: new Date() })
      .where(eq(bookingsTable.id, placement.booking_id));
  }

  // Charge the extra period at the weekly-equivalent of the monthly fee.
  const monthly = Number(placement.monthly_fee);
  if (!(monthly > 0)) return null;
  const weekly = round2((monthly * 12) / 52);
  const extraWeeks = round2(extraDays / 7);
  const amount = round2(weekly * extraWeeks);
  if (!(amount > 0)) return null;

  const currency = placement.currency || DEFAULT_CURRENCY;
  let accountId: number | null = null;
  if (placement.booking_id != null) {
    const [booking] = await db
      .select({ account_id: bookingsTable.account_id })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, placement.booking_id))
      .limit(1);
    accountId = booking?.account_id ?? null;
  }

  const invoice_ref = await nextInvoiceRef();
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      invoice_ref,
      booking_id: placement.booking_id ?? null,
      account_id: accountId,
      amount: String(amount),
      currency,
      exchange_rate_to_aud: await getRateToAud(currency),
      status: "Draft",
      due_date: null,
      description: `Homestay ${placement.placement_ref} — extension (${oldEnd} → ${newMoveOut})`,
    })
    .returning();

  const [item] = await db
    .insert(invoiceLineItemsTable)
    .values({
      invoice_id: invoice!.id,
      label: `Homestay extension (${oldEnd} → ${newMoveOut})`,
      description: `${extraWeeks} week(s) at ${currency} ${weekly}/week`,
      quantity: String(extraWeeks),
      unit_amount: String(weekly),
      total_amount: String(amount),
      sort_order: 0,
    })
    .returning();

  return { ...invoice!, line_items: [item!] };
}
