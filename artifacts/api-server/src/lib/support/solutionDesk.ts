/**
 * Federation client for the solution vendor's support desk (Edubee).
 *
 * The vendor exposes ONE endpoint to external products:
 *   POST {base}/platform-support/ingest   header: x-ingest-token
 * It is token-gated (403 INGEST_DISABLED when the vendor has no token set,
 * 401 UNAUTHORIZED when ours does not match) and de-duplicates on
 * (product, externalRef): pushing the same externalRef again APPENDS a message
 * to the existing vendor thread instead of opening a second ticket. That is the
 * whole reason our `ticket_ref` doubles as the externalRef.
 *
 * Nothing here throws at the call site's expense — every failure comes back as
 * `{ ok: false, error }` so the ticket still lands in our own table and can be
 * retried from the UI. A vendor outage must never lose a staff member's write-up.
 *
 * Config (all via env, no deploy needed to point at a different desk):
 *   SOLUTION_SUPPORT_URL      vendor API base   (default https://api.edubee.co/api)
 *   SOLUTION_SUPPORT_TOKEN    shared secret     (unset → push disabled)
 *   SOLUTION_SUPPORT_PRODUCT  our product key   (default millionstay; must not be 'edubee')
 *   SOLUTION_SUPPORT_ORG      tenant label shown in the vendor inbox
 *                             (default: Settings → Organisation trading name)
 */
import { resolveCompanyInfo } from "../documents/companyInfo";

// MUST be the api.* host. Edubee locks its origin with `X-Edge-Secret`, injected
// by a Cloudflare Transform Rule that fires for `api.edubee.co` only — a push
// aimed at `app.edubee.co/api` is refused with a bare 403 Forbidden before the
// ingest route is ever reached, which looks nothing like a token problem.
const DEFAULT_BASE = "https://api.edubee.co/api";

export interface SolutionDeskConfig {
  base: string;
  token: string;
  product: string;
}

/** Null when the desk is not configured — callers store the ticket and skip the push. */
export function solutionDeskConfig(): SolutionDeskConfig | null {
  const token = process.env["SOLUTION_SUPPORT_TOKEN"]?.trim();
  if (!token) return null;
  const base = (process.env["SOLUTION_SUPPORT_URL"]?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
  const product = (process.env["SOLUTION_SUPPORT_PRODUCT"]?.trim() || "millionstay").toLowerCase();
  // 'edubee' is the vendor's own tenant key; the intake rejects it from outside.
  if (!product || product === "edubee") return null;
  return { base, token, product };
}

export function isSolutionDeskConfigured(): boolean {
  return solutionDeskConfig() !== null;
}

/** The tenant label the vendor inbox shows in its Tenant column. */
export async function solutionDeskOrgLabel(): Promise<string> {
  const fromEnv = process.env["SOLUTION_SUPPORT_ORG"]?.trim();
  if (fromEnv) return fromEnv;
  try {
    const info = await resolveCompanyInfo();
    return info.tradingName || info.legalName || "";
  } catch {
    return "";
  }
}

export interface SolutionDeskPush {
  /** Our ticket_ref — the vendor de-dups on it. */
  externalRef: string;
  subject: string;
  /** The message body. On a follow-up push this is the new message only. */
  description: string;
  category?: string;
  priority?: string;
  language?: string;
  links?: { label: string; url: string }[];
  attachments?: { name: string; url: string; type?: string }[];
  requesterName?: string | null;
  requesterEmail?: string | null;
}

export type SolutionDeskResult =
  | { ok: true; ticketId: string | null; created: boolean }
  | { ok: false; error: string };

/**
 * Push one ticket or follow-up message to the vendor desk.
 * Resolves (never rejects); a 10s timeout keeps a hung vendor from holding
 * the admin's request open.
 */
export async function pushToSolutionDesk(payload: SolutionDeskPush): Promise<SolutionDeskResult> {
  const cfg = solutionDeskConfig();
  if (!cfg) return { ok: false, error: "NOT_CONFIGURED: SOLUTION_SUPPORT_TOKEN is unset" };

  const requesterOrg = await solutionDeskOrgLabel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${cfg.base}/platform-support/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": cfg.token },
      signal: controller.signal,
      body: JSON.stringify({
        product: cfg.product,
        externalRef: payload.externalRef,
        subject: payload.subject,
        description: payload.description,
        category: payload.category ?? "other",
        priority: payload.priority ?? "normal",
        language: payload.language ?? "ko",
        links: payload.links ?? [],
        attachments: payload.attachments ?? [],
        requesterOrg: requesterOrg || undefined,
        requesterName: payload.requesterName || undefined,
        requesterEmail: payload.requesterEmail || undefined,
      }),
    });

    const text = await res.text().catch(() => "");
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

    if (!res.ok) {
      const detail = body?.error ?? (text ? text.slice(0, 200) : "");
      return { ok: false, error: `HTTP ${res.status}${detail ? `: ${detail}` : ""}` };
    }
    return { ok: true, ticketId: body?.ticketId ?? null, created: Boolean(body?.created) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg === "The operation was aborted." ? "TIMEOUT after 10s" : msg };
  } finally {
    clearTimeout(timer);
  }
}
