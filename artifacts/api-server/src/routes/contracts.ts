import { Router } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { db, contractsTable, accountsTable, spacesTable, propertiesTable, contractProductsTable, accommodationCatalogTable, bookingsTable, recurringSchedulesTable, bookingServicesTable, invoicesTable, invoiceLineItemsTable, contractLineItemsTable, contractRelatedCostsTable } from "@workspace/db";
import { eq, ilike, and, like, desc, isNull, inArray } from "drizzle-orm";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { getRateToAud } from "../lib/rateSnapshot";
import { resolveLeaseTermsFromProduct } from "../lib/leaseTerms";
import { generateLeaseRentInvoices } from "../lib/billing/leaseRentInvoices";
import { buildContractHtml, splitAnnex, type ContractDocInput, type ContractPremises, type ContractSignature } from "../lib/documents/contractDocument";
import { buildKoreanLeaseHtml, type KoreanLeaseDocInput } from "../lib/documents/koreanLeaseDocument";
import { buildHousingStandardLeasePdf, type HousingStandardLeaseInput } from "../lib/documents/forms/housingStandardLeaseForm";
import {
  buildMltStandardLeasePdf,
  type MltGuaranteeNoneReason,
  type MltGuaranteeStatus,
  type MltHousingType,
  type MltRentalType,
  type MltStandardLeaseInput,
  type MltSupplyKind,
} from "../lib/documents/forms/mltStandardLeaseForm";
import {
  buildLeaseAttachmentsHtml,
  LEASE_ATTACHMENT_KINDS,
  type LeaseAttachmentInput,
  type LeaseAttachmentKind,
} from "../lib/documents/leaseAttachments";
import { readStoredCompanyInfo } from "../lib/documents/companyInfo";
import { paymentInfoTable } from "@workspace/db";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { buildDocumentFilename, setDocumentDownloadHeaders } from "../lib/documents/filename";
import { formatPostalAddress } from "@workspace/address";
import { resolveCompanyInfo, resolveIssuerCountry } from "../lib/documents/companyInfo";
import { normalizeLang, t, type DocLang } from "../lib/documents/i18n";
import { freezeDocument, snapshotDocType } from "../lib/documents/freeze";
import { formatDocMoney } from "../lib/documents/theme";
import { sendDocumentEmail, resolveDocEmailCopy } from "../lib/email";
import { accountRecipients, parseRecipients, toRecipientsResponse } from "../lib/documents/recipients";
import { resolveTemplate, renderString } from "../lib/documents/templateEngine";
import { createSigningRequest, type SignerSpec } from "../services/contractSigning";
import { emailLogsTable } from "@workspace/db";

// ─── Invoice ref generator (returns a factory that increments safely) ────────
async function makeInvoiceRefFactory(): Promise<() => string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ ref: invoicesTable.invoice_ref })
    .from(invoicesTable)
    .where(like(invoicesTable.invoice_ref, `MS-INV-${year}-%`))
    .orderBy(desc(invoicesTable.id))
    .limit(1);
  let counter = 0;
  if (rows.length > 0) {
    const last = rows[0].ref;
    const num = parseInt(last.split("-").pop() ?? "0", 10);
    counter = isNaN(num) ? 0 : num;
  }
  return () => {
    counter++;
    return `MS-INV-${year}-${String(counter).padStart(5, "0")}`;
  };
}

// ─── Month name helper ────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Add months to a date string (YYYY-MM-DD) ────────────────────────────────
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatPeriodLabel(freq: string, dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const mon = MONTH_NAMES[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (freq === "Monthly") return `${mon} ${yr}`;
  return `${day} ${mon} ${yr}`;
}

// ─── Core: generate invoices + payment schedules for a contract ───────────────
// Uses contract_line_items as the source of truth.
// Falls back to contract_products if no line items exist (backward compat).
async function generateContractInvoicesAndSchedules(
  contractId: number,
  billingMode: "upfront" | "incremental" = "upfront",
): Promise<{ invoices: number; schedules: number }> {
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!contract || !contract.start_date || !contract.end_date) return { invoices: 0, schedules: 0 };

  const start = contract.start_date;
  const end = contract.end_date;
  const currency = contract.currency ?? DEFAULT_CURRENCY;
  const weeklyRate = contract.weekly_rate ?? 0;

  // ── Build location label ────────────────────────────────────────────────────
  let locationLabel = "";
  if (contract.space_id) {
    const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, contract.space_id));
    if (space) {
      locationLabel = space.name ?? "";
      if (space.property_id) {
        const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id));
        if (prop?.address) locationLabel = `${prop.address}${space.name ? `, ${space.name}` : ""}`;
      }
    }
  }

  // ── Fetch active line items ────────────────────────────────────────────────
  let lineItems = await db.select().from(contractLineItemsTable)
    .where(and(eq(contractLineItemsTable.contract_id, contractId), eq(contractLineItemsTable.status, "Active")));

  // ── Fallback: no line items → create virtual Rent line from product ──────────
  if (lineItems.length === 0) {
    let billingFreq = "Monthly";
    // Prefer product_id (accommodation_catalog) over legacy contract_product_id
    if (contract.product_id) {
      const [prod] = await db.select().from(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, contract.product_id));
      if (prod?.billing_frequency) billingFreq = prod.billing_frequency;
    } else if (contract.contract_product_id) {
      const [cp] = await db.select().from(contractProductsTable).where(eq(contractProductsTable.id, contract.contract_product_id));
      if (cp?.billing_frequency) billingFreq = cp.billing_frequency;
    }
    const rentAmount = billingFreq === "Weekly" ? weeklyRate
      : billingFreq === "Biweekly" ? weeklyRate * 2
      : parseFloat((weeklyRate * (52 / 12)).toFixed(2));

    const rentName = billingFreq === "Monthly" ? "Monthly Rent"
      : billingFreq === "Biweekly" ? "Fortnightly Rent" : "Weekly Rent";

    // Persist the fallback line so it shows in the UI
    const [inserted] = await db.insert(contractLineItemsTable).values({
      contract_id: contractId,
      item_type: "Rent",
      name: rentName,
      billing_trigger: "recurring",
      billing_frequency: billingFreq,
      unit_price: String(rentAmount),
      quantity: 1,
      total_price: String(rentAmount),
      currency,
      gst_included: true,
      status: "Active",
    }).returning();
    lineItems = [inserted];
  }

  // ── Wipe existing non-paid schedules and non-paid invoices ─────────────────
  await db.delete(recurringSchedulesTable).where(eq(recurringSchedulesTable.contract_id, contractId));
  const existingInvoices = await db.select({ id: invoicesTable.id, status: invoicesTable.status, due_date: invoicesTable.due_date, description: invoicesTable.description })
    .from(invoicesTable).where(eq(invoicesTable.contract_id, contractId));
  const unpaidIds = existingInvoices.filter(i => i.status !== "Paid").map(i => i.id);
  for (const iid of unpaidIds) {
    await db.delete(invoicesTable).where(eq(invoicesTable.id, iid));
  }

  // Build a set of (due_date+description) pairs for Paid invoices to avoid duplication
  const paidKeys = new Set(
    existingInvoices.filter(i => i.status === "Paid").map(i => `${i.due_date}__${i.description}`)
  );

  // ── Invoice ref factory ────────────────────────────────────────────────────
  const nextInvoiceRef = await makeInvoiceRefFactory();

  const invoicesCreated: number[] = [];
  const schedulesCreated: number[] = [];

  // ── Process each line item ─────────────────────────────────────────────────
  for (const line of lineItems) {
    const lineAmount = parseFloat(line.total_price ?? "0");
    const lineCurrency = line.currency ?? currency;
    const lineName = line.name;

    if (line.billing_trigger === "recurring") {
      const freq = line.billing_frequency ?? "Monthly";

      // Incremental mode: create ONE schedule the daily cron bills cycle-by-cycle,
      // instead of pre-generating every invoice for the whole term up front.
      if (billingMode === "incremental") {
        const [sched] = await db.insert(recurringSchedulesTable).values({
          booking_id: contract.booking_id ?? 0,
          contract_id: contractId,
          account_id: contract.tenant_account_id ?? 0,
          schedule_type: line.item_type === "Rent" ? "Rent" : lineName,
          frequency: freq,
          amount: String(lineAmount),
          currency: lineCurrency,
          gst_included: line.gst_included ?? true,
          start_date: start,
          end_date: end,
          next_due_date: start,
          billing_mode: "incremental",
          is_active: true,
        }).returning({ id: recurringSchedulesTable.id });
        schedulesCreated.push(sched.id);
        continue;
      }

      // Generate periodic invoices + schedules across the contract period
      let current = start;
      let safety = 0;

      while (current < end && safety < 500) {
        safety++;
        let nextDate: string;
        if (freq === "Weekly") nextDate = addDays(current, 7);
        else if (freq === "Biweekly") nextDate = addDays(current, 14);
        else nextDate = addMonths(current, 1);

        const periodEnd = nextDate > end ? end : nextDate;
        const label = formatPeriodLabel(freq, current);
        const description = `${lineName} — ${label}${locationLabel ? ` | ${locationLabel}` : ""}`;
        const paidKey = `${current}__${description}`;

        if (!paidKeys.has(paidKey)) {
          const invoiceRef = nextInvoiceRef();
          const [inv] = await db.insert(invoicesTable).values({
            invoice_ref: invoiceRef,
            booking_id: contract.booking_id ?? null,
            contract_id: contractId,
            account_id: contract.tenant_account_id ?? null,
            amount: String(lineAmount),
            currency: lineCurrency,
            exchange_rate_to_aud: await getRateToAud(lineCurrency),
            status: "Sent",
            due_date: current,
            description,
          }).returning({ id: invoicesTable.id });
          invoicesCreated.push(inv.id);
        }

        const [sched] = await db.insert(recurringSchedulesTable).values({
          booking_id: contract.booking_id ?? 0,
          contract_id: contractId,
          account_id: contract.tenant_account_id ?? 0,
          schedule_type: line.item_type === "Rent" ? "Rent" : lineName,
          frequency: freq,
          amount: String(lineAmount),
          currency: lineCurrency,
          gst_included: line.gst_included ?? true,
          start_date: current,
          end_date: periodEnd,
          next_due_date: current,
          is_active: !paidKeys.has(`${current}__`),
        }).returning({ id: recurringSchedulesTable.id });
        schedulesCreated.push(sched.id);

        current = nextDate;
        if (nextDate >= end) break;
      }

    } else {
      // One-time charge: generate a single invoice on the contract start date
      const description = `${lineName}${line.quantity && line.quantity > 1 ? ` × ${line.quantity}` : ""}${locationLabel ? ` | ${locationLabel}` : ""}`;
      const paidKey = `${start}__${description}`;

      if (!paidKeys.has(paidKey)) {
        const invoiceRef = nextInvoiceRef();
        const [inv] = await db.insert(invoicesTable).values({
          invoice_ref: invoiceRef,
          booking_id: contract.booking_id ?? null,
          contract_id: contractId,
          account_id: contract.tenant_account_id ?? null,
          amount: String(lineAmount),
          currency: lineCurrency,
          exchange_rate_to_aud: await getRateToAud(lineCurrency),
          status: "Sent",
          due_date: start,
          description,
        }).returning({ id: invoicesTable.id });
        invoicesCreated.push(inv.id);
      }

      // Also create a single schedule entry for one-time charges
      const [sched] = await db.insert(recurringSchedulesTable).values({
        booking_id: contract.booking_id ?? 0,
        contract_id: contractId,
        account_id: contract.tenant_account_id ?? 0,
        schedule_type: lineName,
        frequency: "OneTime",
        amount: String(lineAmount),
        currency: lineCurrency,
        gst_included: line.gst_included ?? true,
        start_date: start,
        end_date: start,
        next_due_date: start,
        is_active: true,
      }).returning({ id: recurringSchedulesTable.id });
      schedulesCreated.push(sched.id);
    }
  }

  // ── Security deposit (bond) invoice ─────────────────────────────────────────
  // The refundable bond is invoiced once, as a line_type='deposit' line, so that
  // on payment postInvoicePaid credits it to Deposits Held (2100) instead of
  // revenue (H-402) — which is what move-out settlement later releases.
  //
  // Guarded to contracts with NO paid invoices yet, so we never retroactively
  // bond-invoice a running contract whose bond may have been collected off-system.
  // Using "no paid invoices" rather than "no invoices at all" lets a contract whose
  // activation previously failed part-way (rent invoices created, then an error)
  // still get its deposit invoice on a re-activate. Also idempotent on the deposit
  // line (existingDeposit check below), so it never double-creates.
  const bond = Number(contract.bond_amount ?? 0);
  if (bond > 0 && !existingInvoices.some((i) => i.status === "Paid")) {
    const existingDeposit = await db
      .select({ id: invoiceLineItemsTable.id })
      .from(invoiceLineItemsTable)
      .innerJoin(invoicesTable, eq(invoiceLineItemsTable.invoice_id, invoicesTable.id))
      .where(and(eq(invoicesTable.contract_id, contractId), eq(invoiceLineItemsTable.line_type, "deposit")))
      .limit(1);
    if (existingDeposit.length === 0) {
      const [bondInv] = await db.insert(invoicesTable).values({
        invoice_ref: nextInvoiceRef(),
        booking_id: contract.booking_id ?? null,
        contract_id: contractId,
        account_id: contract.tenant_account_id ?? null,
        amount: String(Math.round(bond * 100) / 100),
        currency,
        exchange_rate_to_aud: await getRateToAud(currency),
        status: "Sent",
        due_date: start,
        description: `Security Deposit (Bond)${locationLabel ? ` | ${locationLabel}` : ""}`,
      }).returning({ id: invoicesTable.id });
      await db.insert(invoiceLineItemsTable).values({
        invoice_id: bondInv.id,
        label: "Security Deposit (Bond)",
        description: "Refundable security deposit",
        quantity: "1",
        unit_amount: String(Math.round(bond * 100) / 100),
        total_amount: String(Math.round(bond * 100) / 100),
        line_type: "deposit",
        sort_order: 0,
      });
      invoicesCreated.push(bondInv.id);
    }
  }

  return { invoices: invoicesCreated.length, schedules: schedulesCreated.length };
}

