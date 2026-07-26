import { Router, type IRouter } from "express";
import { eq, ilike, and, isNull, inArray, SQL } from "drizzle-orm";
import { db, beneficiariesTable, accountsTable, commissionsTable, contractProductsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  ListBeneficiariesQueryParams,
  CreateBeneficiaryBody,
  GetBeneficiaryParams,
  UpdateBeneficiaryBody,
  UpdateBeneficiaryParams,
  DeleteBeneficiaryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SELECT_FIELDS = {
  id: beneficiariesTable.id,
  name: beneficiariesTable.name,
  contract_product_id: beneficiariesTable.contract_product_id,
  account_id: beneficiariesTable.account_id,
  commission_id: beneficiariesTable.commission_id,
  commission_type: beneficiariesTable.commission_type,
  split_percentage: beneficiariesTable.split_percentage,
  fixed_amount: beneficiariesTable.fixed_amount,
  priority: beneficiariesTable.priority,
  notes: beneficiariesTable.notes,
  status: beneficiariesTable.status,
  account_name: accountsTable.name,
  commission_name: commissionsTable.name,
  contract_product_name: contractProductsTable.name,
  created_at: beneficiariesTable.created_at,
  updated_at: beneficiariesTable.updated_at,
};

router.get("/v1/beneficiaries", async (req, res): Promise<void> => {
  const parsed = ListBeneficiariesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { q, contract_product_id, account_id, status } = parsed.data;

  const conditions: SQL[] = [deletedFilter(beneficiariesTable.deleted_at, req)];
  if (status) conditions.push(eq(beneficiariesTable.status, status));
  if (contract_product_id) conditions.push(eq(beneficiariesTable.contract_product_id, contract_product_id));
  if (account_id) conditions.push(eq(beneficiariesTable.account_id, account_id));
  if (q) conditions.push(ilike(beneficiariesTable.name, `%${q}%`));

  const rows = await db
    .select(SELECT_FIELDS)
    .from(beneficiariesTable)
    .leftJoin(accountsTable, eq(beneficiariesTable.account_id, accountsTable.id))
    .leftJoin(commissionsTable, eq(beneficiariesTable.commission_id, commissionsTable.id))
    .leftJoin(contractProductsTable, eq(beneficiariesTable.contract_product_id, contractProductsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(beneficiariesTable.priority, beneficiariesTable.name);

  res.json(rows);
});

router.post("/v1/beneficiaries", async (req, res): Promise<void> => {
  const parsed = CreateBeneficiaryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(beneficiariesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/v1/beneficiaries/:id", async (req, res): Promise<void> => {
  const parsed = GetBeneficiaryParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db
    .select(SELECT_FIELDS)
    .from(beneficiariesTable)
    .leftJoin(accountsTable, eq(beneficiariesTable.account_id, accountsTable.id))
    .leftJoin(commissionsTable, eq(beneficiariesTable.commission_id, commissionsTable.id))
    .leftJoin(contractProductsTable, eq(beneficiariesTable.contract_product_id, contractProductsTable.id))
    .where(eq(beneficiariesTable.id, parsed.data.id));

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/beneficiaries/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateBeneficiaryParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateBeneficiaryBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [row] = await db
    .update(beneficiariesTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(beneficiariesTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

const beneficiariesSoftDelete = {
  table: beneficiariesTable,
  idColumn: beneficiariesTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/beneficiaries/bulk-delete", makeBulkDelete(beneficiariesSoftDelete));
router.post("/v1/beneficiaries/bulk-restore", makeBulkRestore(beneficiariesSoftDelete));

router.delete("/v1/beneficiaries/:id", async (req, res): Promise<void> => {
  const parsed = DeleteBeneficiaryParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(beneficiariesTable).where(eq(beneficiariesTable.id, parsed.data.id));
  } else {
    await db.update(beneficiariesTable)
      .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
      .where(eq(beneficiariesTable.id, parsed.data.id));
  }
  res.status(204).end();
});

export default router;
