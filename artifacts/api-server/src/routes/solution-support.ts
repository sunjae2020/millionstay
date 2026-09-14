/**
 * Solution Support (admin side) — where OUR staff raise requests with the
 * solution vendor (Edubee). The mirror image of `cs-tickets.ts`, which is where
 * our own customers raise requests with us.
 *
 * Every write lands in `solution_support_*` FIRST and is pushed to the vendor
 * second, because the vendor intake is a network call that can fail and a staff
 * member's write-up must never be lost to someone else's outage. A failed push
 * leaves `push_status = 'failed'` with the reason in `push_error`; the UI shows
 * it and offers a retry. See lib/support/solutionDesk.ts for the wire contract.
 */
import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, ilike, or, sql, inArray } from "drizzle-orm";
import {
  db,
  solutionSupportTicketsTable,
  solutionSupportMessagesTable,
  type SupportLink,
  type SupportAttachment,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { getAiClient, isTaskConfigured } from "../lib/ai/client.js";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { parseListPage, parseSortParams, buildOrderBy, sendList, type SortMap } from "../utils/pagination";
import {
  pushToSolutionDesk,
  isSolutionDeskConfigured,
  solutionDeskOrgLabel,
} from "../lib/support/solutionDesk";

const router: IRouter = Router();

// Categories mirror the vendor's own vocabulary so no translation is needed at
// the ingest boundary. Anything else the vendor maps to 'other'.
export const SUPPORT_CATEGORIES = ["usage", "billing", "feature", "collab", "bug", "other"] as const;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const ok = (res: any, data: unknown, extra: Record<string, unknown> = {}) =>
  res.json({ success: true, data, ...extra });
const fail = (res: any, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message } });

