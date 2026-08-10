/**
 * 고객 ID 채번 — `MH2607C001`.
 *
 *     [테넌트접두사 2][YY][MM][유형 1][일련 3]
 *
 * 접두사는 인스턴스 고정값(`PARTY_CODE_PREFIX`, Metheim=MH), YYMM은 **최초 등록**
 * 연월, 유형은 C 개인 / B 기업, 일련은 `001`~`999` 다음 `A01`~`Z99`다. 한 (접두사·
 * 연월·유형) 조합이 담을 수 있는 최대치는 3,573건.
 *
 * 번호는 DB가 정한다. 라우트가 직접 조립하거나 사람이 손으로 부여하지 않고,
 * 폐기된 번호를 다시 쓰지도 않는다 — 서류 파일명과 보관 폴더가 이 값을 물고 있어서
 * 한 번 나간 번호가 다른 상대를 가리키면 과거 서류의 뜻이 바뀐다.
 */
import { db, partyCodesTable, accountsTable, contactsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/** 번호를 받는 레코드 종류. */
export type PartyEntity = "account" | "contact";

/** C 개인 / B 기업·파트너·B2B. */
export type PartyType = "C" | "B";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** 001~999. */
const NUMERIC_RUN = 999;
/** A01~Z99. */
const LETTER_RUN = LETTERS.length * 99;
export const MAX_PARTY_SEQ = NUMERIC_RUN + LETTER_RUN; // 3,573

/** 인스턴스 접두사. 2자 대문자로 강제한다 — 자리수가 흔들리면 ID가 흔들린다. */
export function partyCodePrefix(): string {
  const raw = (process.env["PARTY_CODE_PREFIX"] || "MS").toUpperCase().replace(/[^A-Z]/g, "");
  return (raw.slice(0, 2) || "MS").padEnd(2, "X");
}

/**
 * 0 → `001`, 998 → `999`, 999 → `A01`, 1097 → `A99`, 1098 → `B01`, 3572 → `Z99`.
 *
 * 3,573건을 넘기면 규칙이 표현할 수 있는 범위를 벗어난다. 조용히 겹치게 두느니
 * 자리수를 늘려서라도 구분되게 한다 — 실무에서 한 달에 이만큼 등록되는 일은 없다.
 */
export function partySerialLabel(seq: number): string {
  if (seq < NUMERIC_RUN) return String(seq + 1).padStart(3, "0");
  const k = seq - NUMERIC_RUN;
  if (k < LETTER_RUN) {
    const letter = LETTERS[Math.floor(k / 99)];
    return `${letter}${String((k % 99) + 1).padStart(2, "0")}`;
  }
  return `Z99-${seq + 1}`;
}

/** `2026-07-14T…` → `2607`. 값이 없으면 오늘. */
export function periodOf(registeredAt?: string | Date | null): string {
  const d =
    registeredAt instanceof Date
      ? registeredAt
      : registeredAt
        ? new Date(registeredAt)
        : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const tz = process.env["DOC_TZ"] || process.env["TZ"] || "Asia/Seoul";
  // en-CA → YYYY-MM-DD, 그래서 테넌트 타임존 기준 연월을 문자열 조립 없이 얻는다.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(safe);
  return `${iso.slice(2, 4)}${iso.slice(5, 7)}`;
}

/**
 * 계정의 유형 판정. 사업자등록번호가 있거나 태생이 B2B인 계정은 기업(B)이고,
 * 나머지(세입자·게스트·개인 소유주)는 개인(C)이다.
 */
const B2B_ACCOUNT_TYPES = new Set(["Agent", "Partner", "ServiceHost"]);

export function accountPartyType(account: {
  account_type?: string | null;
  biz_registration_no?: string | null;
}): PartyType {
  if (account.biz_registration_no && String(account.biz_registration_no).trim()) return "B";
  return B2B_ACCOUNT_TYPES.has(String(account.account_type ?? "")) ? "B" : "C";
}

export interface PartyCodeInput {
  entityType: PartyEntity;
  entityId: number;
  /** 최초 등록 시각. 레코드의 created_at을 넘긴다. */
  registeredAt?: string | Date | null;
  partyType?: PartyType;
}

function buildCode(prefix: string, period: string, type: PartyType, seq: number): string {
  return `${prefix}${period}${type}${partySerialLabel(seq)}`;
}

/** 이미 부여된 번호를 읽는다. 없으면 null — 여기서는 채번하지 않는다. */
export async function readPartyCode(
  entityType: PartyEntity,
  entityId: number,
): Promise<string | null> {
  if (!entityId || !Number.isFinite(entityId)) return null;
  try {
    const [row] = await db
      .select({ code: partyCodesTable.code })
      .from(partyCodesTable)
      .where(and(eq(partyCodesTable.entity_type, entityType), eq(partyCodesTable.entity_id, entityId)))
      .limit(1);
    return row?.code ?? null;
  } catch (err) {
    console.error("[partyCode] read failed:", err);
    return null;
  }
}

/**
 * 번호를 돌려준다. 처음이면 채번하고, 이미 있으면 그것을 그대로 준다.
 *
 * 채번에 실패해도 호출자를 막지 않는다(null) — 문서 발행이 번호 하나 때문에
 * 멈추는 것보다 번호 없는 이름으로라도 나가는 편이 낫다.
 */
export async function resolvePartyCode(args: PartyCodeInput): Promise<string | null> {
  const { entityType, entityId } = args;
  if (!entityId || !Number.isFinite(entityId)) return null;

  const existing = await readPartyCode(entityType, entityId);
  if (existing) return existing;

  try {
    const meta = await loadPartyMeta(entityType, entityId, args);
    if (!meta) return null;
    const prefix = partyCodePrefix();

    // 다음 빈 자리. 유니크 인덱스가 최종 심판이라 경합해서 지면 다시 뽑는다.
    for (let attempt = 0; attempt < 8; attempt++) {
      const [{ next: peek } = { next: 0 }] = await db
        .select({ next: sql<number>`coalesce(max(${partyCodesTable.seq}), -1) + 1` })
        .from(partyCodesTable)
        .where(and(
          eq(partyCodesTable.prefix, prefix),
          eq(partyCodesTable.period, meta.period),
          eq(partyCodesTable.party_type, meta.partyType),
        ));
      const next = Number(peek) + attempt;
      const code = buildCode(prefix, meta.period, meta.partyType, next);
      try {
        await db.insert(partyCodesTable).values({
          entity_type: entityType,
          entity_id: entityId,
          code,
          prefix,
          period: meta.period,
          party_type: meta.partyType,
          seq: next,
        });
        return code;
      } catch {
        // 같은 레코드를 두 요청이 동시에 등록했다면 번호는 이미 정해졌다.
        const raced = await readPartyCode(entityType, entityId);
        if (raced) return raced;
        // 일련번호만 겹친 경우 — 루프가 다음 값으로 재시도한다.
      }
    }
  } catch (err) {
    console.error("[partyCode] allocation failed:", err);
  }
  return null;
}

/** 채번에 필요한 연월·유형을 레코드에서 읽는다. */
async function loadPartyMeta(
  entityType: PartyEntity,
  entityId: number,
  args: PartyCodeInput,
): Promise<{ period: string; partyType: PartyType } | null> {
  if (args.registeredAt && args.partyType) {
    return { period: periodOf(args.registeredAt), partyType: args.partyType };
  }
  if (entityType === "account") {
    const [acc] = await db
      .select({
        account_type: accountsTable.account_type,
        biz_registration_no: accountsTable.biz_registration_no,
        created_at: accountsTable.created_at,
      })
      .from(accountsTable)
      .where(eq(accountsTable.id, entityId))
      .limit(1);
    if (!acc) return null;
    return {
      period: periodOf(args.registeredAt ?? acc.created_at),
      partyType: args.partyType ?? accountPartyType(acc),
    };
  }
  const [c] = await db
    .select({ created_at: contactsTable.created_at })
    .from(contactsTable)
    .where(eq(contactsTable.id, entityId))
    .limit(1);
  if (!c) return null;
  // 연락처는 사람이다 — 언제나 개인(C).
  return { period: periodOf(args.registeredAt ?? c.created_at), partyType: args.partyType ?? "C" };
}

/** `^[A-Z]{2}[0-9]{4}[CB]([0-9]{3}|[A-Z][0-9]{2})$` */
export const PARTY_CODE_RE = /^[A-Z]{2}\d{4}[CB](?:\d{3}|[A-Z]\d{2})$/;

export function isPartyCode(value: string): boolean {
  return PARTY_CODE_RE.test(String(value ?? ""));
}