const router = Router();

async function nextContractRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: contractsTable.id }).from(contractsTable)
    .where(ilike(contractsTable.contract_ref, `MS-C-${year}-%`));
  const count = rows.length + 1;
  return `MS-C-${year}-${String(count).padStart(5, "0")}`;
}

async function enrichContracts(rows: (typeof contractsTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const tenantIds = [...new Set(rows.map(r => r.tenant_account_id).filter(Boolean))] as number[];
  const landlordIds = [...new Set(rows.map(r => r.landlord_account_id).filter(Boolean))] as number[];
  const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
  const legacyProductIds = [...new Set(rows.map(r => r.contract_product_id).filter(Boolean))] as number[];
  const productIds = [...new Set(rows.map(r => r.product_id).filter(Boolean))] as number[];
  const bookingIds = [...new Set(rows.map(r => r.booking_id).filter(Boolean))] as number[];

  const accountMap: Record<number, string> = {};
  const spaceMap: Record<number, string> = {};
  const productMap: Record<number, string> = {};
  const accommodationMap: Record<number, string> = {};
  const bookingMap: Record<number, string> = {};

  // One batched query per lookup table. A per-id loop here is an N+1 that costs a
  // full round trip per contract — 40s+ on a remote pooler once the lease import
  // pushed the table to a few hundred rows.
  const accountIds = [...new Set([...tenantIds, ...landlordIds])];
  const [accountRows, spaceRows, legacyProductRows, productRows, bookingRows] = await Promise.all([
    accountIds.length
      ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, accountIds))
      : Promise.resolve([]),
    spaceIds.length
      ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds))
      : Promise.resolve([]),
    legacyProductIds.length
      ? db.select({ id: contractProductsTable.id, name: contractProductsTable.name }).from(contractProductsTable).where(inArray(contractProductsTable.id, legacyProductIds))
      : Promise.resolve([]),
    productIds.length
      ? db.select({ id: accommodationCatalogTable.id, name: accommodationCatalogTable.name }).from(accommodationCatalogTable).where(inArray(accommodationCatalogTable.id, productIds))
      : Promise.resolve([]),
    bookingIds.length
      ? db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref }).from(bookingsTable).where(inArray(bookingsTable.id, bookingIds))
      : Promise.resolve([]),
  ]);
  for (const a of accountRows) accountMap[a.id] = a.name;
  for (const s of spaceRows) spaceMap[s.id] = s.name;
  for (const p of legacyProductRows) productMap[p.id] = p.name;
  for (const p of productRows) accommodationMap[p.id] = p.name;
  for (const b of bookingRows) bookingMap[b.id] = b.booking_ref;

  return rows.map(r => ({
    ...r,
    tenant_name: r.tenant_account_id ? (accountMap[r.tenant_account_id] ?? null) : null,
    landlord_name: r.landlord_account_id ? (accountMap[r.landlord_account_id] ?? null) : null,
    space_name: r.space_id ? (spaceMap[r.space_id] ?? null) : null,
    product_name: r.product_id ? (accommodationMap[r.product_id] ?? null)
      : r.contract_product_id ? (productMap[r.contract_product_id] ?? null) : null,
    contract_product_name: r.contract_product_id ? (productMap[r.contract_product_id] ?? null) : null,
    booking_ref: r.booking_id ? (bookingMap[r.booking_id] ?? null) : null,
  }));
}

