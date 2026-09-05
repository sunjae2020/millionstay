// 세입자 온보딩 링크 — 서비스 계층.
//
// 로그인 없이 열리는 링크의 발급·해석·감사기록을 한자리에 모은다. 전자서명
// (`services/contractSigning.ts`)과 같은 규칙을 따르되, 서명이 아닌 세 종류를
// 다룬다: 임차 신청서(`application`), 청구서 조회 + 입금 통보(`invoice_pay`),
// 서류 제출 요청(`doc_request`), 입주 신청서(`intake`).
//
// `application` 만 계약보다 먼저 선다 — 계약이 아직 없는 단계라 대상이 문의(lead)다.
//
// 토큰 하나가 (kind, context_type, context_id) 한 쌍을 가리키고, 같은 대상에
// 살아 있는 링크는 언제나 하나다 — 재발급하면 이전 것이 취소된다. 링크를 두 개
// 뿌려 놓고 어느 쪽으로 들어왔는지 모르는 상황이 실무에서 가장 성가시다.
import { randomBytes } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, tenantAccessLinksTable, type TenantAccessLink } from "@workspace/db";
import { signingBaseUrl } from "./contractSigning.js";

export type TenantLinkKind = "application" | "invoice_pay" | "doc_request" | "intake";
export type TenantLinkContextType = "lead" | "invoice" | "contract" | "booking";

/** 링크가 살아 있지 않을 때 공개 화면이 그대로 보여 줄 사유. */
export type TenantLinkFailure = "not_found" | "expired" | "cancelled" | "completed";

/** kind → 공개 웹 경로. 토큰 하나로 어느 화면을 열지가 여기서 갈린다. */
export function tenantLinkPath(kind: string, token: string): string {
  if (kind === "application") return `/apply/${token}`;
  if (kind === "invoice_pay") return `/pay/${token}`;
  if (kind === "intake") return `/intake/${token}`;
  return `/documents/${token}`;
}

export function tenantLinkUrl(kind: string, token: string): string {
  return `${signingBaseUrl()}${tenantLinkPath(kind, token)}`;
}

/**
 * 감사기록 한 줄을 append 한다. jsonb 이어붙이기를 SQL 로 하는 이유는 세입자와
 * 관리자가 같은 행을 동시에 건드려도 서로의 기록을 덮지 않게 하기 위해서다.
 * 절대 throw 하지 않는다 — 감사 실패가 본 흐름을 막아서는 안 된다.
 */
