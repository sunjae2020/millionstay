import { Router } from "express";
import { db, recurringSchedulesTable, invoicesTable, bookingsTable, accountsTable } from "@workspace/db";
import { eq, and, lte, ilike, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { getRateToAud } from "../lib/rateSnapshot";

const router = Router();

const CreateRecurringScheduleBody = z.object({
  booking_id: z.number().int().positive(),
  contract_id: z.number().int().optional().nullable(),
  account_id: z.number().int().positive(),
  schedule_type: z.enum(["Rent", "ServiceFee", "AdminFee"]).default("Rent"),
  frequency: z.enum(["Weekly", "Biweekly", "Monthly"]).default("Biweekly"),
  amount: z.string().min(1),
  currency: z.string().default("AUD"),
  gst_included: z.boolean().default(true),
  start_date: z.string().min(1),
  end_date: z.string().optional().nullable(),
  next_due_date: z.string().min(1),
});

const UpdateRecurringScheduleBody = CreateRecurringScheduleBody.partial();

async function enrichSchedules(rows: (typeof recurringSchedulesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const result = [];
  for (const row of rows) {
    const [booking] = await db.select({ booking_ref: bookingsTable.booking_ref })
      .from(bookingsTable).where(eq(bookingsTable.id, row.booking_id));
    const [account] = await db.select({ name: accountsTable.name })
      .from(accountsTable).where(eq(accountsTable.id, row.account_id));
    result.push({
      ...row,
      booking_ref: booking?.booking_ref ?? null,
      account_name: account?.name ?? null,
    });
  }
  return result;
}

async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  const count = rows.length + 1;
  return `MS-INV-${year}-${String(count).padStart(5, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function nextDueDateFromFrequency(current: string, frequency: string): string {
  if (frequency === "Weekly") return addDays(current, 7);
  if (frequency === "Biweekly") return addDays(current, 14);
  if (frequency === "Monthly") return addMonths(current, 1);
  return addDays(current, 14);
}

router.get("/v1/recurring-schedules", async (req, res): Promise<void> => {
  const { booking_id, is_active, next_due_date_from, next_due_date_to } = req.query as Record<string, string>;
  const conditions: any[] = [isNull(recurringSchedulesTable.deleted_at)];
  if (booking_id) conditions.push(eq(recurringSchedulesTable.booking_id, Number(booking_id)));
  if (is_active !== undefined) conditions.push(eq(recurringSchedulesTable.is_active, is_active === "true"));
  if (next_due_date_from) conditions.push(lte(recurringSchedulesTable.next_due_date, next_due_date_to ?? next_due_date_from));
  const rows = await db.select().from(recurringSchedulesTable)
    .where(and(...conditions))
    .orderBy(recurringSchedulesTable.id);
  const result = await enrichSchedules(rows);
  res.json(result);
});

router.post("/v1/recurring-schedules", async (req, res): Promise<void> => {
  const parsed = CreateRecurringScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(recurringSchedulesTable).values({
    booking_id: parsed.data.booking_id,
    contract_id: parsed.data.contract_id ?? null,
    account_id: parsed.data.account_id,
    schedule_type: parsed.data.schedule_type,
    frequency: parsed.data.frequency,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    gst_included: parsed.data.gst_included,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date ?? null,
    next_due_date: parsed.data.next_due_date,
  }).returning();
  const [result] = await enrichSchedules([row]);
  res.status(201).json(result);
});

router.put("/v1/recurring-schedules/:id", async (req, res): Promise<void> => {
  const parsed = UpdateRecurringScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof recurringSchedulesTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.booking_id != null) updates.booking_id = parsed.data.booking_id;
  if (parsed.data.contract_id !== undefined) updates.contract_id = parsed.data.contract_id;
  if (parsed.data.account_id != null) updates.account_id = parsed.data.account_id;
  if (parsed.data.schedule_type != null) updates.schedule_type = parsed.data.schedule_type;
  if (parsed.data.frequency != null) updates.frequency = parsed.data.frequency;
  if (parsed.data.amount != null) updates.amount = parsed.data.amount;
  if (parsed.data.currency != null) updates.currency = parsed.data.currency;
  if (parsed.data.gst_included !== undefined) updates.gst_included = parsed.data.gst_included;
  if (parsed.data.start_date != null) updates.start_date = parsed.data.start_date;
  if (parsed.data.end_date !== undefined) updates.end_date = parsed.data.end_date;
  if (parsed.data.next_due_date != null) updates.next_due_date = parsed.data.next_due_date;
  const [row] = await db.update(recurringSchedulesTable).set(updates)
    .where(eq(recurringSchedulesTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichSchedules([row]);
  res.json(result);
});

router.patch("/v1/recurring-schedules/:id/deactivate", async (req, res): Promise<void> => {
  const [row] = await db.update(recurringSchedulesTable)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(recurringSchedulesTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichSchedules([row]);
  res.json(result);
});

// Approval gate: auto-created schedules start as 'PendingApproval' and are billed
// only after an admin approves them. The recurring cron skips non-Approved rows.
router.post("/v1/recurring-schedules/:id/approve", async (req, res): Promise<void> => {
  const [row] = await db.update(recurringSchedulesTable)
    .set({ approval_status: "Approved", is_active: true, updated_at: new Date() })
    .where(eq(recurringSchedulesTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [schedule] = await enrichSchedules([row]);
  res.json({ success: true, schedule });
});

router.post("/v1/recurring-schedules/:id/reject", async (req, res): Promise<void> => {
  const [row] = await db.update(recurringSchedulesTable)
    .set({ approval_status: "Rejected", is_active: false, updated_at: new Date() })
    .where(eq(recurringSchedulesTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [schedule] = await enrichSchedules([row]);
  res.json({ success: true, schedule });
});

router.post("/v1/recurring-schedules/generate-due", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const dueSchedules = await db.select().from(recurringSchedulesTable)
    .where(and(
      eq(recurringSchedulesTable.is_active, true),
      eq(recurringSchedulesTable.approval_status, "Approved"),
      lte(recurringSchedulesTable.next_due_date, today),
    ));

  const invoiceRefs: string[] = [];
  const errors: string[] = [];

  for (const schedule of dueSchedules) {
    try {
      const totalAmount = Number(schedule.amount);
      const subtotal = schedule.gst_included
        ? Math.round((totalAmount / 1.1) * 100) / 100
        : totalAmount;
      const gstAmount = schedule.gst_included
        ? Math.round((totalAmount - subtotal) * 100) / 100
        : 0;

      const invoice_ref = await nextInvoiceRef();
      const dueDate = addDays(today, 7);

      await db.insert(invoicesTable).values({
        invoice_ref,
        booking_id: schedule.booking_id,
        account_id: schedule.account_id,
        contract_id: schedule.contract_id ?? null,
        amount: String(totalAmount),
        currency: schedule.currency,
        exchange_rate_to_aud: await getRateToAud(schedule.currency),
        status: "Sent",
        due_date: dueDate,
        description: `${schedule.schedule_type} — ${schedule.frequency} payment (subtotal: $${subtotal}, GST: $${gstAmount})`,
      });

      const nextDue = nextDueDateFromFrequency(schedule.next_due_date, schedule.frequency);
      await db.update(recurringSchedulesTable)
        .set({ last_generated_at: new Date(), next_due_date: nextDue, updated_at: new Date() })
        .where(eq(recurringSchedulesTable.id, schedule.id));

      invoiceRefs.push(invoice_ref);
    } catch (err: any) {
      errors.push(`Schedule #${schedule.id}: ${err?.message ?? "Unknown error"}`);
    }
  }

  res.json({ generated_count: invoiceRefs.length, invoice_refs: invoiceRefs, errors });
});

router.post("/v1/recurring-schedules/bulk-delete", async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  if (currentUser?.role !== "SuperAdmin") {
    res.status(403).json({ error: "Only SuperAdmin can perform bulk delete" }); return;
  }
  const { ids, permanent } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const numIds = ids.map(Number).filter(Boolean);
  if (permanent) {
    await db.delete(recurringSchedulesTable).where(inArray(recurringSchedulesTable.id, numIds));
  } else {
    await db.update(recurringSchedulesTable).set({ deleted_at: new Date() }).where(inArray(recurringSchedulesTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/recurring-schedules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(recurringSchedulesTable).where(eq(recurringSchedulesTable.id, id));
  } else {
    await db.update(recurringSchedulesTable).set({ deleted_at: new Date() }).where(eq(recurringSchedulesTable.id, id));
  }
  res.status(204).end();
});

export default router;