router.get("/v1/contracts", async (req, res): Promise<void> => {
  const { q, status, tenant_account_id, space_id, booking_id, account_id } = req.query as Record<string, string>;
  const conditions: any[] = [deletedFilter(contractsTable.deleted_at, req)];
  if (q) conditions.push(ilike(contractsTable.contract_ref, `%${q}%`));
  if (status) conditions.push(eq(contractsTable.status, status));
  if (tenant_account_id) conditions.push(eq(contractsTable.tenant_account_id, Number(tenant_account_id)));
  if (account_id) conditions.push(eq(contractsTable.tenant_account_id, Number(account_id)));
  if (space_id) conditions.push(eq(contractsTable.space_id, Number(space_id)));
  if (booking_id) conditions.push(eq(contractsTable.booking_id, Number(booking_id)));
  const rows = await db.select().from(contractsTable)
    .where(and(...conditions))
    .orderBy(contractsTable.id);
  const result = await enrichContracts(rows);
  res.json(result);
});

/**
 * 민간임대주택 표준임대차계약서(별지 제24호서식) 법정 기재사항을 요청 본문에서 뽑는다.
 * 서식이 정해 둔 값만 통과시키고(오타로 체크박스가 사라지지 않게), 나머지는 null.
 */
function mltLeaseFields(data: Record<string, unknown>) {
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    mlt_landlord_rental_biz_no: str(data.mlt_landlord_rental_biz_no),
    mlt_housing_type: pick(data.mlt_housing_type, ["apartment", "row_house", "multiplex", "multi_family", "other"] as const),
    mlt_rental_type: pick(data.mlt_rental_type, ["public_support", "long_term", "short_term"] as const),
    mlt_rental_term_years: num(data.mlt_rental_term_years),
    mlt_rental_type_other: str(data.mlt_rental_type_other),
    mlt_supply_kind: pick(data.mlt_supply_kind, ["built", "purchased"] as const),
    mlt_mandatory_start_date: str(data.mlt_mandatory_start_date),
    mlt_over_100_units: bool(data.mlt_over_100_units),
    mlt_ancillary_facilities: str(data.mlt_ancillary_facilities),
    mlt_senior_lien: bool(data.mlt_senior_lien),
    mlt_senior_lien_kind: str(data.mlt_senior_lien_kind),
    mlt_senior_lien_amount: num(data.mlt_senior_lien_amount),
    mlt_senior_lien_date: str(data.mlt_senior_lien_date),
    mlt_tax_arrears: bool(data.mlt_tax_arrears),
    mlt_guarantee_status: pick(data.mlt_guarantee_status, ["joined", "partial", "not_joined"] as const),
    mlt_guarantee_amount: num(data.mlt_guarantee_amount),
    mlt_guarantee_none_reason: pick(data.mlt_guarantee_none_reason, ["zero", "priority", "public_landlord", "tenant_guarantee"] as const),
    mlt_late_fee_rate: num(data.mlt_late_fee_rate),
    interim_payment: num(data.interim_payment),
    interim_payment_date: str(data.interim_payment_date),
  };
}

router.post("/v1/contracts", async (req, res): Promise<void> => {
  const data = req.body;
  const contract_ref = await nextContractRef();
  // Auto-fill 보증금 / 월세 from the selected 숙박상품 (Korean rent tier) as defaults —
  // only where the caller didn't provide the field, so manual values still win.
  const lease = await resolveLeaseTermsFromProduct(data.product_id);
  const [row] = await db.insert(contractsTable).values({
    contract_ref,
    booking_id: data.booking_id ?? null,
    product_id: data.product_id ?? null,
    contract_product_id: data.contract_product_id ?? null,
    tenant_account_id: data.tenant_account_id ?? null,
    landlord_account_id: data.landlord_account_id ?? null,
    space_id: data.space_id ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    weekly_rate: data.weekly_rate ?? null,
    total_rent: data.total_rent ?? null,
    bond_amount: data.bond_amount ?? lease?.deposit_amount ?? null,
    monthly_rent: data.monthly_rent ?? lease?.effective_monthly ?? null,
    advance_amount: data.advance_amount ?? null,
    contract_category: data.contract_category ?? null,
    lease_form: data.lease_form ?? null,
    doc_attachments: normalizeAttachmentsInput(data.doc_attachments),
    ...mltLeaseFields(data),
    down_payment: data.down_payment ?? null,
    down_payment_date: data.down_payment_date ?? null,
    balance_amount: data.balance_amount ?? null,
    balance_date: data.balance_date ?? null,
    rent_due_day: data.rent_due_day ?? null,
    currency: data.currency ?? lease?.currency ?? DEFAULT_CURRENCY,
    exchange_rate_to_aud: await getRateToAud(data.currency ?? lease?.currency ?? DEFAULT_CURRENCY),
    status: "Draft",
    document_url: data.document_url ?? null,
    terms_text: data.terms_text ?? null,
    notes: data.notes ?? null,
  }).returning();
  const [result] = await enrichContracts([row]);
  res.status(201).json(result);
});

router.get("/v1/contracts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrichContracts([row]);
  res.json(result);
});

/** Build the branded-document input for a contract (enriched names + fields). */
/**
 * Describe the leased unit for a Korean lease agreement's 부동산의 표시 table.
 *
 * Metheim models unit *types* as parent spaces that real units hang off via
 * `parent_space_id`, and the Korean area breakdown is authored on those type
 * rows (see docs/tenants/metheim/UNIT_INVENTORY.md). So each field falls back
 * unit → type: one standard agreement then renders correct per-type areas
 * without a separate template per type.
 */
async function buildContractPremises(
  spaceId: number | null | undefined,
): Promise<{ premises: ContractPremises; property: typeof propertiesTable.$inferSelect | null } | null> {
  if (!spaceId) return null;
  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) return null;

  let parent: typeof space | undefined;
  if (space.parent_space_id) {
    [parent] = await db.select().from(spacesTable).where(eq(spacesTable.id, space.parent_space_id));
  }
  const inherited = (key: keyof typeof space): number | null => {
    const own = space[key] as number | null | undefined;
    if (own != null) return Number(own);
    const up = parent?.[key] as number | null | undefined;
    return up != null ? Number(up) : null;
  };

  let property: typeof propertiesTable.$inferSelect | undefined;
  if (space.property_id) {
    [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id));
  }

  return {
    property: property ?? null,
    premises: {
      location: [property?.address, property?.address2].filter(Boolean).join(" ") || null,
      building: property?.name ?? null,
      unit_no: space.name ?? null,
      floor: space.floor_number != null ? String(space.floor_number) : null,
      // Unit rows carry the type in `custom_type_name` ("A-1타입"); the parent
      // type space is named for it. `space_type` is a system enum
      // ("Whole Property") and must never reach a contract.
      unit_type: space.custom_type_name ?? parent?.name ?? null,
      structure_use: property?.building_use ?? null,
      exclusive_area_m2: inherited("exclusive_area_m2"),
      residential_common_area_m2: inherited("residential_common_area_m2"),
      supply_area_m2: inherited("supply_area_m2"),
      other_common_area_m2: inherited("other_common_area_m2"),
      contract_area_m2: inherited("contract_area_m2"),
      land_share_m2: inherited("land_share_m2"),
    },
  };
}

/**
 * Resolve the two 납부계좌 rows (임대료 / 보증금) from `payment_info`. Matched by
 * keyword on the row name so ops control the mapping from Settings → Payment
 * Info; when only one active account exists it is used for both lines.
 */
async function resolveLeaseAccounts(): Promise<KoreanLeaseDocInput["accounts"]> {
  const rows = await db.select().from(paymentInfoTable)
    .where(and(eq(paymentInfoTable.status, "Active"), isNull(paymentInfoTable.deleted_at)));
  if (!rows.length) return [];
  const find = (...keywords: string[]) =>
    rows.find((r) => keywords.some((k) => (r.name ?? "").includes(k)));
  const rent = find("임대료", "월세", "차임") ?? rows[0];
  const deposit = find("보증금") ?? rows[0];
  const line = (label: string, r: typeof rows[number]) => ({
    label,
    bank_name: r.bank_name,
    account_number: r.account_number,
    account_name: r.account_name,
  });
  return [line("임대료 납부계좌", rent), line("보증금 납부계좌", deposit)];
}

/**
 * The {{variables}} an editable lease-agreement body may reference. Names match
 * the `variables_schema` seeded on the template, so the Templates Studio shows
 * the same list ops can insert. Unknown/blank values render as empty strings.
 */
