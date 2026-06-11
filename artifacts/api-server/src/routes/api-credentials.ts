import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, apiCredentialsTable } from "@workspace/db";
import {
  API_SCOPES,
  isValidScope,
  parseScopes,
  generateKeyId,
  generateSecret,
  hashSecret,
  last4,
} from "../lib/apiKey";

// Admin-facing management of EXTERNAL API credentials. Mounted under /api behind
// requireAuth (admin JWT). The actual third-party data API lives in
// external-api.ts under /api/ext/v1 and authenticates with the issued keys.
const router: IRouter = Router();

// Shape returned to the admin UI. NEVER includes secret_hash; the plaintext
// secret is only returned inline by create/rotate, exactly once.
function toPublic(row: typeof apiCredentialsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    key_id: row.key_id,
    secret_last4: row.secret_last4,
    scopes: parseScopes(row.scopes),
    is_active: row.is_active,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sanitizeScopes(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const s of input) {
    if (typeof s !== "string" || !isValidScope(s)) return null;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

// List available scopes (so the UI can render checkboxes without hardcoding).
router.get("/v1/api-credentials/scopes", (_req, res): void => {
  res.json({ scopes: API_SCOPES });
});

// List all issued credentials (never exposes secrets).
router.get("/v1/api-credentials", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(apiCredentialsTable)
    .orderBy(desc(apiCredentialsTable.created_at));
  res.json(rows.map(toPublic));
});

// Create a new credential. Returns the plaintext secret ONCE — it is never
// retrievable again.
router.post("/v1/api-credentials", async (req, res): Promise<void> => {
  const { name, scopes, expires_at } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const cleanScopes = sanitizeScopes(scopes);
  if (cleanScopes === null) {
    res.status(400).json({ error: "scopes must be an array of valid scope strings" });
    return;
  }
  if (cleanScopes.length === 0) {
    res.status(400).json({ error: "at least one scope is required" });
    return;
  }
  let expiresAt: Date | null = null;
  if (expires_at) {
    const d = new Date(expires_at);
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "expires_at is invalid" }); return; }
    expiresAt = d;
  }

  const keyId = generateKeyId();
  const secret = generateSecret();
  const secret_hash = await hashSecret(secret);
  const createdBy = (req as any).user?.id ?? null;

  const [row] = await db
    .insert(apiCredentialsTable)
    .values({
      name: name.trim(),
      key_id: keyId,
      secret_hash,
      secret_last4: last4(secret),
      scopes: JSON.stringify(cleanScopes),
      created_by: createdBy,
      expires_at: expiresAt,
    })
    .returning();

  // The ONLY time the plaintext secret crosses the wire.
  res.status(201).json({ ...toPublic(row!), secret });
});

// Update name / scopes / active flag.
router.patch("/v1/api-credentials/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  const { name, scopes, is_active } = req.body ?? {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) { res.status(400).json({ error: "name must be a non-empty string" }); return; }
    updates.name = name.trim();
  }
  if (scopes !== undefined) {
    const cleanScopes = sanitizeScopes(scopes);
    if (cleanScopes === null || cleanScopes.length === 0) {
      res.status(400).json({ error: "scopes must be a non-empty array of valid scope strings" });
      return;
    }
    updates.scopes = JSON.stringify(cleanScopes);
  }
  if (is_active !== undefined) {
    if (typeof is_active !== "boolean") { res.status(400).json({ error: "is_active must be a boolean" }); return; }
    updates.is_active = is_active;
  }

  const [row] = await db
    .update(apiCredentialsTable)
    .set(updates)
    .where(eq(apiCredentialsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toPublic(row));
});

// Rotate the secret: generates a brand-new secret (invalidating the old one)
// and returns it ONCE. key_id stays the same so the client only updates 1 value.
router.post("/v1/api-credentials/:id/rotate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }

  const secret = generateSecret();
  const secret_hash = await hashSecret(secret);

  const [row] = await db
    .update(apiCredentialsTable)
    .set({ secret_hash, secret_last4: last4(secret), updated_at: new Date() })
    .where(eq(apiCredentialsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...toPublic(row), secret });
});

// Revoke (soft): deactivate and stamp revoked_at. The row is kept for audit.
router.delete("/v1/api-credentials/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const [row] = await db
    .update(apiCredentialsTable)
    .set({ is_active: false, revoked_at: new Date(), updated_at: new Date() })
    .where(eq(apiCredentialsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toPublic(row));
});

export default router;
