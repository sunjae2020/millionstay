import { db, systemLogsTable } from "@workspace/db";

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
  try {
    await db.insert(systemLogsTable).values({
      entity_type: entityType,
      entity_id: Number(entityId),
      action,
      actor_type: actorId ? "User" : "System",
      actor_id: actorId ?? null,
      actor_email: actorEmail ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      ip_address: ipAddress ?? null,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
