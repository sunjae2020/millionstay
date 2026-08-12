import { Router, type IRouter } from "express";
import { eq, ilike, and, or, gte, lte, isNull, inArray, SQL } from "drizzle-orm";
import { db, tasksTable, contactsTable, accountsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";

import { keywordCondition } from "../lib/listSearch";
import { formatPersonName } from "../lib/nameFormat";
const router: IRouter = Router();

router.get("/v1/tasks", async (req, res): Promise<void> => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, task_status, priority, task_category, due_date_from, due_date_to, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(tasksTable.deleted_at, req)];
  if (task_status) conditions.push(eq(tasksTable.task_status, task_status));
  if (priority) conditions.push(eq(tasksTable.priority, priority));
  if (task_category) conditions.push(eq(tasksTable.task_category, task_category));
  if (due_date_from) conditions.push(gte(tasksTable.due_date, due_date_from));
  if (due_date_to) conditions.push(lte(tasksTable.due_date, due_date_to));
  if (status) conditions.push(eq(tasksTable.status, status));
  if (search) {
    conditions.push(keywordCondition(search, [tasksTable.name, tasksTable.subject, tasksTable.description]));
  }

  const rows = await db
    .select({
      id: tasksTable.id,
      name: tasksTable.name,
      subject: tasksTable.subject,
      task_status: tasksTable.task_status,
      priority: tasksTable.priority,
      task_category: tasksTable.task_category,
      primary_contact_id: tasksTable.primary_contact_id,
      secondary_contact_id: tasksTable.secondary_contact_id,
      account_id: tasksTable.account_id,
      booking_id: tasksTable.booking_id,
      start_date: tasksTable.start_date,
      due_date: tasksTable.due_date,
      completed_at: tasksTable.completed_at,
      description: tasksTable.description,
      manual_input: tasksTable.manual_input,
      status: tasksTable.status,
      created_at: tasksTable.created_at,
      updated_at: tasksTable.updated_at,
      primary_contact_name: contactsTable.first_name,
      account_name: accountsTable.name,
    })
    .from(tasksTable)
    .leftJoin(contactsTable, eq(tasksTable.primary_contact_id, contactsTable.id))
    .leftJoin(accountsTable, eq(tasksTable.account_id, accountsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(tasksTable.created_at);

  res.json(rows.map((r) => ({
    ...r,
    primary_contact_name: r.primary_contact_name
      ? `${r.primary_contact_name} ${r.account_name ?? ""}`.trim()
      : null,
  })));
});

router.post("/v1/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(tasksTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/v1/tasks/:id", async (req, res): Promise<void> => {
  const parsed = GetTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = await db
    .select({
      id: tasksTable.id,
      name: tasksTable.name,
      subject: tasksTable.subject,
      task_status: tasksTable.task_status,
      priority: tasksTable.priority,
      task_category: tasksTable.task_category,
      primary_contact_id: tasksTable.primary_contact_id,
      secondary_contact_id: tasksTable.secondary_contact_id,
      account_id: tasksTable.account_id,
      booking_id: tasksTable.booking_id,
      start_date: tasksTable.start_date,
      due_date: tasksTable.due_date,
      completed_at: tasksTable.completed_at,
      description: tasksTable.description,
      manual_input: tasksTable.manual_input,
      status: tasksTable.status,
      created_at: tasksTable.created_at,
      updated_at: tasksTable.updated_at,
    })
    .from(tasksTable)
    .where(eq(tasksTable.id, parsed.data.id));

  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }

  let primary_contact_name: string | null = null;
  let account_name: string | null = null;

  if (rows[0].primary_contact_id) {
    const [c] = await db.select({ first_name: contactsTable.first_name, last_name: contactsTable.last_name })
      .from(contactsTable).where(eq(contactsTable.id, rows[0].primary_contact_id));
    if (c) primary_contact_name = formatPersonName(c.first_name, c.last_name);
  }
  if (rows[0].account_id) {
    const [a] = await db.select({ name: accountsTable.name })
      .from(accountsTable).where(eq(accountsTable.id, rows[0].account_id));
    if (a) account_name = a.name;
  }

  res.json({ ...rows[0], primary_contact_name, account_name });
});

router.put("/v1/tasks/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateTaskParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(tasksTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(tasksTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

const tasksSoftDelete = {
  table: tasksTable,
  idColumn: tasksTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/tasks/bulk-delete", makeBulkDelete(tasksSoftDelete));
router.post("/v1/tasks/bulk-restore", makeBulkRestore(tasksSoftDelete));

router.delete("/v1/tasks/:id", async (req, res): Promise<void> => {
  const parsed = DeleteTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(tasksTable).where(eq(tasksTable.id, parsed.data.id));
  } else {
    await db.update(tasksTable)
      .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
      .where(eq(tasksTable.id, parsed.data.id));
  }
  res.status(204).end();
});

router.patch("/v1/tasks/:id/complete", async (req, res): Promise<void> => {
  const parsed = GetTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(tasksTable)
    .set({ task_status: "Done", completed_at: new Date(), updated_at: new Date() })
    .where(eq(tasksTable.id, parsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
