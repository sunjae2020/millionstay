import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// 회계기간 마감 (ACCOUNTING_PERIODS) — FIN-001 제6·7조.
//
// 규정이 세 구간을 나눠 두었고, 그 셋이 그대로 status 다.
//
//   open    해당 월 마감 전. 실제 지출일을 거래일자로 자유롭게 입력한다.
//   closed  월 마감됨. 마감을 해제해야 그 달 날짜로 입력·수정할 수 있고,
//           해제 사실이 이 행에 남는다(reopened_at / reopen_reason).
//   locked  부가가치세 신고 완료 또는 결산 확정. **되돌릴 수 없다.**
//           이후 발견된 누락은 당월 비용으로 처리하고, 중요한 오류는 수정신고로 정정한다.
//
// 행이 없는 달은 open 으로 본다 — 마감은 명시적 행위이지 기본값이 아니다.
// 그래야 이 기능을 켜기 전에 쌓인 거래가 소급해서 막히지 않는다.
//
// "거래일자를 지출일로 소급 입력하는 것"은 발생주의에 따른 정상 처리다. 문제가
// 되는 것은 소급 자체가 아니라 **이력이 남지 않는 사후 변경**이므로, 여기서
// 막는 것은 오직 마감된 기간뿐이고 입력일시(created_at)는 늘 따로 남는다.
// ─────────────────────────────────────────────────────────────────────────────
export const accountingPeriodsTable = pgTable("accounting_periods", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12

  // open | closed | locked
  status: text("status").notNull().default("open"),

  closed_at: timestamp("closed_at", { withTimezone: true }),
  closed_by: integer("closed_by"),
  // 마감 해제 이력. 다시 마감하면 closed_at 이 갱신되지만 해제 사실은 남는다.
  reopened_at: timestamp("reopened_at", { withTimezone: true }),
  reopened_by: integer("reopened_by"),
  reopen_reason: text("reopen_reason"),
  // 부가세 신고·결산 확정 시각. 차면 되돌릴 수 없다.
  locked_at: timestamp("locked_at", { withTimezone: true }),
  locked_by: integer("locked_by"),
  note: text("note"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  yearMonth: unique("accounting_periods_year_month_key").on(t.year, t.month),
}));

export const PERIOD_STATUSES = ["open", "closed", "locked"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export type AccountingPeriod = typeof accountingPeriodsTable.$inferSelect;
export type InsertAccountingPeriod = typeof accountingPeriodsTable.$inferInsert;
