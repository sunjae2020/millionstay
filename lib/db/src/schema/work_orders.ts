import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const workOrdersTable = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  order_ref: text("order_ref").notNull().unique(),
  property_id: integer("property_id"),
  space_id: integer("space_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("Open"),
  priority: text("priority").notNull().default("Normal"),
  category: text("category"),
  assigned_contact_id: integer("assigned_contact_id"),
  // ── Partner auto-dispatch + SLA (Phase 3) ──────────────────────────────────
  // The dispatched partner (service_hosts.id) — distinct from assigned_contact_id
  // (an individual contact). Auto-matched from category → service_host specialty.
  service_host_id: integer("service_host_id"),
  dispatched_at: timestamp("dispatched_at", { withTimezone: true }),
  acknowledged_at: timestamp("acknowledged_at", { withTimezone: true }),
  // Deadline for the partner to acknowledge the dispatch. The SLA cron flags
  // breaches. sla_status: pending_ack | acknowledged | met | breached | escalated
  sla_ack_due_at: timestamp("sla_ack_due_at", { withTimezone: true }),
  sla_status: text("sla_status"),
  reported_at: text("reported_at"),
  scheduled_at: text("scheduled_at"),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  cost: numeric("cost", { precision: 12, scale: 2, mode: "number" }),
  currency: text("currency").notNull().default("AUD"),
  // ── 청소/하자 원장 (Korean 퇴거청소·입주청소·하자보수 LIST) ────────────────
  // A job happens to a *space*; the tenancy it belongs to is a reference, not a
  // requirement — work done while the unit is vacant has no contract.
  contract_id: integer("contract_id"),
  // 작업비용(cost) is the vendor's gross claim. Korean 원천징수 3.3% is withheld,
  // so net_cost is what is actually remitted to the vendor — and what the
  // 청구 명세서 bills.
  net_cost: numeric("net_cost", { precision: 12, scale: 2, mode: "number" }),
  withholding_amount: numeric("withholding_amount", { precision: 12, scale: 2, mode: "number" }),
  // The job is recharged to the *outgoing tenant*, settled at move-out — either
  // paid directly or taken out of the deposit. billed_on = 청구일,
  // settled_on = 수령일자 (null while outstanding — the sheet's '청구' state).
  billed_on: text("billed_on"),
  settled_on: text("settled_on"),
  // How the tenant settles it: tenant_payment (퇴거 시 납부) | deposit_deduction
  // (보증금 차감). Null = not decided yet.
  settlement_method: text("settlement_method"),
  // Who bears the cost: tenant (default — including 입주청소, which the departing
  // tenant pays) | landlord | company.
  charged_to: text("charged_to").notNull().default("tenant"),
  // ── 방문 약속 (인스펙션·현장 방문) ──────────────────────────────────────────
  // `scheduled_at` above is a legacy date-only text column (kept for compat).
  // A real appointment needs a start AND an end instant, so the calendar can lay
  // it out and the .ics can carry a duration. Both are timestamptz.
  scheduled_start_at: timestamp("scheduled_start_at", { withTimezone: true }),
  scheduled_end_at: timestamp("scheduled_end_at", { withTimezone: true }),
  // Internal staff owner of the visit (users.id) — distinct from
  // assigned_contact_id (an external individual) and service_host_id (a partner).
  assigned_user_id: integer("assigned_user_id"),
  // Who meets us on site (usually the tenant): contacts.id.
  attendee_contact_id: integer("attendee_contact_id"),
  // Meeting point / parking / building entrance notes.
  location_note: text("location_note"),
  // How we get in: vacant_key | tenant_present | lockbox | agent | other
  access_method: text("access_method"),
  // Inspection sub-type when category='inspection':
  // move_in | move_out | routine | pre_listing | defect_check
  inspection_type: text("inspection_type"),
  // The 세대점검표 produced by this visit (condition_reports.id), if any.
  condition_report_id: integer("condition_report_id"),
  // Last time the appointment-confirmation email (+ .ics) went out.
  confirmation_sent_at: timestamp("confirmation_sent_at", { withTimezone: true }),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Photos attached to a work order — a repair request's "before" evidence and the
// partner's "after"/confirmation photos. (CS ticket messages carry their own
// images; this is the work-order-native slot that repairs previously lacked.)
export const workOrderPhotosTable = pgTable("work_order_photos", {
  id: serial("id").primaryKey(),
  work_order_id: integer("work_order_id").notNull(), // work_orders.id
  url: text("url").notNull(),
  kind: text("kind").notNull().default("after"), // before | after
  // 회차(세션) — 한 번의 업로드가 하나의 세션이다. 같은 세대를 두 번 방문해
  // 작업 전 사진을 두 번 찍으면 before 1차 / before 2차로 남는다. 번호는
  // (work_order_id, kind) 안에서 1부터 올라간다.
  session_no: integer("session_no").notNull().default(1),
  uploaded_by_type: text("uploaded_by_type").notNull().default("admin"), // admin | partner
  caption: text("caption"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