function contractTemplateVars(
  c: Record<string, any>,
  row: typeof contractsTable.$inferSelect,
  premises: ContractPremises | null,
  rents: { list: number | null; actual: number | null },
): Record<string, unknown> {
  const currency = c.currency ?? DEFAULT_CURRENCY;
  const m = (v: unknown) => (v == null || v === "" ? "" : formatDocMoney(Number(v), currency));
  const a = (v: number | null | undefined) =>
    v == null ? "" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  return {
    contract_ref: c.contract_ref ?? "",
    tenant_name: c.tenant_name ?? "",
    landlord_name: c.landlord_name ?? "",
    start_date: row.start_date ?? "",
    end_date: row.end_date ?? "",
    // 부동산의 표시 — sourced from the contract's space (unit → type fallback).
    location: premises?.location ?? "",
    building: premises?.building ?? "",
    unit_no: premises?.unit_no ?? "",
    floor: premises?.floor ?? "",
    unit_type: premises?.unit_type ?? "",
    structure_use: premises?.structure_use ?? "",
    area_exclusive: a(premises?.exclusive_area_m2),
    area_residential_common: a(premises?.residential_common_area_m2),
    area_supply: a(premises?.supply_area_m2),
    area_other_common: a(premises?.other_common_area_m2),
    area_contract: a(premises?.contract_area_m2),
    area_land_share: a(premises?.land_share_m2),
    // Korean lease payment terms (계약서 구분 / 계약금·잔금·보증금·월세).
    contract_category: row.contract_category ?? "",
    deposit_amount: m(row.bond_amount),
    // 차임 as written on the agreement (rate-card list price) vs the 특판가 the
    // tenant actually pays each month.
    monthly_rent: m(rents.list ?? rents.actual),
    promo_monthly_rent: m(rents.actual ?? rents.list),
    rent_due_day: row.rent_due_day != null ? String(row.rent_due_day) : "",
    down_payment: m(row.down_payment),
    down_payment_date: row.down_payment_date ?? "",
    balance_amount: m(row.balance_amount),
    balance_date: row.balance_date ?? "",
    total_rent: m(row.total_rent),
    currency,
  };
}

/** 발급할 계약서 서식 — contracts.lease_form. */
export type ContractLeaseForm = "housing_standard" | "mlt_standard" | "general";

/** 어드민이 보낸 첨부 선택(배열 또는 이미 JSON 문자열) → 저장할 JSON 문자열. */
function normalizeAttachmentsInput(raw: unknown): string | null {
  const valid = new Set<string>(LEASE_ATTACHMENT_KINDS);
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw.trim()
      ? (() => { try { return JSON.parse(raw); } catch { return raw.split(","); } })()
      : null;
  if (!Array.isArray(list)) return null;
  const kinds = list.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter((k) => valid.has(k));
  return kinds.length ? JSON.stringify(kinds) : null;
}

/** contracts.doc_attachments(JSON 배열) → 유효한 첨부 키만. */
function parseAttachmentKinds(raw: string | null | undefined): LeaseAttachmentKind[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 손으로 넣은 쉼표 목록도 받아 준다.
    parsed = raw.split(",").map((s) => s.trim());
  }
  if (!Array.isArray(parsed)) return [];
  const valid = new Set<string>(LEASE_ATTACHMENT_KINDS);
  return parsed.filter((k): k is LeaseAttachmentKind => typeof k === "string" && valid.has(k));
}

export interface BuiltContractDoc {
  doc: ContractDocInput;
  tenantAccountId: number | null;
  lease: KoreanLeaseDocInput | null;
  /** 선택된 계약서 서식. null 이면 기존 동작(general). */
  leaseForm: ContractLeaseForm | null;
  /** 법무부 주택임대차표준계약서 입력값. */
  housing: HousingStandardLeaseInput;
  mlt: MltStandardLeaseInput;
  /** 계약 상세에서 체크한 첨부 문서 종류. */
  attachmentKinds: LeaseAttachmentKind[];
  /** 첨부 문서 렌더링 입력값. */
  attachments: LeaseAttachmentInput;
}

