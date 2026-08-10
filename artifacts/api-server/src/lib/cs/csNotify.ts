/**
 * CS 티켓 알림 (cs.*)
 *
 * 문의를 넣었는데 **접수 확인조차 오지 않는 것**이 고객 입장에서 가장 답답하다.
 * 지금까지 CS 티켓은 아무 알림도 보내지 않았다 — 이 모듈이 그 구멍을 메운다.
 *
 * ## 언어
 *
 * 티켓은 `customer_language` 를 들고 있다. 게스트가 쓴 언어를 감지해 저장하므로,
 * 알림도 그 언어로 나간다 — 6개국어 문안이 여기서 제 값을 한다.
 *
 * ## B2C / B2B 분리
 *
 * `requester_type` 이 'partner' 면 파트너용 키(cs.partner_*)를 쓴다. 호칭과 담긴 정보가
 * 다르다(스펙 §2.2 분리 기준). 잘못 쓰면 거래처 담당자에게 "고객님" 이 나간다.
 *
 * ## 실패해도 티켓 생성을 막지 않는다
 *
 * 알림 발송은 부가 작업이다. 메일이 안 나갔다고 문의 접수가 롤백되면 고객은 문의를
 * 두 번 넣게 된다. 그래서 이 모듈의 모든 함수는 throw 하지 않고 로그만 남긴다.
 */
import { and, eq } from "drizzle-orm";
import { db, csTicketsTable, guestUsersTable, emailLogsTable } from "@workspace/db";
import { sendCsEmail } from "../email";

/** 티켓 종류별 문안 키. 파트너는 호칭·정보가 달라 별도 키를 쓴다. */
function keyFor(event: "received" | "resolved", requesterType: string): string {
  const partner = requesterType === "partner";
  if (event === "received") return partner ? "cs.partner_ticket_received" : "cs.ticket_received";
  return partner ? "cs.partner_ticket_resolved" : "cs.ticket_resolved";
}

/** 같은 티켓에 같은 알림을 두 번 보내지 않는다(재시도·중복 호출 방지). */
async function alreadySent(ticketId: number, key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: emailLogsTable.id })
    .from(emailLogsTable)
    .where(and(
      eq(emailLogsTable.entity_type, "cs_ticket"),
      eq(emailLogsTable.entity_id, ticketId),
      eq(emailLogsTable.template_code, key),
    ))
    .limit(1);
  return !!row;
}

/** 응답 목표 시간. 긴급도별로 다르게 약속한다 — 지키지 못할 약속은 안 하느니만 못하다. */
function responseHours(priority: string): number {
  const h = { Urgent: 4, High: 8, Normal: 24, Low: 48 } as Record<string, number>;
  return h[priority] ?? 24;
}

/**
 * 문의 접수 확인. 티켓 생성 직후 호출한다.
 * 게스트 이메일이 없으면 보내지 않는다(파트너는 별도 경로에서 이메일을 넘긴다).
 */
export async function notifyCsTicketReceived(ticketId: number): Promise<void> {
  try {
    const [t] = await db
      .select({
        id: csTicketsTable.id,
        ref: csTicketsTable.ticket_ref,
        subject: csTicketsTable.subject,
        category: csTicketsTable.category,
        priority: csTicketsTable.priority,
        lang: csTicketsTable.customer_language,
        requesterType: csTicketsTable.requester_type,
        guestId: csTicketsTable.guest_user_id,
        email: guestUsersTable.email,
        firstName: guestUsersTable.first_name,
        lastName: guestUsersTable.last_name,
      })
      .from(csTicketsTable)
      .leftJoin(guestUsersTable, eq(guestUsersTable.id, csTicketsTable.guest_user_id))
      .where(eq(csTicketsTable.id, ticketId))
      .limit(1);

    if (!t) return;
    if (!t.email) {
      console.log(`[cs] 접수 확인 건너뜀 — 수신 이메일 없음 (티켓 ${t.ref})`);
      return;
    }

    const key = keyFor("received", t.requesterType);
    if (await alreadySent(t.id, key)) return;

    const name = [t.lastName, t.firstName].filter(Boolean).join(" ") || "고객";
    await sendCsEmail({
      to: t.email,
      toName: name,
      templateKey: key,
      ticketId: t.id,
      lang: t.lang,
      vars: {
        recipient: name,
        ref: t.ref,
        subject_line: t.subject,
        category: t.category,
        response_hours: responseHours(t.priority),
        url: `${process.env.PORTAL_URL ?? ""}/support/${t.ref}`,
      },
    });
  } catch (err) {
    // 알림 실패가 티켓 생성을 되돌리면 안 된다.
    console.error(`[cs] 접수 확인 발송 실패 (티켓 ${ticketId}):`, err);
  }
}

/** 처리 완료 통보. 상태가 Resolved/Closed 로 바뀔 때 호출한다. */
export async function notifyCsTicketResolved(
  ticketId: number,
  opts: { actionTaken?: string; resolution?: string } = {},
): Promise<void> {
  try {
    const [t] = await db
      .select({
        id: csTicketsTable.id,
        ref: csTicketsTable.ticket_ref,
        lang: csTicketsTable.customer_language,
        requesterType: csTicketsTable.requester_type,
        email: guestUsersTable.email,
        firstName: guestUsersTable.first_name,
        lastName: guestUsersTable.last_name,
      })
      .from(csTicketsTable)
      .leftJoin(guestUsersTable, eq(guestUsersTable.id, csTicketsTable.guest_user_id))
      .where(eq(csTicketsTable.id, ticketId))
      .limit(1);

    if (!t?.email) return;

    const key = keyFor("resolved", t.requesterType);
    if (await alreadySent(t.id, key)) return;

    const name = [t.lastName, t.firstName].filter(Boolean).join(" ") || "고객";
    await sendCsEmail({
      to: t.email,
      toName: name,
      templateKey: key,
      ticketId: t.id,
      lang: t.lang,
      vars: {
        recipient: name,
        ref: t.ref,
        action_taken: opts.actionTaken ?? "요청하신 내용을 확인하고 처리했습니다.",
        resolution: opts.resolution ?? "처리 완료",
        url: `${process.env.PORTAL_URL ?? ""}/support/${t.ref}`,
      },
    });
  } catch (err) {
    console.error(`[cs] 처리 완료 발송 실패 (티켓 ${ticketId}):`, err);
  }
}
