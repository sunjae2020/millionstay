import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  accountsTable,
  contactsTable,
  contractRelatedCostsTable,
  contractsTable,
  rentalFeeSchedulesTable,
  spacesTable,
} from "@workspace/db";
import { DEFAULT_CURRENCY } from "./currency";

/**
 * 계약 경로(acquisition channel) — 이 계약이 어떻게 성사됐는가.
 *
 * 값은 임대 수수료 기준표(rental_fee_schedules)의 세 열과 맞물린다:
 *   brokerage → 중개수수료(부동산)  brokerage_fee × (1 + 간이과세 가산율)
 *   self      → 자체수수료          self_fee      × (1 − 원천징수율)
 *   online    → Working(직접 모객)  working_fee   (자체가 부동산 몫까지 흡수한 고정액)
 *   renewal   → 기준표 없음 — 기존 세입자 재계약이라 모객 수수료가 발생하지 않는 것이
 *               보통이고, 수고비를 줄 때도 금액이 건마다 달라 사람이 직접 넣는다.
 *   other     → 기준표 없음 — 금액은 사람이 직접 넣는다.
 *
 * `cost_type` 은 관련 비용에 자동 적재될 때 쓰는 한글 비용 항목명이고, 임대 수수료
 * 대사(/v1/rental-fee-schedules/reconciliation)가 집계하는 두 버킷과 같은 값이라
 * 자동 생성된 행이 대사에도 그대로 잡힌다.
 */
export const ACQUISITION_CHANNELS = ["brokerage", "self", "renewal", "online", "other"] as const;
export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

const CHANNEL_COST_TYPE: Record<AcquisitionChannel, string> = {
  brokerage: "부동산수수료",
  self: "임대수수료",
  renewal: "임대수수료",
  online: "임대수수료",
  other: "임대수수료",
};

/** 기준표가 없어 금액을 사람이 넣는 경로. */
const MANUAL_FEE_CHANNELS = new Set<AcquisitionChannel>(["renewal", "other"]);

export function isManualFeeChannel(channel: AcquisitionChannel): boolean {
  return MANUAL_FEE_CHANNELS.has(channel);
}

export function isAcquisitionChannel(v: unknown): v is AcquisitionChannel {
  return typeof v === "string" && (ACQUISITION_CHANNELS as readonly string[]).includes(v);
}

/** 관련 비용에 적재될 비용 항목명. */
export function channelCostType(channel: AcquisitionChannel): string {
  return CHANNEL_COST_TYPE[channel];
}

/**
 * 세대 타입에 해당하는 기준표 행을 찾는다. "A,B" 행이 A / A-1 을 함께 덮으므로
 * 타입명의 앞 알파벳으로 맞춘다(대사 화면과 같은 규칙).
 */
function scheduleFor<T extends { type_label: string }>(schedules: T[], typeName: string | null): T | null {
  if (!typeName) return null;
  const letter = (typeName.match(/^[A-Za-z]+/) ?? [""])[0].toUpperCase();
  if (!letter) return null;
  return schedules.find((s) => s.type_label.split(/[,\s]+/).some((l) => l.trim().toUpperCase() === letter)) ?? null;
}

export interface ChannelFee {
  /** 기준표에서 계산된 예상 수수료(원 단위 반올림). 기준표가 없으면 null. */
  amount: number | null;
  currency: string;
  /** 매칭된 기준표 행 라벨("A,B" 등). 매칭 실패 시 null. */
  type_label: string | null;
  /** 기준표 매칭에 쓰인 세대 타입명. */
  unit_type: string | null;
}

/**
 * 계약의 세대 타입 × 경로로 기준 수수료를 계산한다.
 *
 * 세대 타입은 단위 세대의 custom_type_name, 없으면 상위 타입 공간의 이름을 쓴다
 * (Metheim 은 타입을 부모 공간으로 모델링한다 — docs/tenants/metheim/UNIT_INVENTORY.md).
 */
export async function resolveChannelFee(
  spaceId: number | null | undefined,
  channel: AcquisitionChannel,
): Promise<ChannelFee> {
  const empty: ChannelFee = { amount: null, currency: DEFAULT_CURRENCY, type_label: null, unit_type: null };
  if (isManualFeeChannel(channel) || !spaceId) return empty;

  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) return empty;
  let unitType = space.custom_type_name ?? null;
  if (!unitType && space.parent_space_id) {
    const [parent] = await db.select({ name: spacesTable.name }).from(spacesTable)
      .where(eq(spacesTable.id, space.parent_space_id));
    unitType = parent?.name ?? null;
  }

  const schedules = await db.select().from(rentalFeeSchedulesTable)
    .where(and(isNull(rentalFeeSchedulesTable.deleted_at), eq(rentalFeeSchedulesTable.status, "Active")));
  const sched = scheduleFor(schedules, unitType);
  if (!sched) return { ...empty, unit_type: unitType };

  const raw =
    channel === "brokerage" ? sched.brokerage_fee * (1 + sched.brokerage_surcharge_rate / 100)
    : channel === "self" ? sched.self_fee * (1 - sched.self_withholding_rate / 100)
    : sched.working_fee;

  return {
    amount: Math.round(raw),
    currency: sched.currency || DEFAULT_CURRENCY,
    type_label: sched.type_label,
    unit_type: unitType,
  };
}