export async function buildContractDocInput(
  id: number,
  lang: DocLang = "en",
): Promise<BuiltContractDoc | null> {
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!row) return null;
  const [c] = await enrichContracts([row]);
  // Terms: per-contract terms_text wins; otherwise fall back to the editable
  // PDF template (Templates Studio → PDF tab: `pdf.tenancy_agreement`), then the
  // legacy `contract.terms` (contract kind), then to none — all locale-aware.
  // The leased unit (부동산의 표시) — also the source of the {{area_*}} / {{unit_*}}
  // template variables, so one standard agreement adapts to each unit type.
  const resolvedPremises = await buildContractPremises(row.space_id);
  const premises = resolvedPremises?.premises ?? null;
  const property = resolvedPremises?.property ?? null;

  // Korean leases print TWO rents: the list rate recorded on the agreement
  // (차임 — the rate-card product's monthly price) and the discounted 특판가 the
  // tenant actually pays (the contract's own monthly_rent). When no rate-card
  // product is linked, both are the contract's rent and the clause still reads
  // correctly.
  let listMonthlyRent: number | null = null;
  if (row.product_id) {
    const [p] = await db.select({ price: accommodationCatalogTable.price })
      .from(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, row.product_id));
    listMonthlyRent = p?.price ?? null;
  }
  const actualMonthlyRent = row.monthly_rent ?? row.weekly_rate ?? null;

  let termsText = c.terms_text;
  let annexText: string | null = null;
  // True when the Korean standard lease template supplied the body — that same
  // flag selects the Korean lease *layout* (부동산 표기 / 계약내용 / 당사자 표 /
  // 계약일반조항 / 별지) instead of the generic accommodation-agreement shell.
  let isKoreanLease = false;
  if (!termsText?.trim()) {
    // Preference order: the Korean standard lease body (`pdf.lease_agreement`,
    // e.g. 시행사 (주)HK 임대차 계약서 — clauses + [별지] annex in one body) →
    // the generic tenancy terms → the legacy `contract.terms`.
    const leaseTpl = await resolveTemplate({ kind: "pdf", key: "pdf.lease_agreement", locale: lang });
    const tenancyTpl = leaseTpl?.bodyHtml?.trim() ? null : await resolveTemplate({ kind: "pdf", key: "pdf.tenancy_agreement", locale: lang });
    const tpl = leaseTpl?.bodyHtml?.trim() ? leaseTpl
      : tenancyTpl?.bodyHtml?.trim() ? tenancyTpl
      : await resolveTemplate({ kind: "contract", key: "contract.terms", locale: lang });
    if (tpl?.bodyHtml?.trim()) {
      // Substitute {{variables}} from the contract + its space, then split the
      // annex out so it prints as the last page of the SAME PDF.
      const split = splitAnnex(renderString(tpl.bodyHtml, contractTemplateVars(c, row, premises, { list: listMonthlyRent, actual: actualMonthlyRent })));
      termsText = split.terms;
      annexText = split.annex;
      isKoreanLease = tpl === leaseTpl;
    }
  }

  // Enrich tenant/landlord contact + the rent billing frequency so the agreement
  // can show per-party detail and a subdivided fee breakdown.
  const issuerCountry = await resolveIssuerCountry();
  const composeAddr = (a: typeof accountsTable.$inferSelect | undefined): string | null =>
    a
      ? formatPostalAddress({
          line1: a.address_line1,
          suburb: a.address_suburb,
          state: a.address_state,
          postcode: a.address_postcode,
          country: a.address_country,
        }, lang, { orderFallbackCountry: issuerCountry }) || null
      : null;
  let tenantEmail: string | null = null, tenantAddress: string | null = null, tenantPhone: string | null = null;
  let landlordEmail: string | null = null, landlordAddress: string | null = null;
  if (row.tenant_account_id) {
    const [a] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.tenant_account_id));
    tenantEmail = a?.account_email ?? null; tenantAddress = composeAddr(a); tenantPhone = a?.phone1 ?? a?.phone2 ?? null;
  }
  if (row.landlord_account_id) {
    const [a] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.landlord_account_id));
    landlordEmail = a?.account_email ?? null; landlordAddress = composeAddr(a);
  }
  let billingFrequency: string | null = null;
  if (row.product_id) {
    const [p] = await db.select({ f: accommodationCatalogTable.billing_frequency }).from(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, row.product_id));
    billingFrequency = p?.f ?? null;
  } else if (row.contract_product_id) {
    const [p] = await db.select({ f: contractProductsTable.billing_frequency }).from(contractProductsTable).where(eq(contractProductsTable.id, row.contract_product_id));
    billingFrequency = p?.f ?? null;
  }

  // Priced add-on services attached to the contract (airport pickup, settlement,
  // prepaid phone, …) — stored as contract_line_items with item_type=Service.
  // These are copied from booking_services when a booking becomes a contract.
  const serviceRows = await db.select().from(contractLineItemsTable)
    .where(and(
      eq(contractLineItemsTable.contract_id, id),
      eq(contractLineItemsTable.item_type, "Service"),
      eq(contractLineItemsTable.status, "Active"),
    ))
    .orderBy(contractLineItemsTable.id);
  const additionalServices = serviceRows.map((s) => ({
    name: s.name,
    quantity: s.quantity ?? 1,
    unit_amount: Number(s.unit_price ?? 0),
    total_amount: Number(s.total_price ?? 0),
    recurring: s.billing_trigger === "recurring",
    frequency: s.billing_frequency,
    notes: s.notes,
  }));

  // Korean standard lease payload — only when the 임대차 계약서 template drives
  // the body. Everything type-specific comes from `premises` (the space), so one
  // template covers every unit type.
  let lease: KoreanLeaseDocInput | null = null;
  if (isKoreanLease) {
    const stored = await readStoredCompanyInfo();
    const buildingName = premises?.building ?? property?.name ?? "";
    lease = {
      contract_ref: c.contract_ref,
      title: `${buildingName} 임대차 계약서`.trim(),
      premises,
      registry: property
        ? {
            lot_address: property.lot_address,
            building_use: property.building_use,
            building_structure: property.building_structure,
            land_category: property.land_category,
            land_area_m2: property.land_area_m2,
            land_right_type: property.land_right_type,
            leased_portion: "전유부분 전체",
          }
        : null,
      landlord: {
        name: (c as any).landlord_name || stored.company_name || null,
        address: landlordAddress || stored.address1 || null,
        phone: stored.phone ?? null,
        email: landlordEmail || stored.email || null,
        business_no: stored.biz_no ?? stored.abn ?? null,
        corporate_no: stored.corp_no ?? null,
      },
      tenant: {
        name: (c as any).tenant_name ?? null,
        address: tenantAddress,
        phone: tenantPhone,
        email: tenantEmail,
      },
      currency: c.currency ?? DEFAULT_CURRENCY,
      deposit_amount: row.bond_amount,
      down_payment: row.down_payment,
      down_payment_date: row.down_payment_date,
      balance_amount: row.balance_amount,
      balance_date: row.balance_date,
      monthly_rent: listMonthlyRent ?? actualMonthlyRent,
      rent_due_day: row.rent_due_day,
      start_date: row.start_date,
      end_date: row.end_date,
      signed_on: row.signed_at ?? row.effective_date ?? row.created_at,
      accounts: await resolveLeaseAccounts(),
      clauses_text: termsText,
      annex_text: annexText,
    };
  }

  // 법무부 주택임대차표준계약서 — 등록임대사업자가 아닌 일반 임대인용 서식.
  // 원본 정부 PDF 위에 값만 얹으므로(forms/housingStandardLeaseForm) 여기서는
  // 계약 데이터를 서식 입력 모양으로 옮기기만 한다.
  const storedCompany = await readStoredCompanyInfo();
  const housingBuildingName = premises?.building ?? property?.name ?? null;
  const housing: HousingStandardLeaseInput = {
    // 보증금만 있으면 전세, 차임만 있으면 월세, 둘 다면 보증금 있는 월세.
    kind: actualMonthlyRent ? (row.bond_amount ? "deposit_monthly" : "monthly") : "jeonse",
    contract_kind: "new",
    property_address: [premises?.location, housingBuildingName].filter(Boolean).join(" ") || null,
    land_category: property?.land_category ?? null,
    land_area_m2: property?.land_area_m2 ?? null,
    building_structure_use: premises?.structure_use ?? property?.building_structure ?? null,
    building_area_m2: premises?.supply_area_m2 ?? premises?.exclusive_area_m2 ?? null,
    leased_portion: premises?.unit_no ?? null,
    leased_area_m2: premises?.exclusive_area_m2 ?? null,
    deposit_amount: row.bond_amount,
    down_payment: row.down_payment,
    balance_amount: row.balance_amount,
    balance_date: row.balance_date,
    monthly_rent: actualMonthlyRent,
    rent_due_day: row.rent_due_day,
    handover_date: row.start_date,
    start_date: row.start_date,
    end_date: row.end_date,
    signed_on: row.signed_at ?? row.effective_date ?? row.created_at,
    landlord: {
      name: (c as any).landlord_name || storedCompany.company_name || null,
      address: landlordAddress || storedCompany.address1 || null,
      phone: storedCompany.phone ?? null,
      id_no: storedCompany.biz_no ?? storedCompany.abn ?? null,
    },
    tenant: {
      name: (c as any).tenant_name ?? null,
      address: tenantAddress,
      phone: tenantPhone,
    },
  };

  // 민간임대주택 표준임대차계약서(별지 제24호서식) — 등록임대사업자 전용 법정서식.
  // 서식이 요구하는 법정 고지사항(종류·의무기간·선순위·체납·보증)은 계약에
  // 스냅숏으로 저장해 둔 mlt_* 컬럼(0033)에서 온다. 주민등록번호는 저장하지
  // 않으므로 해당 칸은 늘 비어 나가고 수기로 채운다.
  const mltAccounts = await resolveLeaseAccounts();
  const mltAccount = mltAccounts.find((a) => a.label.includes("보증금")) ?? mltAccounts[0] ?? null;
  const mlt: MltStandardLeaseInput = {
    signed_on: row.signed_at ?? row.effective_date ?? row.created_at,
    landlord: {
      name: (c as any).landlord_name || storedCompany.company_name || null,
      address: landlordAddress || storedCompany.address1 || null,
      phone: storedCompany.phone ?? null,
      id_no: storedCompany.biz_no ?? storedCompany.abn ?? null,
    },
    landlord_rental_biz_no: row.mlt_landlord_rental_biz_no ?? null,
    tenant: {
      name: (c as any).tenant_name ?? null,
      address: tenantAddress,
      phone: tenantPhone,
    },
    property_address: [premises?.location, housingBuildingName, premises?.unit_no ? `${premises.unit_no}호` : null]
      .filter(Boolean).join(" ") || null,
    housing_type: (row.mlt_housing_type as MltHousingType | null) ?? null,
    area_exclusive_m2: premises?.exclusive_area_m2 ?? null,
    area_common_residential_m2: premises?.residential_common_area_m2 ?? null,
    area_common_other_m2: premises?.other_common_area_m2 ?? null,
    rental_type: (row.mlt_rental_type as MltRentalType | null) ?? null,
    rental_term_years: row.mlt_rental_term_years ?? null,
    rental_type_other: row.mlt_rental_type_other ?? null,
    supply_kind: (row.mlt_supply_kind as MltSupplyKind | null) ?? null,
    mandatory_start_date: row.mlt_mandatory_start_date ?? null,
    over_100_units: row.mlt_over_100_units ?? null,
    ancillary_facilities: row.mlt_ancillary_facilities ?? null,
    senior_lien: row.mlt_senior_lien ?? null,
    senior_lien_kind: row.mlt_senior_lien_kind ?? null,
    senior_lien_amount: row.mlt_senior_lien_amount ?? null,
    senior_lien_date: row.mlt_senior_lien_date ?? null,
    tax_arrears: row.mlt_tax_arrears ?? null,
    guarantee_status: (row.mlt_guarantee_status as MltGuaranteeStatus | null) ?? null,
    guarantee_amount: row.mlt_guarantee_amount ?? null,
    guarantee_none_reason: (row.mlt_guarantee_none_reason as MltGuaranteeNoneReason | null) ?? null,
    deposit_amount: row.bond_amount,
    monthly_rent: actualMonthlyRent,
    start_date: row.start_date,
    end_date: row.end_date,
    down_payment: row.down_payment,
    interim_payment: row.interim_payment,
    interim_payment_date: row.interim_payment_date,
    balance_amount: row.balance_amount,
    balance_date: row.balance_date,
    account_number: mltAccount?.account_number ?? null,
    bank_name: mltAccount?.bank_name ?? null,
    account_holder: mltAccount?.account_name ?? null,
    late_fee_rate: row.mlt_late_fee_rate ?? null,
  };

  // 계약서 뒤에 붙일 첨부 문서 — 계약 상세에서 고른 것만.
  const attachmentKinds = parseAttachmentKinds(row.doc_attachments);
  const attachments: LeaseAttachmentInput = {
    premises_address: premises?.location ?? null,
    building_name: housingBuildingName,
    unit_no: premises?.unit_no ?? null,
    unit_type: premises?.unit_type ?? null,
    registry: property
      ? {
          lot_address: property.lot_address,
          building_use: property.building_use,
          building_structure: property.building_structure,
          leased_area_m2: premises?.exclusive_area_m2 ?? null,
          leased_portion: "전유부분 전체",
          land_category: property.land_category,
          land_area_m2: property.land_area_m2,
          land_right_type: property.land_right_type,
          land_share_m2: premises?.land_share_m2 ?? null,
        }
      : null,
    landlord: { name: housing.landlord.name, address: housing.landlord.address, phone: housing.landlord.phone },
    tenant: { name: housing.tenant.name, address: housing.tenant.address, phone: housing.tenant.phone },
    start_date: row.start_date,
    end_date: row.end_date,
    deposit_amount: row.bond_amount,
    monthly_rent: actualMonthlyRent,
    signed_on: row.signed_at ? String(row.signed_at) : row.effective_date ?? row.start_date,
    special_terms: annexText,
  };

  return {
    tenantAccountId: row.tenant_account_id ?? null,
    lease,
    leaseForm: (row.lease_form as ContractLeaseForm | null) ?? null,
    housing,
    mlt,
    attachmentKinds,
    attachments,
    doc: {
      contract_ref: c.contract_ref,
      status: c.status,
      tenant_name: (c as any).tenant_name ?? null,
      tenant_email: tenantEmail,
      tenant_address: tenantAddress,
      landlord_name: (c as any).landlord_name ?? null,
      landlord_email: landlordEmail,
      landlord_address: landlordAddress,
      space_name: (c as any).space_name ?? null,
      premises,
      product_name: (c as any).product_name ?? null,
      booking_ref: (c as any).booking_ref ?? null,
      start_date: c.start_date,
      end_date: c.end_date,
      effective_date: row.effective_date ?? null,
      expiry_date: row.expiry_date ?? null,
      billing_frequency: billingFrequency,
      weekly_rate: c.weekly_rate,
      total_rent: c.total_rent,
      bond_amount: c.bond_amount,
      advance_amount: c.advance_amount,
      currency: c.currency,
      additional_services: additionalServices,
      terms_text: termsText,
      annex_text: annexText,
      notes: c.notes,
      signed_at: c.signed_at,
      created_at: c.created_at,
    },
  };
}

