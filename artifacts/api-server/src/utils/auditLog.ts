import { db, systemLogsTable } from "@workspace/db";
import { getRequestActor, getRequestIp } from "../lib/requestContext";

export async function logAction({
  entityType,
  entityId,
  action,
  actorId,
  actorEmail,
  oldValue = null,
  newValue = null,
  ipAddress = null,
}: {
  entityType: string;
  entityId: number | string;
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "STATUS_CHANGE"
    | "LOGIN"
    | "PAYMENT"
    | "VERIFY"
    | "BLOCK"
    | "UNBLOCK"
    | "TERM_SET"
    | "TERM_CLEAR"
    | "AUTO_CREATED"
    | "ADD_SERVICE"
    | "REMOVE_SERVICE"
    | "SCHEDULE_ADD"
    | "SCHEDULE_UPDATE"
    | "SCHEDULE_DELETE"
    | "ADD_DEFECT"
    | "REMOVE_DEFECT";
  actorId?: number | null;
  actorEmail?: string | null;
  oldValue?: object | null;
  newValue?: object | null;
  ipAddress?: string | null;
}): Promise<void> {
  // 행위자는 호출부가 넘긴 값이 우선이고, 없으면 요청 컨텍스트에서 가져온다.
  // 호출부 214곳 중 절반이 actorId 를 넘기지 않아 "누가"가 비어 있었다 —
  // 매번 손으로 넘기게 하는 대신 인증 미들웨어가 심어 둔 값을 쓴다.
  // 관리자 id 만 actor_id 에 넣는다(파트너·게스트 id 는 다른 테이블이라 섞으면 안 된다).
  const ctx = getRequestActor();
  const resolvedId = actorId ?? (ctx?.type === "User" ? ctx.id : null) ?? null;
  const resolvedEmail = actorEmail ?? ctx?.email ?? null;
  const resolvedType = actorId
    ? "User"
    : (ctx?.type ?? (resolvedEmail ? "User" : "System"));

  try {
    await db.insert(systemLogsTable).values({
      entity_type: entityType,
      entity_id: Number(entityId),
      action,
      actor_type: resolvedType,
      actor_id: resolvedId,
      actor_email: resolvedEmail,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      ip_address: ipAddress ?? getRequestIp(),
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
