import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// 자산대장 (FIXED_ASSETS) — FIN-001 제11조 제2·4항, 제9조.
//
// 취득가액이 거래단위 100만원을 넘고 내용연수가 1년 이상인 물품은 비용이 아니라
// 자산이다. 규정은 "자산대장에 등록하고 관리 책임자와 설치 장소를 기재한다"고만
// 하는데, 실무에서 이 대장이 없으면 감가상각이 통째로 누락되거나 반대로 이미
// 비용 처리한 것을 또 상각하게 된다.
//
// 그래서 **원천 거래(source_transaction_id)를 반드시 물고 태어난다.** 지출결의가
// 승인될 때 자동으로 초안 행이 만들어지고, 사람이 내용연수·설치 장소·관리
// 책임자를 채워 확정한다. 거래 없이 손으로 만든 자산은 어디서 왔는지 알 수 없다.
//
// 감가상각은 이 표에 전기하지 않는다 — 장부가액은 취득원가·내용연수·기준일에서
// 계산되는 파생값이고, 저장해 두면 기준일이 바뀔 때마다 두 값이 갈라진다.
// (lib/billing/fixedAssets.ts 의 depreciationAsOf() 가 읽는 시점에 계산한다.)
// ─────────────────────────────────────────────────────────────────────────────
export const fixedAssetsTable = pgTable("fixed_assets", {
  id: serial("id").primaryKey(),
  // 자산번호 FA-YYYY-00001.
  asset_no: text("asset_no").notNull().unique(),
  name: text("name").notNull(),

  // 자산 계정과목(chart_of_accounts.code) — 212 비품 / 202 건물 등.
  account_code: text("account_code"),

  acquired_on: text("acquired_on").notNull(), // YYYY-MM-DD
  // 취득원가(부가세 제외). numeric → Drizzle 에서 문자열이다.
  acquisition_cost: numeric("acquisition_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("KRW"),
  // 잔존가액. 한국 세무 실무는 통상 0(비품 1,000원 관행은 쓰지 않는다).
  residual_value: numeric("residual_value", { precision: 14, scale: 2 }).notNull().default("0"),
  // 내용연수(년). 비품 기본 5년.
  useful_life_years: integer("useful_life_years").notNull().default(5),
  // straight_line | declining_balance — 현재 계산기는 정액법만 구현한다.
  depreciation_method: text("depreciation_method").notNull().default("straight_line"),

  // 어디에 놓였고 누가 관리하는가(제11조 제4항).
  space_id: integer("space_id"),
  property_id: integer("property_id"),
  custodian_user_id: integer("custodian_user_id"),
  location_note: text("location_note"),

  // 이 자산을 만든 지출 거래. 자동 생성된 행은 반드시 찬다.
  source_transaction_id: integer("source_transaction_id"),

  // draft | active | disposed
  status: text("status").notNull().default("draft"),
  disposed_on: text("disposed_on"),
  disposal_note: text("disposal_note"),

  notes: text("notes"),
  created_by: integer("created_by"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const ASSET_STATUSES = ["draft", "active", "disposed"] as const;
export const DEPRECIATION_METHODS = ["straight_line", "declining_balance"] as const;

export type FixedAsset = typeof fixedAssetsTable.$inferSelect;
export type InsertFixedAsset = typeof fixedAssetsTable.$inferInsert;