/**
 * Render a built contract to HTML with the right layout: the Korean standard
 * 임대차 계약서 when that template drives the body, otherwise the generic
 * accommodation-agreement shell. Optional signatures are placed on the 날인
 * position of each party (Korean layout) or the signature block (generic).
 */
export async function renderContractHtml(
  built: { doc: ContractDocInput; lease: KoreanLeaseDocInput | null },
  forPrint: boolean,
  lang: DocLang,
  signatures?: ContractSignature[] | null,
): Promise<string> {
  const company = await resolveCompanyInfo(lang);
  if (built.lease) {
    const sealOf = (role: string) =>
      signatures?.find((s) => s.role?.toLowerCase() === role)?.signatureImage ?? null;
    return buildKoreanLeaseHtml(
      {
        ...built.lease,
        landlord: { ...built.lease.landlord, seal_image: sealOf("landlord") },
        tenant: { ...built.lease.tenant, seal_image: sealOf("tenant") },
      },
      company,
      forPrint,
      lang,
    );
  }
  return buildContractHtml(built.doc, company, forPrint, lang);
}

/** 여러 PDF 를 한 파일로 잇는다(계약서 + 첨부서류). */
async function mergePdfs(parts: Uint8Array[]): Promise<Buffer> {
  if (parts.length === 1) return Buffer.from(parts[0]);
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}

/**
 * 계약서를 PDF 로 발급한다 — 서식에 따라 렌더링 경로가 다르다.
 *
 *  - `housing_standard` : 법무부 주택임대차표준계약서. 정부 원본 PDF 를 배경으로
 *    값만 얹으므로 HTML 을 거치지 않는다(글꼴·괘선이 원본 그 자체).
 *  - `mlt_standard` : 민간임대주택 표준임대차계약서(별지 제24호서식). 등록임대
 *    사업자 법정서식이라 문구를 고칠 수 없다 — 같은 오버레이 방식, 6쪽 고정.
 *  - 그 밖 : 기존대로 HTML → 크로미움 인쇄.
 *
 * 계약 상세에서 첨부 문서를 골랐으면 그 묶음을 계약서 뒤에 이어 붙인다.
 * `renewal_refusal`(계약갱신 거절통지서)은 표준서식 원본의 [별지2]라서
 * 표준서식 경로에서는 같은 PDF 안에서 처리된다.
 */
export async function renderContractPdf(
  built: BuiltContractDoc,
  lang: DocLang,
  signatures?: ContractSignature[] | null,
): Promise<Buffer> {
  const parts: Uint8Array[] = [];

  const sealOf = (role: string) =>
    signatures?.find((s) => s.role?.toLowerCase() === role)?.signatureImage ?? null;

  if (built.leaseForm === "mlt_standard") {
    parts.push(
      await buildMltStandardLeasePdf({
        ...built.mlt,
        landlord: { ...built.mlt.landlord, seal_image: sealOf("landlord") },
        tenant: { ...built.mlt.tenant, seal_image: sealOf("tenant") },
      }),
    );
  } else if (built.leaseForm === "housing_standard") {
    parts.push(
      await buildHousingStandardLeasePdf(
        {
          ...built.housing,
          landlord: { ...built.housing.landlord, seal_image: sealOf("landlord") },
          tenant: { ...built.housing.tenant, seal_image: sealOf("tenant") },
        },
        { includeRenewalRefusal: built.attachmentKinds.includes("renewal_refusal") },
      ),
    );
  } else {
    parts.push(new Uint8Array(await htmlToPdf(await renderContractHtml(built, true, lang, signatures))));
  }

  const attachmentsHtml = buildLeaseAttachmentsHtml(
    built.attachmentKinds,
    built.attachments,
    await resolveCompanyInfo(),
  );
  if (attachmentsHtml) parts.push(new Uint8Array(await htmlToPdf(attachmentsHtml)));

  return mergePdfs(parts);
}

/**
 * Render a contract as a branded agreement document.
 *   GET /v1/contracts/:id/pdf  [?format=html]
 */
router.get("/v1/contracts/:id/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const lang = normalizeLang(req.query.lang as string);
  const built = await buildContractDocInput(id, lang);
  if (!built) { res.status(404).json({ error: "Not found" }); return; }

  // 주택임대차표준계약서는 정부 원본 PDF 오버레이라 HTML 표현이 없다 — 항상 PDF.
  const isGovForm = built.leaseForm === "housing_standard" || built.leaseForm === "mlt_standard";
  const asHtml = req.query.format === "html" && !isGovForm;
  if (asHtml) { res.type("html").send(await renderContractHtml(built, false, lang)); return; }
  try {
    const pdf = await renderContractPdf(built, lang);
    setDocumentDownloadHeaders(res, buildDocumentFilename({
      docName: t(lang, "doctype.contract"), customerName: built.doc.tenant_name,
    }));
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    console.error("[contracts] PDF generation failed:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

/** Email a contract to the tenant as a branded PDF; advances Draft → Sent. */
/**
 * Addresses offered by the send dialog for a contract: the tenant account (+its
 * contacts) first, then the landlord side as an optional extra recipient.
 */
router.get("/v1/contracts/:id/email-recipients", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const tenant = await accountRecipients(row.tenant_account_id);
  const landlord = (await accountRecipients(row.landlord_account_id)).map((r) => ({ ...r, role: "landlord" as const }));
  res.json(toRecipientsResponse([...tenant, ...landlord]));
});

router.post("/v1/contracts/:id/email", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const built = await buildContractDocInput(id, normalizeLang(req.body?.lang as string));
  if (!built) { res.status(404).json({ error: "Not found" }); return; }

  const parsed = parseRecipients(req.body?.to);
  if (parsed.invalid.length) { res.status(400).json({ error: `Invalid email address: ${parsed.invalid.join(", ")}` }); return; }
  let to = parsed.to;
  if (!to.length && built.tenantAccountId) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, built.tenantAccountId));
    to = acc?.account_email ? [acc.account_email] : [];
  }
  if (!to.length) { res.status(400).json({ error: "No recipient email — set one on the tenant account or pass { to }." }); return; }

  const lang = normalizeLang(req.body?.lang as string);
  let pdf: Buffer;
  try {
    pdf = await renderContractPdf(built, lang);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }

  const amountLabel = built.doc.total_rent != null ? formatDocMoney(built.doc.total_rent, built.doc.currency) : null;
  // Editable email copy (Templates Studio); falls back to the hardcoded note.
  const copy = await resolveDocEmailCopy("email.contract", lang, {
    ref: built.doc.contract_ref, name: built.doc.tenant_name ?? "", amount: amountLabel ?? "",
  });
  const result = await sendDocumentEmail({
    to, toName: built.doc.tenant_name, lang, docTypeLabel: t(lang, "doctype.contract"), ref: built.doc.contract_ref,
    amountLabel,
    note: copy.note ?? t(lang, "email.note.reviewAgreement"),
    subject: copy.subject,
    pdf, filename: buildDocumentFilename({ docName: t(lang, "doctype.contract"), customerName: built.doc.tenant_name }),
  });

  await db.insert(emailLogsTable).values({
    template_code: "document.contract", to_email: to.join(", "), to_name: built.doc.tenant_name ?? null,
    subject: result.subject, resend_message_id: result.id ?? null, status: result.ok ? "Sent" : "Failed",
    entity_type: "contract", entity_id: id, error_message: result.error ?? null,
  }).catch(() => {});

  if (!result.ok) { res.status(result.skipped ? 503 : 502).json({ error: result.error ?? "Send failed" }); return; }
  // Freeze an immutable snapshot of exactly what was emailed (best-effort).
  await freezeDocument({ entityType: "contract", entityId: id, docType: snapshotDocType("contract"), ref: built.doc.contract_ref, pdf }).catch(() => null);
  await db.update(contractsTable).set({ status: "Sent", sent_at: new Date(), updated_at: new Date() })
    .where(and(eq(contractsTable.id, id), eq(contractsTable.status, "Draft")));
  res.json({ ok: true, id: result.id, to });
});