export async function appendLinkAudit(id: number, event: Record<string, unknown>): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE tenant_access_links
      SET audit_trail = COALESCE(audit_trail, '[]'::jsonb) || ${JSON.stringify([{ at: new Date().toISOString(), ...event }])}::jsonb
      WHERE id = ${id}
    `);
  } catch (err) {
    console.warn("[TenantLink] audit_trail append skipped:", (err as Error)?.message);
  }
}

/** 제출물 한 건을 append 한다(같은 이유로 SQL concat). */
export async function appendLinkSubmission(id: number, entry: Record<string, unknown>): Promise<void> {
  await db.execute(sql`
    UPDATE tenant_access_links
    SET submissions = COALESCE(submissions, '[]'::jsonb) || ${JSON.stringify([{ at: new Date().toISOString(), ...entry }])}::jsonb,
        updated_at = now()
    WHERE id = ${id}
  `);
}

export interface CreateTenantLinkInput {
  kind: TenantLinkKind;
  contextType: TenantLinkContextType;
  contextId: number;
  contactId?: number | null;
  accountId?: number | null;
  sentTo?: string | null;
  lang?: string | null;
  payload?: Record<string, unknown>;
  /** 기본 14일. 청구서 링크는 납기일까지로 잡는 편이 자연스럽다. */
  expiryDays?: number;
  expiresAt?: Date | null;
}

/**
 * 링크를 발급한다. 같은 대상에 대기 중인 이전 링크는 취소되고, 새 토큰 하나만
 * 살아남는다. 이미 완료된 링크(completed)는 건드리지 않는다 — 입금 통보나 제출
 * 기록이 달린 행이므로 증거로 남겨 둔다.
 */
export async function createTenantLink(input: CreateTenantLinkInput): Promise<TenantAccessLink> {
  const {
    kind, contextType, contextId,
    contactId = null, accountId = null, sentTo = null, lang = null,
    payload = {}, expiryDays = 14, expiresAt,
  } = input;

  const stale = await db
    .select({ id: tenantAccessLinksTable.id })
    .from(tenantAccessLinksTable)
    .where(and(
      eq(tenantAccessLinksTable.kind, kind),
      eq(tenantAccessLinksTable.context_type, contextType),
      eq(tenantAccessLinksTable.context_id, contextId),
      inArray(tenantAccessLinksTable.status, ["pending", "viewed"]),
    ));
  if (stale.length) {
    await db.update(tenantAccessLinksTable)
      .set({ status: "cancelled", updated_at: new Date() })
      .where(inArray(tenantAccessLinksTable.id, stale.map((r) => r.id)));
  }

  const expires = expiresAt ?? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(tenantAccessLinksTable)
    .values({
      token: randomBytes(32).toString("hex"),
      kind, context_type: contextType, context_id: contextId,
      contact_id: contactId, account_id: accountId,
      sent_to: sentTo, lang,
      status: "pending",
      payload,
      expires_at: expires,
    })
    .returning();
  return row!;
}

/**
 * 토큰을 해석한다. 만료된 링크는 이 자리에서 상태를 굳혀 둔다(크론 없이도
 * 원장이 진실을 말하도록). 성공 시 열람 사실을 기록한다.
 */
export async function resolveTenantLink(
  token: string,
  kind?: TenantLinkKind,
  opts: { ip?: string; userAgent?: string; markViewed?: boolean } = {},
): Promise<{ link: TenantAccessLink } | { failure: TenantLinkFailure }> {
  const [row] = await db
    .select()
    .from(tenantAccessLinksTable)
    .where(eq(tenantAccessLinksTable.token, token))
    .limit(1);
  if (!row || (kind && row.kind !== kind)) return { failure: "not_found" };
  if (row.status === "cancelled") return { failure: "cancelled" };
  if (row.status !== "completed" && row.expires_at && new Date(row.expires_at) < new Date()) {
    if (row.status !== "expired") {
      await db.update(tenantAccessLinksTable)
        .set({ status: "expired", updated_at: new Date() })
        .where(eq(tenantAccessLinksTable.id, row.id));
    }
    return { failure: "expired" };
  }

  // 완료된 링크는 계속 열린다 — 세입자가 자기가 낸 것을 다시 볼 수 있어야 한다.
  // 쓰기는 각 라우트가 status 로 막는다.
  if (opts.markViewed !== false) {
    const patch: Partial<TenantAccessLink> = { updated_at: new Date() };
    if (row.status === "pending") { patch.status = "viewed"; patch.viewed_at = new Date(); }
    else if (!row.viewed_at) patch.viewed_at = new Date();
    if (Object.keys(patch).length > 1) {
      await db.update(tenantAccessLinksTable).set(patch).where(eq(tenantAccessLinksTable.id, row.id));
    }
    void appendLinkAudit(row.id, { event: "viewed", ip: opts.ip ?? null, userAgent: opts.userAgent ?? null });
  }
  return { link: row };
}

/** 한 대상에 달린 링크들 — 상세 화면이 이력까지 그대로 그린다. */
export async function listTenantLinks(
  kind: TenantLinkKind,
  contextType: TenantLinkContextType,
  contextId: number,
): Promise<TenantAccessLink[]> {
  return db
    .select()
    .from(tenantAccessLinksTable)
    .where(and(
      eq(tenantAccessLinksTable.kind, kind),
      eq(tenantAccessLinksTable.context_type, contextType),
      eq(tenantAccessLinksTable.context_id, contextId),
    ))
    .orderBy(desc(tenantAccessLinksTable.id));
}

/** 링크를 즉시 무효화한다(잘못 보냈을 때). */
export async function cancelTenantLink(id: number): Promise<void> {
  await db.update(tenantAccessLinksTable)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(eq(tenantAccessLinksTable.id, id));
}

export async function markTenantLinkCompleted(id: number): Promise<void> {
  await db.update(tenantAccessLinksTable)
    .set({ status: "completed", completed_at: new Date(), updated_at: new Date() })
    .where(eq(tenantAccessLinksTable.id, id));
}

/** 화면·목록이 공통으로 쓰는 직렬화(토큰 URL 포함, 감사기록은 관리자에게만). */
export function serializeTenantLink(row: TenantAccessLink, opts: { withAudit?: boolean } = {}) {
  const { audit_trail, ...rest } = row;
  return {
    ...rest,
    url: tenantLinkUrl(row.kind, row.token),
    ...(opts.withAudit ? { audit_trail } : {}),
  };
}
