/**
 * 공급사 답변 수신 — 연합 연동의 되돌아오는 다리.
 *
 * 나가는 쪽(`solutionDesk.ts`)은 우리 문의를 Edubee 수신부로 민다. 이 파일은 그
 * 반대편으로, Edubee 의 `GET /platform-support/outbox` 를 **주기적으로 당겨와**
 * 데스크 답변을 우리 스레드에 넣는다.
 *
 * 왜 pull 인가: 답변은 급하지 않고, push 였다면 제품마다 수신 URL 과 비밀값을
 * 따로 맞춰 두고 우리가 잠깐 죽었을 때 재시도까지 관리해야 한다. 당기는 쪽은
 * 다음 주기에 그냥 다시 물어보면 끝이다.
 *
 * 커서는 `(created_at, id)` keyset 이고 `integration_settings` 한 줄에 둔다.
 * 타임스탬프만으로 끊으면 같은 밀리초에 쓰인 두 답변이 페이지 경계에 걸려
 * 뒤엣것이 영영 누락된다 — 몇 달 뒤 "답을 줬는데 못 봤다" 로 드러나는 종류의 버그다.
 *
 * 커서를 잃어도 안전하다: 삽입은 `external_message_id` 유니크 인덱스로 멱등하다.
 * 그 인덱스는 반드시 **조건 없는** 유니크여야 한다 — 부분 인덱스면 아래 ON CONFLICT 가
 * 그것을 추론하지 못해 삽입이 통째로 실패한다(0095 가 그 사고를 고쳤다).
 */
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  integrationSettings,
  solutionSupportTicketsTable,
  solutionSupportMessagesTable,
  type SupportAttachment,
} from "@workspace/db";
import { solutionDeskConfig } from "./solutionDesk";

/** 커서가 사는 자리(`integration_settings.key`). 제품 키까지 붙여 인스턴스별로 분리. */
const cursorKey = (product: string) => `solution_support_outbox_cursor:${product}`;

interface OutboxMessage {
  id: string;
  createdAt: string;
  message: string;
  originalLang: string | null;
  translations: Record<string, string> | null;
  attachments: unknown;
  senderName: string | null;
  externalRef: string | null;
  ticketRef: string | null;
  ticketStatus: string | null;
}

export interface PullResult {
  ok: boolean;
  /** 새로 스레드에 들어간 답변 수. */
  inserted: number;
  /** 받아왔지만 우리 티켓을 못 찾았거나 이미 있던 수. */
  skipped: number;
  error?: string;
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

/**
 * 답변 본문을 고른다. 공급사 데스크는 영어를 중심 언어로 쓰고 번역본을
 * `translations` 에 캐시해 두므로, 티켓 언어본이 있으면 그것을 먼저 쓴다.
 * 없으면 원문 그대로 — 번역이 없다고 답변을 감출 이유는 없다.
 */
function pickText(m: OutboxMessage, ticketLang: string): string {
  const tr = m.translations ?? {};
  return (tr[ticketLang] || tr["ko"] || m.message || "").trim() || m.message;
}

async function readCursor(product: string): Promise<string> {
  const [row] = await db.select().from(integrationSettings)
    .where(eq(integrationSettings.key, cursorKey(product))).limit(1);
  return row?.value ?? "";
}

async function writeCursor(product: string, value: string): Promise<void> {
  await db.insert(integrationSettings)
    .values({ key: cursorKey(product), value })
    .onConflictDoUpdate({
      target: integrationSettings.key,
      set: { value, updated_at: new Date() },
    });
}

/**
 * outbox 를 한 번 훑어 새 답변을 스레드에 넣는다. 실패해도 던지지 않는다 —
 * 호출부는 크론과 관리자 버튼 둘뿐이고, 어느 쪽도 예외로 멈출 이유가 없다.
 */
export async function pullSolutionDeskReplies(): Promise<PullResult> {
  const cfg = solutionDeskConfig();
  if (!cfg) return { ok: false, inserted: 0, skipped: 0, error: "NOT_CONFIGURED" };

  let inserted = 0;
  let skipped = 0;
  let cursor = await readCursor(cfg.product);

  // 한 번 호출로 밀린 것을 끝까지 따라잡되, 무한 루프는 막는다.
  for (let pageNo = 0; pageNo < 20; pageNo += 1) {
    const url = new URL(`${cfg.base}/platform-support/outbox`);
    url.searchParams.set("product", cfg.product);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let body: { messages?: OutboxMessage[]; nextCursor?: string | null; hasMore?: boolean };
    try {
      const res = await fetch(url, {
        headers: { "x-ingest-token": cfg.token },
        signal: controller.signal,
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        // 404/401 은 "아직 공급사 쪽이 안 열렸다" 는 흔한 상태다. 조용히 물러난다.
        return { ok: false, inserted, skipped, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
      }
      body = text ? JSON.parse(text) : {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, inserted, skipped, error: msg === "The operation was aborted." ? "TIMEOUT after 15s" : msg };
    } finally {
      clearTimeout(timer);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    for (const m of messages) {
      if (!m?.id || !m.externalRef) { skipped += 1; continue; }

      // externalRef 는 우리가 보낸 ticket_ref 그대로다.
      const [ticket] = await db.select({
        id: solutionSupportTicketsTable.id,
        language: solutionSupportTicketsTable.language,
      })
        .from(solutionSupportTicketsTable)
        .where(and(
          eq(solutionSupportTicketsTable.ticket_ref, m.externalRef),
          sql`${solutionSupportTicketsTable.deleted_at} is null`,
        ))
        .limit(1);
      if (!ticket) { skipped += 1; continue; }   // 우리 쪽에서 지워진 티켓

      const rows = await db.insert(solutionSupportMessagesTable).values({
        ticket_id: ticket.id,
        sender_type: "solution",
        sender_name: m.senderName ?? "Solution",
        message: pickText(m, ticket.language),
        attachments: sanitizeAttachments(m.attachments),
        external_message_id: m.id,
        // 받은 글이라 보낼 곳이 없다 — 대기로 두면 재시도 대상으로 오해된다.
        push_status: "sent",
        pushed_at: new Date(),
        created_at: m.createdAt ? new Date(m.createdAt) : new Date(),
      })
        .onConflictDoNothing({ target: solutionSupportMessagesTable.external_message_id })
        .returning({ id: solutionSupportMessagesTable.id });

      if (rows.length === 0) { skipped += 1; continue; }
      inserted += 1;

      // 답변이 붙었으면 스레드가 움직인 것이다 — 리스트 기본 정렬이
      // greatest(updated_at, created_at) 이라 이 갱신이 곧 "위로 올리기"다.
      await db.update(solutionSupportTicketsTable)
        .set({ updated_at: new Date() })
        .where(eq(solutionSupportTicketsTable.id, ticket.id));
    }

    if (typeof body.nextCursor === "string" && body.nextCursor) {
      cursor = body.nextCursor;
      await writeCursor(cfg.product, cursor);
    }
    if (!body.hasMore) break;
  }

  return { ok: true, inserted, skipped };
}