/** Manually freeze the current contract PDF as an immutable versioned snapshot. */
router.post("/v1/contracts/:id/freeze", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const lang = normalizeLang(req.body?.lang as string);
  const built = await buildContractDocInput(id, lang);
  if (!built) { res.status(404).json({ error: "Not found" }); return; }
  let pdf: Buffer;
  try {
    pdf = await renderContractPdf(built, lang);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }
  const snap = await freezeDocument({ entityType: "contract", entityId: id, docType: snapshotDocType("contract"), ref: built.doc.contract_ref, pdf });
  if (!snap) { res.status(503).json({ error: "Document storage not configured" }); return; }
  res.json({ ok: true, ...snap });
});

router.put("/v1/contracts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const data = req.body;
  const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!existing) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  // Signed/Active contracts are immutable except for internal annotations —
  // editing the terms/amounts would invalidate the captured e-signature (H-201).
  const locked = existing.status === "Signed" || existing.status === "Active";
  const updates = locked
    ? {
        document_url: data.document_url ?? existing.document_url,
        notes: data.notes ?? existing.notes,
      }
    : {
        booking_id: data.booking_id ?? null,
        product_id: data.product_id ?? null,
        contract_product_id: data.contract_product_id ?? null,
        tenant_account_id: data.tenant_account_id ?? null,
        landlord_account_id: data.landlord_account_id ?? null,
        space_id: data.space_id ?? null,
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        weekly_rate: data.weekly_rate ?? null,
        total_rent: data.total_rent ?? null,
        bond_amount: data.bond_amount ?? null,
        monthly_rent: data.monthly_rent ?? null,
        advance_amount: data.advance_amount ?? null,
        contract_category: data.contract_category ?? null,
        lease_form: data.lease_form ?? null,
        doc_attachments: normalizeAttachmentsInput(data.doc_attachments),
        ...mltLeaseFields(data),
        down_payment: data.down_payment ?? null,
        down_payment_date: data.down_payment_date ?? null,
        balance_amount: data.balance_amount ?? null,
        balance_date: data.balance_date ?? null,
        rent_due_day: data.rent_due_day ?? null,
        currency: data.currency ?? DEFAULT_CURRENCY,
        document_url: data.document_url ?? null,
        terms_text: data.terms_text ?? null,
        notes: data.notes ?? null,
      };
  const [row] = await db.update(contractsTable).set(updates).where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrichContracts([row]);
  res.json(result);
});

const contractsSoftDelete = {
  table: contractsTable,
  idColumn: contractsTable.id,
};
router.post("/v1/contracts/bulk-delete", makeBulkDelete(contractsSoftDelete));
router.post("/v1/contracts/bulk-restore", makeBulkRestore(contractsSoftDelete));

router.delete("/v1/contracts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(contractsTable).where(eq(contractsTable.id, id));
  } else {
    await db.update(contractsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(contractsTable.id, id));
  }
  res.status(204).send();
});

router.post("/v1/contracts/:id/send", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(contractsTable)
    .set({ status: "Sent", sent_at: new Date() })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Sent" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.post("/v1/contracts/:id/sign", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { document_url } = req.body ?? {};
  const [row] = await db.update(contractsTable)
    .set({ status: "Signed", signed_at: new Date(), document_url: document_url ?? null })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Signed" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

/**
 * Issue an e-signature request for a contract. Creates a contract_signing_requests
 * row (context_type="contract") with the tenant (required) and landlord (optional)
 * as signers, and returns the public signing token + URL. The tenant signs at
 * /sign/:token; on signing the contract advances Draft/Sent → Signed and a signed
 * PDF is generated + emailed (see contract-signing.ts / applicationDocs.ts).
 */
router.post("/v1/contracts/:id/issue-signing", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const signers: SignerSpec[] = [];
  if (contract.tenant_account_id) {
    const [tenant] = await db.select().from(accountsTable).where(eq(accountsTable.id, contract.tenant_account_id));
    if (tenant?.account_email) signers.push({ role: "tenant", name: tenant.name ?? "Tenant", email: tenant.account_email, required: true });
  }
  if (contract.landlord_account_id) {
    const [landlord] = await db.select().from(accountsTable).where(eq(accountsTable.id, contract.landlord_account_id));
    if (landlord?.account_email) signers.push({ role: "landlord", name: landlord.name ?? "Landlord", email: landlord.account_email, required: false });
  }
  if (!signers.some((s) => s.required)) {
    res.status(400).json({ error: "The tenant account needs an email address before a signing request can be issued." });
    return;
  }

  const result = await createSigningRequest({
    contextType: "contract", contextId: id, signers,
    expiryDays: req.body?.expiry_days ? Number(req.body.expiry_days) : undefined,
  });
  await logAction({
    entityType: "contract", entityId: id, action: "CREATE",
    newValue: { issued_signing_request_id: result.id, signers: signers.map((s) => ({ role: s.role, email: s.email })) },
  }).catch(() => {});
  res.status(201).json({ id: result.id, token: result.token, signing_url: result.signingUrl, expires_at: result.expiresAt });
});

router.post("/v1/contracts/:id/activate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!existing) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  // Generate invoices + payment schedules FIRST, then flip the status. If
  // generation throws, the contract is left in its prior (pre-Active) status so
  // a retry re-runs cleanly — never a half-activated "Active but no invoices"
  // record. mode="incremental" creates a cron-billed schedule instead of
  // pre-generating the whole term up front.
  const billingMode = req.body?.mode === "incremental" ? "incremental" : "upfront";
  let generated: { invoices: number; schedules: number };
  try {
    generated = await generateContractInvoicesAndSchedules(id, billingMode);
  } catch (err) {
    console.error("[contracts] activate: invoice generation failed:", err);
    res.status(500).json({ error: "INVOICE_GENERATION_FAILED", message: "Contract left un-activated; safe to retry." });
    return;
  }

  const [row] = await db.update(contractsTable)
    .set({ status: "Active", effective_date: new Date().toISOString().slice(0, 10) })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  // Also set linked booking to Active
  if (row.booking_id) {
    await db.update(bookingsTable)
      .set({ booking_status: "Active" })
      .where(eq(bookingsTable.id, row.booking_id));
  }

  await logAction({
    entityType: "contract", entityId: id, action: "STATUS_CHANGE",
    newValue: { status: "Active", invoices_generated: generated.invoices, schedules_generated: generated.schedules },
  });
  const [result] = await enrichContracts([row]);
  res.json({ ...result, _generated: generated });
});

router.post("/v1/contracts/:id/terminate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { termination_reason } = req.body;
  const [row] = await db.update(contractsTable)
    .set({ status: "Terminated", termination_reason })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Terminated", termination_reason } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.post("/v1/contracts/:id/expire", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(contractsTable)
    .set({ status: "Expired", expiry_date: new Date().toISOString().slice(0, 10) })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Expired" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

// GET /contracts/:id/payment-schedule — recurring schedules for this contract
router.get("/v1/contracts/:id/payment-schedule", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const schedules = await db.select().from(recurringSchedulesTable).where(eq(recurringSchedulesTable.contract_id, id));
  res.json({ data: schedules, meta: { total: schedules.length } });
});

// POST /contracts/:id/payment-schedule — add a new schedule entry
router.post("/v1/contracts/:id/payment-schedule", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!contract) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const { schedule_type, frequency, amount, currency, start_date, end_date, next_due_date, is_active, gst_included, billing_mode } = req.body;
  const [row] = await db.insert(recurringSchedulesTable).values({
    booking_id: contract.booking_id ?? 0,
    contract_id: contractId,
    account_id: contract.tenant_account_id ?? 0,
    schedule_type: schedule_type ?? "Rent",
    frequency: frequency ?? "Biweekly",
    amount: String(amount ?? "0"),
    currency: currency ?? DEFAULT_CURRENCY,
    start_date: start_date,
    end_date: end_date ?? null,
    next_due_date: next_due_date ?? start_date,
    billing_mode: billing_mode === "incremental" ? "incremental" : null,
    is_active: is_active !== false,
    gst_included: gst_included !== false,
  }).returning();
  await logAction({ entityType: "contract", entityId: contractId, action: "SCHEDULE_ADD", newValue: row });
  res.status(201).json(row);
});

