import { Router, type IRouter } from "express";
import { ilike, and, eq, isNull, SQL, asc } from "drizzle-orm";
import { keywordCondition, columnMatches } from "../lib/listSearch";
import { db, contactsTable, accountsTable, commissionsTable, paymentInfoTable, spacesTable, suburbsTable, propertiesTable, accommodationCatalogTable, productGroupsTable, productTypesTable, contractTypesTable, usersTable } from "@workspace/db";

import { formatPersonName, formatPersonLabel } from "../lib/nameFormat";
import { productRates } from "../lib/productRates";
import { formatDocMoney } from "../lib/documents/theme";

const router: IRouter = Router();

router.get("/v1/lookup/contacts", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const conditions: SQL[] = [];
  if (q) {
    conditions.push(keywordCondition(
      q,
      [contactsTable.email, contactsTable.mobile_number, contactsTable.company_name],
      [],
      [{ first: contactsTable.first_name, last: contactsTable.last_name }],
    ));
  }
  const rows = await db.select({
    id: contactsTable.id,
    first_name: contactsTable.first_name,
    last_name: contactsTable.last_name,
    email: contactsTable.email,
    mobile_number: contactsTable.mobile_number,
  }).from(contactsTable)
    .where(conditions.length ? conditions[0] : undefined)
    .limit(20);
  // A person is labelled 임경임_010-5252-5232 platform-wide (see formatPersonLabel).
  // The email trails it only when there is one — KR lease tenants often have none.
  res.json(rows.map((r) => ({
    id: r.id,
    display: [formatPersonLabel(r.first_name, r.last_name, r.mobile_number), r.email]
      .filter(Boolean).join(" — "),
    name: formatPersonName(r.first_name, r.last_name),
    email: r.email,
    mobile_number: r.mobile_number,
  })));
});

router.get("/v1/lookup/accounts", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const type = (req.query["type"] as string) || "";
  const conditions: SQL[] = [];
  if (type) conditions.push(eq(accountsTable.account_type, type));
  if (q) {
    const { or } = await import("drizzle-orm");
    conditions.push(or(
      columnMatches(accountsTable.name, q),
      columnMatches(accountsTable.account_email, q),
      columnMatches(accountsTable.biz_registration_no, q),
    )!);
  }
  const rows = await db.select({
    id: accountsTable.id,
    name: accountsTable.name,
    account_type: accountsTable.account_type,
  }).from(accountsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(20);
  // `display` stays for callers that render the string as-is; `name` and
  // `account_type` ship alongside it so the admin can build a localised label
  // (the API has no admin i18n, so "(Tenant)" would otherwise leak into a
  // Korean UI — see AccountLookupSelect).
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.name} (${r.account_type})`,
    name: r.name,
    account_type: r.account_type,
  })));
});

// Admin (ops staff) users — for assignment pickers. Active, non-deleted only.
router.get("/v1/lookup/admin-users", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const conditions: SQL[] = [
    isNull(usersTable.deleted_at),
    eq(usersTable.is_active, true),
  ];
  if (q) {
    conditions.push(keywordCondition(
      q,
      [usersTable.email],
      [],
      [{ first: usersTable.first_name, last: usersTable.last_name }],
    ));
  }
  const rows = await db.select({
    id: usersTable.id,
    first_name: usersTable.first_name,
    last_name: usersTable.last_name,
    email: usersTable.email,
  }).from(usersTable)
    .where(and(...conditions))
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${formatPersonName(r.first_name, r.last_name)} (${r.email})`,
  })));
});

router.get("/v1/lookup/commissions", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db.select({
    id: commissionsTable.id,
    name: commissionsTable.name,
    commission_type: commissionsTable.commission_type,
    commission_rate: commissionsTable.commission_rate,
    commission_amount: commissionsTable.commission_amount,
  }).from(commissionsTable)
    .where(q ? columnMatches(commissionsTable.name, q) : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: r.commission_type === "Percentage"
      ? `${r.name} (${r.commission_rate}%)`
      : `${r.name} ($${r.commission_amount})`,
  })));
});

router.get("/v1/lookup/payment-info", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db.select({
    id: paymentInfoTable.id,
    name: paymentInfoTable.name,
    payment_type: paymentInfoTable.payment_type,
    bsb_number: paymentInfoTable.bsb_number,
    bank_name: paymentInfoTable.bank_name,
    account_number: paymentInfoTable.account_number,
    account_name: paymentInfoTable.account_name,
    default_for_lease_form: paymentInfoTable.default_for_lease_form,
  }).from(paymentInfoTable)
    .where(q ? columnMatches(paymentInfoTable.name, q) : undefined)
    .limit(20);
  // 계좌를 고르는 화면(인보이스 입금 계좌 등)에서는 계좌번호까지 보여야 어느
  // 계좌인지 구분된다. BSB는 호주 계좌에만 있으므로 있을 때만 덧붙인다.
  res.json(rows.map((r) => {
    const parts = [r.bank_name, r.bsb_number ? `BSB ${r.bsb_number}` : null, r.account_number].filter(Boolean);
    const display = parts.length
      ? `${parts.join(" ")}${r.account_name ? ` (${r.account_name})` : ""}`
      : `${r.name} (${r.payment_type})`;
    return { id: r.id, display, default_for_lease_form: r.default_for_lease_form };
  }));
});

