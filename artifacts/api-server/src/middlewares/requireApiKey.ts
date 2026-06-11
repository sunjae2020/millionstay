import { Request, Response, NextFunction } from "express";
import { db, apiCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifySecret, parseScopes, type ApiScope } from "../lib/apiKey";

// What requireApiKey attaches to the request once a credential authenticates.
export interface ApiClient {
  id: number;
  name: string;
  scopes: string[];
}

function unauthorized(res: Response, message = "Invalid or missing API credentials"): void {
  res.status(401).json({ error: { code: "UNAUTHORIZED", message } });
}

// Throttle last_used_at writes so a chatty client doesn't hammer the DB:
// at most one update per credential per minute.
const lastUsedWrites = new Map<number, number>();
const LAST_USED_THROTTLE_MS = 60 * 1000;

function touchLastUsed(id: number): void {
  const now = Date.now();
  const prev = lastUsedWrites.get(id) ?? 0;
  if (now - prev < LAST_USED_THROTTLE_MS) return;
  lastUsedWrites.set(id, now);
  // Fire-and-forget — never block the request on this bookkeeping write.
  db.update(apiCredentialsTable)
    .set({ last_used_at: new Date() })
    .where(eq(apiCredentialsTable.id, id))
    .catch(() => {});
}

/**
 * Authenticates an EXTERNAL request via API Key + Secret.
 *
 * Credentials are supplied as two headers:
 *   X-API-Key:    <key_id>
 *   X-API-Secret: <secret>
 *
 * On success, attaches `req.apiClient = { id, name, scopes }`.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const keyId = req.header("x-api-key");
  const secret = req.header("x-api-secret");
  if (!keyId || !secret) { unauthorized(res); return; }

  let row;
  try {
    [row] = await db
      .select()
      .from(apiCredentialsTable)
      .where(eq(apiCredentialsTable.key_id, keyId))
      .limit(1);
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Authentication failed" } });
    return;
  }

  if (!row) { unauthorized(res); return; }
  if (!row.is_active || row.revoked_at) { unauthorized(res, "This API key has been revoked"); return; }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    unauthorized(res, "This API key has expired");
    return;
  }

  const ok = await verifySecret(secret, row.secret_hash);
  if (!ok) { unauthorized(res); return; }

  (req as any).apiClient = {
    id: row.id,
    name: row.name,
    scopes: parseScopes(row.scopes),
  } satisfies ApiClient;

  touchLastUsed(row.id);
  next();
}

/**
 * Guards a route behind a specific scope. Must run AFTER requireApiKey.
 *   router.get("/v1/bookings", requireScope("bookings:read"), handler)
 */
export function requireScope(scope: ApiScope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const client = (req as any).apiClient as ApiClient | undefined;
    if (!client) { unauthorized(res); return; }
    if (!client.scopes.includes(scope)) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: `This API key is missing the required scope: ${scope}` },
      });
      return;
    }
    next();
  };
}
