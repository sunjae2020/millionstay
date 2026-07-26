import { Router } from "express";
import { db, emailTemplatesTable, emailLogsTable } from "@workspace/db";
import { eq, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";

const router = Router();

const UpdateEmailTemplateBody = z.object({
  subject: z.string().min(1).optional(),
  body_html: z.string().min(1).optional(),
  body_text: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

const TestEmailBody = z.object({
  to_email: z.string().email(),
});

router.get("/v1/email-templates", async (req, res): Promise<void> => {
  const rows = await db.select().from(emailTemplatesTable)
    .where(deletedFilter(emailTemplatesTable.deleted_at, req))
    .orderBy(emailTemplatesTable.id);
  res.json(rows);
});

router.get("/v1/email-templates/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.id, Number(req.params.id)))
    .then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/email-templates/:id", async (req, res): Promise<void> => {
  const parsed = UpdateEmailTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof emailTemplatesTable.$inferInsert> = {
    updated_at: new Date(),
  };
  if (parsed.data.subject != null) updates.subject = parsed.data.subject;
  if (parsed.data.body_html != null) updates.body_html = parsed.data.body_html;
  if (parsed.data.body_text !== undefined) updates.body_text = parsed.data.body_text;
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

  const [row] = await db.update(emailTemplatesTable).set(updates)
    .where(eq(emailTemplatesTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/v1/email-templates/:id/test", async (req, res): Promise<void> => {
  const parsed = TestEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const template = await db.select().from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.id, Number(req.params.id)))
    .then(r => r[0]);
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const mockMessageId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await db.insert(emailLogsTable).values({
    template_code: template.template_code,
    to_email: parsed.data.to_email,
    subject: `[TEST] ${template.subject}`,
    resend_message_id: mockMessageId,
    status: "Sent",
    entity_type: "email_template",
    entity_id: template.id,
  });

  res.json({ success: true, resend_message_id: mockMessageId, note: "Test email logged (no actual send — configure Resend API to enable delivery)" });
});

const emailTemplatesSoftDelete = {
  table: emailTemplatesTable,
  idColumn: emailTemplatesTable.id,
};

router.post("/v1/email-templates/bulk-delete", makeBulkDelete(emailTemplatesSoftDelete));
router.post("/v1/email-templates/bulk-restore", makeBulkRestore(emailTemplatesSoftDelete));

router.delete("/v1/email-templates/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
  } else {
    await db.update(emailTemplatesTable).set({ deleted_at: new Date() }).where(eq(emailTemplatesTable.id, id));
  }
  res.status(204).end();
});

export default router;