// PATCH /contracts/:id/payment-schedule/:schedId — update a schedule entry
router.patch("/v1/contracts/:id/payment-schedule/:schedId", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  const schedId = Number(req.params.schedId);
  const { schedule_type, frequency, amount, currency, start_date, end_date, next_due_date, is_active, gst_included, billing_mode } = req.body;
  const updates: Record<string, any> = { updated_at: new Date() };
  if (billing_mode !== undefined) updates.billing_mode = billing_mode === "incremental" ? "incremental" : null;
  if (schedule_type !== undefined) updates.schedule_type = schedule_type;
  if (frequency !== undefined) updates.frequency = frequency;
  if (amount !== undefined) updates.amount = String(amount);
  if (currency !== undefined) updates.currency = currency;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (next_due_date !== undefined) updates.next_due_date = next_due_date;
  if (is_active !== undefined) updates.is_active = is_active;
  if (gst_included !== undefined) updates.gst_included = gst_included;
  const [row] = await db.update(recurringSchedulesTable).set(updates)
    .where(and(eq(recurringSchedulesTable.id, schedId), eq(recurringSchedulesTable.contract_id, contractId)))
    .returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: contractId, action: "SCHEDULE_UPDATE", newValue: row });
  res.json(row);
});

// DELETE /contracts/:id/payment-schedule/:schedId — remove a schedule entry
router.delete("/v1/contracts/:id/payment-schedule/:schedId", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  const schedId = Number(req.params.schedId);
  const [row] = await db.delete(recurringSchedulesTable)
    .where(and(eq(recurringSchedulesTable.id, schedId), eq(recurringSchedulesTable.contract_id, contractId)))
    .returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: contractId, action: "SCHEDULE_DELETE", newValue: { id: schedId } });
  res.status(204).end();
});

// GET /contracts/:id/services — booking services linked via the booking
router.get("/v1/contracts/:id/services", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [contract] = await db.select({ booking_id: contractsTable.booking_id }).from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract?.booking_id) { res.json({ data: [], meta: { total: 0 } }); return; }
  const rows = await db.select().from(bookingServicesTable)
    .where(and(eq(bookingServicesTable.booking_id, contract.booking_id), eq(bookingServicesTable.status, "Active")));
  res.json({ data: rows, meta: { total: rows.length } });
});

// ─── Contract Line Items CRUD ─────────────────────────────────────────────────

router.get("/v1/contracts/:id/line-items", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(contractLineItemsTable)
    .where(and(eq(contractLineItemsTable.contract_id, id), eq(contractLineItemsTable.status, "Active")))
    .orderBy(contractLineItemsTable.id);
  res.json({ data: rows, meta: { total: rows.length } });
});

router.post("/v1/contracts/:id/line-items", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { item_type, name, billing_trigger, billing_frequency, unit_price, quantity, currency, gst_included, service_id, notes } = req.body;
  if (!name || !item_type) { res.status(400).json({ success: false, error: { message: "name and item_type are required" } }); return; }
  const qty = Number(quantity ?? 1);
  const price = parseFloat(unit_price ?? 0);
  const total = parseFloat((price * qty).toFixed(2));
  const [row] = await db.insert(contractLineItemsTable).values({
    contract_id: id,
    item_type: item_type ?? "Service",
    name,
    billing_trigger: billing_trigger ?? "at_activation",
    billing_frequency: billing_frequency ?? null,
    unit_price: String(price),
    quantity: qty,
    total_price: String(total),
    currency: currency ?? DEFAULT_CURRENCY,
    gst_included: gst_included ?? true,
    service_id: service_id ?? null,
    notes: notes ?? null,
    status: "Active",
  }).returning();
  res.json(row);
});

router.patch("/v1/contracts/:id/line-items/:lineId", async (req, res): Promise<void> => {
  const lineId = Number(req.params.lineId);
  const { item_type, name, billing_trigger, billing_frequency, unit_price, quantity, currency, gst_included, notes } = req.body;
  const qty = Number(quantity ?? 1);
  const price = parseFloat(unit_price ?? 0);
  const total = parseFloat((price * qty).toFixed(2));
  const [row] = await db.update(contractLineItemsTable).set({
    ...(item_type !== undefined && { item_type }),
    ...(name !== undefined && { name }),
    ...(billing_trigger !== undefined && { billing_trigger }),
    ...(billing_frequency !== undefined && { billing_frequency }),
    ...(unit_price !== undefined && { unit_price: String(price), total_price: String(total), quantity: qty }),
    ...(currency !== undefined && { currency }),
    ...(gst_included !== undefined && { gst_included }),
    ...(notes !== undefined && { notes }),
    updated_at: new Date(),
  }).where(eq(contractLineItemsTable.id, lineId)).returning();
  if (!row) { res.status(404).json({ success: false, error: { message: "Line item not found" } }); return; }
  res.json(row);
});

router.delete("/v1/contracts/:id/line-items/:lineId", async (req, res): Promise<void> => {
  const lineId = Number(req.params.lineId);
  await db.update(contractLineItemsTable).set({ status: "Deleted", updated_at: new Date() }).where(eq(contractLineItemsTable.id, lineId));
  res.json({ success: true });
});

// ─── Contract Related Costs CRUD ──────────────────────────────────────────────
// Optional one-off costs (입주청소 / 임대수수료 / 부동산 수수료 …). 0..N per contract.

router.get("/v1/contracts/:id/related-costs", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(contractRelatedCostsTable)
    .where(and(eq(contractRelatedCostsTable.contract_id, id), eq(contractRelatedCostsTable.status, "Active")))
    .orderBy(contractRelatedCostsTable.id);
  res.json({ data: rows, meta: { total: rows.length } });
});

router.post("/v1/contracts/:id/related-costs", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { cost_type, remitted_on, payee_name, amount, currency, note } = req.body;
  if (!cost_type || !remitted_on || !payee_name || amount == null) {
    res.status(400).json({ success: false, error: { message: "cost_type, remitted_on, payee_name and amount are required" } });
    return;
  }
  const [row] = await db.insert(contractRelatedCostsTable).values({
    contract_id: id,
    cost_type,
    remitted_on,
    payee_name,
    amount: Number(amount),
    currency: currency ?? DEFAULT_CURRENCY,
    note: note ?? "",
    status: "Active",
  }).returning();
  res.json(row);
});

router.patch("/v1/contracts/:id/related-costs/:costId", async (req, res): Promise<void> => {
  const costId = Number(req.params.costId);
  const { cost_type, remitted_on, payee_name, amount, currency, note } = req.body;
  const [row] = await db.update(contractRelatedCostsTable).set({
    ...(cost_type !== undefined && { cost_type }),
    ...(remitted_on !== undefined && { remitted_on }),
    ...(payee_name !== undefined && { payee_name }),
    ...(amount !== undefined && { amount: Number(amount) }),
    ...(currency !== undefined && { currency }),
    ...(note !== undefined && { note }),
    updated_at: new Date(),
  }).where(eq(contractRelatedCostsTable.id, costId)).returning();
  if (!row) { res.status(404).json({ success: false, error: { message: "Related cost not found" } }); return; }
  res.json(row);
});

router.delete("/v1/contracts/:id/related-costs/:costId", async (req, res): Promise<void> => {
  const costId = Number(req.params.costId);
  await db.update(contractRelatedCostsTable).set({ status: "Deleted", updated_at: new Date() }).where(eq(contractRelatedCostsTable.id, costId));
  res.json({ success: true });
});

/**
 * Generate the monthly rent invoices for a given month across every Active lease
 * (the 잔여월 자동 발행 button). Runs the same idempotent generator as the daily
 * cron, but forced — so an admin can fill in a month without waiting for 03:00.
 */
router.post("/v1/contracts/generate-rent-invoices", async (req, res): Promise<void> => {
  const { year, month, months } = req.body ?? {};
  const targets: Array<{ year: number; month: number }> = Array.isArray(months)
    ? months.filter((m: any) => m?.year && m?.month)
    : [{ year: Number(year) || new Date().getFullYear(), month: Number(month) || new Date().getMonth() + 1 }];
  let created = 0, overdue = 0, skipped = 0;
  for (const target of targets) {
    const r = await generateLeaseRentInvoices({ year: target.year, month: target.month, force: true });
    created += r.created; overdue = r.overdue; skipped += r.skipped;
  }
  await logAction({ entityType: "invoice", entityId: 0, action: "AUTO_CREATED", newValue: { kind: "lease_rent", targets, created, skipped } });
  res.json({ created, skipped, overdue, months: targets });
});

router.get("/v1/lookup/contracts", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [ilike(contractsTable.contract_ref, `%${q}%`)] : [];
  const rows = await db.select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref, status: contractsTable.status })
    .from(contractsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(contractsTable.id)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.contract_ref} (${r.status})` })));
});

export default router;