/** SS-2026-00001 — also the externalRef the vendor de-dups on. */
async function nextTicketRef(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(solutionSupportTicketsTable)
    .where(ilike(solutionSupportTicketsTable.ticket_ref, `SS-${year}-%`));
  return `SS-${year}-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;
}

function sanitizeLinks(raw: unknown): SupportLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => ({ label: String(l["label"] ?? "").slice(0, 120), url: String(l["url"] ?? "").trim() }))
    .filter((l) => /^https?:\/\//i.test(l.url))
    .slice(0, 20);
}

function sanitizeAttachments(raw: unknown): SupportAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      name: String(a["name"] ?? "file").slice(0, 200),
      url: String(a["url"] ?? "").trim(),
      type: a["type"] ? String(a["type"]).slice(0, 80) : undefined,
    }))
    .filter((a) => /^https?:\/\//i.test(a.url))
    .slice(0, 10);
}

const pick = <T extends readonly string[]>(list: T, v: unknown, dflt: T[number]): T[number] =>
  list.includes(String(v)) ? (String(v) as T[number]) : dflt;

// ── Vendor connection state ────────────────────────────────────────────────
// The page renders a banner from this: without a token the desk stores tickets
// locally but nothing reaches the vendor, and staff must be told that plainly.
router.get("/v1/solution-support/config", requireAuth, async (_req, res): Promise<void> => {
  ok(res, {
    configured: isSolutionDeskConfigured(),
    product: (process.env["SOLUTION_SUPPORT_PRODUCT"]?.trim() || "millionstay").toLowerCase(),
    deskUrl: (process.env["SOLUTION_SUPPORT_URL"]?.trim() || "https://api.edubee.co/api").replace(/\/+$/, ""),
    requesterOrg: await solutionDeskOrgLabel(),
    aiOrganize: isTaskConfigured("support_organize"),
    categories: SUPPORT_CATEGORIES,
  });
});

// ── List ───────────────────────────────────────────────────────────────────
// 서버 정렬 + 서버 페이징(docs/LIST_PAGINATION_SORTING.md). 프런트
// SolutionSupport.tsx 의 SORTABLE_KEYS 와 1:1로 맞춰 둘 것.
const SUPPORT_SORT: SortMap = {
  ticket_ref: solutionSupportTicketsTable.ticket_ref,
  subject: solutionSupportTicketsTable.subject,
  category: solutionSupportTicketsTable.category,
  status: solutionSupportTicketsTable.status,
  priority: solutionSupportTicketsTable.priority,
  push_status: solutionSupportTicketsTable.push_status,
  created_at: solutionSupportTicketsTable.created_at,
  updated_at: solutionSupportTicketsTable.updated_at,
  // 마지막 메시지 시각 — 스레드가 움직인 시점. 파생값이지만 SQL 로 내려야
  // 페이지 안에서만 정렬되는 사고가 안 난다.
  last_message_at: sql`(select max(m.created_at) from solution_support_messages m
                         where m.ticket_id = ${solutionSupportTicketsTable.id})`,
  // 기본 정렬 키. "최근에 쓴 글과 최근에 고친 글이 위" 라는 요구를 한 컬럼으로
  // 표현한 것 — 새 글은 created_at 이, 답글이 붙거나 상태를 바꾼 글은 updated_at
  // 이 올라오므로 둘 중 큰 값이 곧 '마지막 활동'이다.
  last_activity: sql`greatest(${solutionSupportTicketsTable.updated_at}, ${solutionSupportTicketsTable.created_at})`,
};

router.get("/v1/solution-support", requireAuth, async (req, res): Promise<void> => {
  try {
    const status = String(req.query["status"] ?? "").trim();
    const category = String(req.query["category"] ?? "").trim();
    const push = String(req.query["push_status"] ?? "").trim();
    const q = String(req.query["q"] ?? "").trim();

    const where = [deletedFilter(solutionSupportTicketsTable.deleted_at, req)];
    if (STATUSES.includes(status as (typeof STATUSES)[number])) {
      where.push(eq(solutionSupportTicketsTable.status, status));
    }
    if (SUPPORT_CATEGORIES.includes(category as (typeof SUPPORT_CATEGORIES)[number])) {
      where.push(eq(solutionSupportTicketsTable.category, category));
    }
    if (["queued", "sent", "failed"].includes(push)) {
      where.push(eq(solutionSupportTicketsTable.push_status, push));
    }
    if (q) {
      where.push(
        or(
          ilike(solutionSupportTicketsTable.subject, `%${q}%`),
          ilike(solutionSupportTicketsTable.ticket_ref, `%${q}%`),
          ilike(solutionSupportTicketsTable.description, `%${q}%`),
          ilike(solutionSupportTicketsTable.requester_name, `%${q}%`),
        )!,
      );
    }
    const filter = and(...where);

    const { limit, offset, page } = parseListPage(req.query);
    const sort = parseSortParams(req.query, SUPPORT_SORT, { defaultKey: "last_activity", defaultDir: "desc" });

    const [rows, [counted]] = await Promise.all([
      db.select().from(solutionSupportTicketsTable).where(filter)
        .orderBy(...buildOrderBy(SUPPORT_SORT, sort, solutionSupportTicketsTable.id))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(solutionSupportTicketsTable).where(filter),
    ]);

    // 메시지 집계는 현재 페이지의 티켓으로 좁힌 한 번의 그룹 쿼리로 — 행마다
    // 세는 N+1 이 리스트를 멈춰 세운 전례가 있다.
    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await db
          .select({
            ticket_id: solutionSupportMessagesTable.ticket_id,
            n: sql<number>`count(*)::int`,
            last_at: sql<string>`max(${solutionSupportMessagesTable.created_at})`,
          })
          .from(solutionSupportMessagesTable)
          .where(inArray(solutionSupportMessagesTable.ticket_id, ids))
          .groupBy(solutionSupportMessagesTable.ticket_id)
      : [];
    const byTicket = new Map(counts.map((c) => [c.ticket_id, c]));

    sendList(
      res,
      rows.map((t) => ({
        ...t,
        message_count: Number(byTicket.get(t.id)?.n ?? 0),
        last_message_at: byTicket.get(t.id)?.last_at ?? null,
      })),
      counted?.count ?? 0,
      { limit, offset, page },
    );
  } catch (err) {
    console.error("[solution-support] list failed:", err);
    fail(res, 500, "INTERNAL", "Failed to load support requests");
  }
});

// 보관함 + 일괄 보관/복구 — 다른 44개 리스트와 같은 수명주기.
const softDeleteCfg = { table: solutionSupportTicketsTable, idColumn: solutionSupportTicketsTable.id };
router.post("/v1/solution-support/bulk-delete", requireAuth, makeBulkDelete({
  ...softDeleteCfg,
  onPurge: async (ids) => {
    await db.delete(solutionSupportMessagesTable).where(inArray(solutionSupportMessagesTable.ticket_id, ids));
  },
}));
router.post("/v1/solution-support/bulk-restore", requireAuth, makeBulkRestore(softDeleteCfg));

// ── Detail (ticket + thread) ───────────────────────────────────────────────
router.get("/v1/solution-support/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const [ticket] = await db
      .select()
      .from(solutionSupportTicketsTable)
      .where(and(eq(solutionSupportTicketsTable.id, id), deletedFilter(solutionSupportTicketsTable.deleted_at, req)))
      .limit(1);
    if (!ticket) { fail(res, 404, "NOT_FOUND", "Support request not found"); return; }

    const messages = await db
      .select()
      .from(solutionSupportMessagesTable)
      .where(eq(solutionSupportMessagesTable.ticket_id, id))
      .orderBy(solutionSupportMessagesTable.created_at);

    ok(res, { ticket, messages });
  } catch (err) {
    console.error("[solution-support] detail failed:", err);
    fail(res, 500, "INTERNAL", "Failed to load the support request");
  }
});

// ── Create + push ──────────────────────────────────────────────────────────
router.post("/v1/solution-support", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user ?? {};
    const subject = String(req.body?.subject ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    if (!subject || !description) { fail(res, 400, "VALIDATION", "Subject and message are required"); return; }

    const category = pick(SUPPORT_CATEGORIES, req.body?.category, "usage");
    const priority = pick(PRIORITIES, req.body?.priority, "normal");
    const language = String(req.body?.language ?? "ko").slice(0, 8) || "ko";
    const links = sanitizeLinks(req.body?.links);
    const attachments = sanitizeAttachments(req.body?.attachments);
    const aiSummary = req.body?.aiSummary ? String(req.body.aiSummary).slice(0, 4000) : null;

    const ticket_ref = await nextTicketRef();
    const [ticket] = await db
      .insert(solutionSupportTicketsTable)
      .values({
        ticket_ref,
        category,
        subject,
        description,
        priority,
        language,
        links,
        attachments,
        ai_summary: aiSummary,
        requester_admin_id: user.id ?? null,
        requester_name: user.name ?? user.email ?? null,
        requester_email: user.email ?? null,
      })
      .returning();

    // The opening message is part of the thread too, so the detail view reads
    // as one conversation rather than "description, then replies".
    const [opening] = await db
      .insert(solutionSupportMessagesTable)
      .values({
        ticket_id: ticket!.id,
        sender_type: "admin",
        sender_id: user.id ?? null,
        sender_name: user.name ?? user.email ?? null,
        message: description,
        attachments,
      })
      .returning();

    const pushed = await pushToSolutionDesk({
      externalRef: ticket_ref,
      subject,
      // The AI summary is context for the vendor, never a replacement for what
      // the staff member actually wrote — both go, original first.
      description: aiSummary ? `${description}\n\n---\n[AI summary]\n${aiSummary}` : description,
      category,
      priority,
      language,
      links,
      attachments,
      requesterName: ticket!.requester_name,
      requesterEmail: ticket!.requester_email,
    });

    const [updated] = await db
      .update(solutionSupportTicketsTable)
      .set(
        pushed.ok
          ? { push_status: "sent", push_error: null, pushed_at: new Date(), external_ticket_id: pushed.ticketId }
          : { push_status: "failed", push_error: pushed.error },
      )
      .where(eq(solutionSupportTicketsTable.id, ticket!.id))
      .returning();

    await db
      .update(solutionSupportMessagesTable)
      .set(pushed.ok ? { push_status: "sent", pushed_at: new Date() } : { push_status: "failed", push_error: pushed.error })
      .where(eq(solutionSupportMessagesTable.id, opening!.id));

    void logAction({
      entityType: "solution_support_ticket",
      entityId: ticket!.id,
      action: "CREATE",
      actorId: user.id ?? null,
      newValue: { ticket_ref, category, pushed: pushed.ok },
    });

    res.status(201).json({ success: true, data: updated, push: pushed });
  } catch (err) {
    console.error("[solution-support] create failed:", err);
    fail(res, 500, "INTERNAL", "Failed to create the support request");
  }
});

// ── Follow-up message ──────────────────────────────────────────────────────
// An 'admin' message is pushed to the vendor under the SAME externalRef, which
// appends to the existing vendor thread. A 'solution' message is a vendor reply
// a staff member is recording here; it is local-only and never pushed back.
router.post("/v1/solution-support/:id/messages", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const user = (req as any).user ?? {};
    const message = String(req.body?.message ?? "").trim();
    if (!message) { fail(res, 400, "VALIDATION", "Message is required"); return; }
    const senderType = req.body?.senderType === "solution" ? "solution" : "admin";
    const attachments = sanitizeAttachments(req.body?.attachments);

    const [ticket] = await db
      .select()
      .from(solutionSupportTicketsTable)
      .where(and(eq(solutionSupportTicketsTable.id, id), deletedFilter(solutionSupportTicketsTable.deleted_at, req)))
      .limit(1);
    if (!ticket) { fail(res, 404, "NOT_FOUND", "Support request not found"); return; }

    const [row] = await db
      .insert(solutionSupportMessagesTable)
      .values({
        ticket_id: id,
        sender_type: senderType,
        sender_id: user.id ?? null,
        sender_name: senderType === "solution" ? (req.body?.senderName ? String(req.body.senderName).slice(0, 200) : "Solution") : (user.name ?? user.email ?? null),
        message,
        attachments,
        // Vendor replies have nowhere to be pushed — mark them settled, not queued.
        push_status: senderType === "solution" ? "sent" : "queued",
        pushed_at: senderType === "solution" ? new Date() : null,
      })
      .returning();

    let push: Awaited<ReturnType<typeof pushToSolutionDesk>> | null = null;
    if (senderType === "admin") {
      push = await pushToSolutionDesk({
        externalRef: ticket.ticket_ref,
        subject: ticket.subject,
        description: message,
        category: ticket.category,
        priority: ticket.priority,
        language: ticket.language,
        attachments,
        requesterName: ticket.requester_name,
        requesterEmail: ticket.requester_email,
      });
      await db
        .update(solutionSupportMessagesTable)
        .set(push.ok ? { push_status: "sent", push_error: null, pushed_at: new Date() } : { push_status: "failed", push_error: push.error })
        .where(eq(solutionSupportMessagesTable.id, row!.id));
      // A successful follow-up push also clears a ticket-level failure: the
      // vendor demonstrably has this thread now.
      if (push.ok) {
        await db
          .update(solutionSupportTicketsTable)
          .set({ push_status: "sent", push_error: null, pushed_at: new Date(), external_ticket_id: push.ticketId ?? ticket.external_ticket_id })
          .where(eq(solutionSupportTicketsTable.id, id));
      }
    }

    await db.update(solutionSupportTicketsTable).set({ updated_at: new Date() }).where(eq(solutionSupportTicketsTable.id, id));
    res.status(201).json({ success: true, data: row, push });
  } catch (err) {
    console.error("[solution-support] message failed:", err);
    fail(res, 500, "INTERNAL", "Failed to send the message");
  }
});

// ── Retry a failed push ────────────────────────────────────────────────────
// Re-sends every message still marked queued/failed, oldest first. Safe to run
// repeatedly: the vendor de-dups the TICKET on externalRef, and we only re-send
// messages our own table says did not land.
router.post("/v1/solution-support/:id/retry-push", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const [ticket] = await db
      .select()
      .from(solutionSupportTicketsTable)
      .where(and(eq(solutionSupportTicketsTable.id, id), deletedFilter(solutionSupportTicketsTable.deleted_at, req)))
      .limit(1);
    if (!ticket) { fail(res, 404, "NOT_FOUND", "Support request not found"); return; }
    if (!isSolutionDeskConfigured()) { fail(res, 503, "NOT_CONFIGURED", "The solution desk connection is not configured"); return; }

    const pending = await db
      .select()
      .from(solutionSupportMessagesTable)
      .where(and(eq(solutionSupportMessagesTable.ticket_id, id), eq(solutionSupportMessagesTable.sender_type, "admin")))
      .orderBy(solutionSupportMessagesTable.created_at);

    let sent = 0;
    let lastError: string | null = null;
    let externalId = ticket.external_ticket_id;
    for (const m of pending.filter((m) => m.push_status !== "sent")) {
      const push = await pushToSolutionDesk({
        externalRef: ticket.ticket_ref,
        subject: ticket.subject,
        description: m.message,
        category: ticket.category,
        priority: ticket.priority,
        language: ticket.language,
        links: ticket.links,
        attachments: m.attachments,
        requesterName: ticket.requester_name,
        requesterEmail: ticket.requester_email,
      });
      await db
        .update(solutionSupportMessagesTable)
        .set(push.ok ? { push_status: "sent", push_error: null, pushed_at: new Date() } : { push_status: "failed", push_error: push.error })
        .where(eq(solutionSupportMessagesTable.id, m.id));
      if (!push.ok) { lastError = push.error; break; }  // stop on first failure — order matters in a thread
      sent += 1;
      externalId = push.ticketId ?? externalId;
    }

    const [updated] = await db
      .update(solutionSupportTicketsTable)
      .set(
        lastError
          ? { push_status: "failed", push_error: lastError }
          : { push_status: "sent", push_error: null, pushed_at: new Date(), external_ticket_id: externalId },
      )
      .where(eq(solutionSupportTicketsTable.id, id))
      .returning();

    ok(res, updated, { sent, error: lastError });
  } catch (err) {
    console.error("[solution-support] retry failed:", err);
    fail(res, 500, "INTERNAL", "Retry failed");
  }
});

// ── Status / priority / links ──────────────────────────────────────────────
router.put("/v1/solution-support/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const patch: Record<string, unknown> = {};
    if (req.body?.status !== undefined) {
      patch["status"] = pick(STATUSES, req.body.status, "open");
      patch["closed_at"] = patch["status"] === "closed" ? new Date() : null;
    }
    if (req.body?.priority !== undefined) patch["priority"] = pick(PRIORITIES, req.body.priority, "normal");
    if (req.body?.links !== undefined) patch["links"] = sanitizeLinks(req.body.links);
    if (Object.keys(patch).length === 0) { fail(res, 400, "VALIDATION", "Nothing to update"); return; }

    const [updated] = await db
      .update(solutionSupportTicketsTable)
      .set(patch)
      .where(and(eq(solutionSupportTicketsTable.id, id), deletedFilter(solutionSupportTicketsTable.deleted_at, req)))
      .returning();
    if (!updated) { fail(res, 404, "NOT_FOUND", "Support request not found"); return; }
    ok(res, updated);
  } catch (err) {
    console.error("[solution-support] update failed:", err);
    fail(res, 500, "INTERNAL", "Failed to update the support request");
  }
});

router.delete("/v1/solution-support/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const [row] = await db
      .update(solutionSupportTicketsTable)
      .set({ deleted_at: new Date() })
      .where(eq(solutionSupportTicketsTable.id, id))
      .returning();
    if (!row) { fail(res, 404, "NOT_FOUND", "Support request not found"); return; }
    ok(res, { id });
  } catch (err) {
    console.error("[solution-support] delete failed:", err);
    fail(res, 500, "INTERNAL", "Failed to delete the support request");
  }
});

// ── Screenshot upload ──────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/v1/solution-support/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { fail(res, 400, "VALIDATION", "No file uploaded"); return; }
    if (!isCloudinaryConfigured()) { fail(res, 503, "NOT_CONFIGURED", "File upload is not configured"); return; }
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("solution-support") });
    ok(res, { name: req.file.originalname, url: result.secure_url, type: req.file.mimetype });
  } catch (err) {
    console.error("[solution-support] upload failed:", err);
    fail(res, 500, "INTERNAL", "Upload failed");
  }
});

// ── "Organize with AI" ─────────────────────────────────────────────────────
// Tidies a rough note into something the vendor can act on. It returns a
// SUGGESTION the staff member edits or discards — it never replaces what they
// wrote, and a failure here must not block sending the request.
const ORGANIZE_SYSTEM = [
  "You tidy a support request written by a property-management staff member for their",
  "software vendor's support desk. Rewrite it as a short, concrete report with these",
  "sections, omitting any section the input says nothing about:",
  "  - 상황 (what the user was doing)",
  "  - 문제 (what went wrong, with any error text quoted verbatim)",
  "  - 재현 (numbered steps, only if the input implies them)",
  "  - 기대 (what the user expected instead)",
  "Rules: reply in the SAME language as the input. Add no facts, no guesses about the",
  "cause, and no pleasantries. Keep every number, screen name, ID and quoted error",
  "exactly as written. Output the report only — no preamble, no markdown headings.",
].join(" ");

router.post("/v1/solution-support/ai/organize", requireAuth, async (req, res): Promise<void> => {
  try {
    const description = String(req.body?.description ?? "").trim();
    if (!description) { fail(res, 400, "VALIDATION", "Message is required"); return; }
    if (!isTaskConfigured("support_organize")) { fail(res, 503, "NOT_CONFIGURED", "AI is not configured"); return; }

    const subject = String(req.body?.subject ?? "").trim();
    const category = pick(SUPPORT_CATEGORIES, req.body?.category, "usage");

    const ai = getAiClient("support_organize");
    const msg = await ai.messages.create({
      max_tokens: 1200,
      system: [{ type: "text", text: ORGANIZE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify({ subject, category, description }) }],
    });
    const summary = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    ok(res, { summary });
  } catch (err) {
    console.error("[solution-support] organize failed:", err);
    fail(res, 500, "INTERNAL", "AI could not organize this note");
  }
});

export default router;
