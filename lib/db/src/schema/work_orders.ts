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
  uploaded_by_type: text("uploaded_by_type").notNull().default("admin"), // admin | partner
  caption: text("caption"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