router.get("/v1/lookup/spaces", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const property_id = req.query["property_id"] ? parseInt(req.query["property_id"] as string, 10) : null;
  const conditions: SQL[] = [];
  if (property_id) conditions.push(eq(spacesTable.property_id, property_id));
  if (q) conditions.push(keywordCondition(q, [spacesTable.name, spacesTable.custom_type_name]));

  const rows = await db.select({
    id: spacesTable.id,
    name: spacesTable.name,
    space_type: spacesTable.space_type,
    property_address: propertiesTable.address,
    base_weekly_price: spacesTable.base_weekly_price,
  })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(20);

  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.name} (${r.space_type}) — ${r.property_address ?? ""}`,
    base_weekly_price: r.base_weekly_price,
  })));
});

router.get("/v1/lookup/suburbs", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db.select({
    id: suburbsTable.id,
    name: suburbsTable.name,
    state: suburbsTable.state,
    postcode: suburbsTable.postcode,
  }).from(suburbsTable)
    .where(q ? keywordCondition(q, [suburbsTable.name, suburbsTable.area_name, suburbsTable.postcode]) : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.name} ${r.state ?? ""} ${r.postcode ?? ""}`.trim(),
  })));
});

router.get("/v1/lookup/product-groups", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: productGroupsTable.id, name: productGroupsTable.name })
    .from(productGroupsTable)
    .where(q ? columnMatches(productGroupsTable.name, q) : undefined)
    .orderBy(asc(productGroupsTable.name))
    .limit(50);
  res.json(rows.map(r => ({ id: r.id, display: r.name })));
});

router.get("/v1/lookup/product-types", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: productTypesTable.id, name: productTypesTable.name })
    .from(productTypesTable)
    .where(q ? columnMatches(productTypesTable.name, q) : undefined)
    .orderBy(asc(productTypesTable.name))
    .limit(50);
  res.json(rows.map(r => ({ id: r.id, display: r.name })));
});

router.get("/v1/lookup/products", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({
      id: accommodationCatalogTable.id,
      name: accommodationCatalogTable.name,
      item_description: accommodationCatalogTable.item_description,
      product_tag: accommodationCatalogTable.product_tag,
      price: accommodationCatalogTable.price,
      weekly_rate: accommodationCatalogTable.weekly_rate,
      currency: accommodationCatalogTable.currency,
      billing_frequency: accommodationCatalogTable.billing_frequency,
      deposit_amount: accommodationCatalogTable.deposit_amount,
      // 같은 이름의 요금표 행(여러 "보증금 1000만원")은 붙어 있는 세대/타입과
      // 계약 조건으로만 구별된다 — 선택 팝업이 그 정보를 다 보여주도록 함께 내려보낸다.
      room_type: accommodationCatalogTable.room_type,
      contract_term: accommodationCatalogTable.contract_term,
      min_contract_period: accommodationCatalogTable.min_contract_period,
      min_contract_period_unit: accommodationCatalogTable.min_contract_period_unit,
      status: accommodationCatalogTable.status,
      space_id: accommodationCatalogTable.space_id,
      space_name: spacesTable.name,
      space_type: spacesTable.custom_type_name,
    })
    .from(accommodationCatalogTable)
    .leftJoin(spacesTable, eq(spacesTable.id, accommodationCatalogTable.space_id))
    .where(q ? keywordCondition(q, [accommodationCatalogTable.name, accommodationCatalogTable.product_tag, spacesTable.name]) : undefined)
    .orderBy(asc(accommodationCatalogTable.name))
    .limit(20);
  // The price is quoted in the product's OWN currency (a KRW rate card must not
  // render as "$583333"), and in the unit it was entered in — `rates` ships the
  // whole 일일/주간/월간 card so the caller can label it however it likes.
  res.json(rows.map(r => {
    const rates = productRates(r);
    const amount = rates[rates.base_unit];
    const unit = { daily: "일", weekly: "주", monthly: "월" }[rates.base_unit];
    return {
      id: r.id,
      display: [
        `${r.name}${amount != null ? ` — ${formatDocMoney(amount, rates.currency)}/${unit}` : ""}`,
        r.space_name,
      ].filter(Boolean).join(" · "),
      name: r.name,
      item_description: r.item_description,
      product_tag: r.product_tag,
      deposit_amount: r.deposit_amount,
      room_type: r.room_type,
      contract_term: r.contract_term,
      min_contract_period: r.min_contract_period,
      min_contract_period_unit: r.min_contract_period_unit,
      status: r.status,
      space_id: r.space_id,
      space_name: r.space_name,
      space_type: r.space_type,
      rates,
    };
  }));
});

router.get("/v1/lookup/contract-types", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: contractTypesTable.id, name: contractTypesTable.name })
    .from(contractTypesTable)
    .where(q ? columnMatches(contractTypesTable.name, q) : undefined)
    .orderBy(asc(contractTypesTable.name))
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: r.name })));
});

export default router;