/** 계정에서 이름/연락처/이메일을 읽어온다 — 대표 연락처가 있으면 그쪽을 먼저 본다. */
export async function channelContactFromAccount(accountId: number): Promise<{
  name: string; phone: string; email: string;
} | null> {
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account) return null;
  let contact: typeof contactsTable.$inferSelect | undefined;
  if (account.primary_contact_id) {
    [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, account.primary_contact_id));
  }
  return {
    name: account.name ?? "",
    phone: contact?.mobile_number || account.phone1 || account.phone2 || "",
    email: contact?.email || account.account_email || "",
  };
}

/**
 * 계약 경로에서 파생되는 관련 비용 행(origin='channel')을 계약과 맞춘다.
 *
 * 규칙:
 *  - 경로가 정해져 있으면 행이 없을 때 만들고, 있으면 항목·수취인·계정을 갱신한다.
 *    수취인·기준표가 없어도 금액 0 인 행을 만들어 둔다 — 수수료가 빠진 계약이
 *    조용히 지나가는 것보다, 0 원짜리 미지급 행이 눈에 띄는 편이 낫다.
 *  - 금액은 **만들 때만** 기준표에서 채운다. 이미 있는 행의 금액은 사람이 고쳐 쓸 수 있으므로
 *    함부로 덮지 않는다 — 다만 경로 자체가 바뀌었고 금액이 예전 경로의 기준액 그대로(=손대지
 *    않은 값)이거나 0 이면 새 경로 기준액으로 다시 계산한다.
 *  - 경로를 지우면 아직 송금 전(remitted_on 없음)인 자동 행만 삭제한다. 이미 송금된 행은
 *    실제로 돈이 나간 기록이므로 남긴다.
 *
 * 송금일(remitted_on)은 자동으로 넣지 않는다 — 비어 있는 동안 화면에 "미지급"으로 뜬다.
 */
export async function syncChannelRelatedCost(
  contract: typeof contractsTable.$inferSelect,
  prevChannel: string | null,
): Promise<void> {
  const [existing] = await db.select().from(contractRelatedCostsTable)
    .where(and(
      eq(contractRelatedCostsTable.contract_id, contract.id),
      eq(contractRelatedCostsTable.origin, "channel"),
      eq(contractRelatedCostsTable.status, "Active"),
    ));

  const channel = contract.acquisition_channel;
  const payeeName = (contract.channel_contact_name ?? "").trim();

  // 경로를 고른 순간 수수료 행은 항상 생긴다 — 수취인이나 기준표가 아직 없어도
  // 마찬가지다. 빈 행이라도 있어야 "이 계약의 수수료는 얼마인가"가 관련 비용
  // 한 곳에서 보이고, 금액 0 · 송금일 없음이 곧 "미지급"으로 잡힌다.
  if (!isAcquisitionChannel(channel)) {
    // 경로 자체를 지웠다 — 아직 송금 전인 자동 행은 거둬들인다.
    if (existing && !existing.remitted_on) {
      await db.update(contractRelatedCostsTable)
        .set({ status: "Deleted", updated_at: new Date() })
        .where(eq(contractRelatedCostsTable.id, existing.id));
    }
    return;
  }

  const fee = await resolveChannelFee(contract.space_id, channel);
  const costType = channelCostType(channel);

  if (!existing) {
    await db.insert(contractRelatedCostsTable).values({
      contract_id: contract.id,
      cost_type: costType,
      remitted_on: null,
      payee_name: payeeName,   // 아직 못 정했으면 빈 칸 — 관련 비용 탭에서 채운다.
      account_id: contract.channel_account_id ?? null,
      amount: fee.amount ?? 0,
      currency: contract.currency || fee.currency,
      note: "",
      origin: "channel",
      status: "Active",
    });
    return;
  }

  const channelChanged = prevChannel !== channel;
  let amount = existing.amount;
  if (channelChanged) {
    const prevFee = isAcquisitionChannel(prevChannel)
      ? await resolveChannelFee(contract.space_id, prevChannel)
      : null;
    const untouched = Number(existing.amount) === 0 || Number(existing.amount) === (prevFee?.amount ?? null);
    if (untouched && fee.amount != null) amount = fee.amount;
  }

  await db.update(contractRelatedCostsTable).set({
    cost_type: costType,
    // 계약에 수취인이 비어 있다고 해서 관련 비용 탭에 손으로 적어 둔 이름을 지우지는 않는다.
    payee_name: payeeName || existing.payee_name,
    account_id: contract.channel_account_id ?? null,
    amount,
    updated_at: new Date(),
  }).where(eq(contractRelatedCostsTable.id, existing.id));
}
