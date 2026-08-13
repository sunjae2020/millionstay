import type { TFunction } from "i18next";

/**
 * 계약 경로 — 이 계약이 어떤 경로로 성사됐는가. 계약 상세에서 하나만 고른다.
 *
 * 서버(artifacts/api-server/src/lib/acquisitionChannel.ts)와 같은 값 집합이며,
 * 임대 수수료 기준표(Settings → 임대 수수료)의 세 열과 맞물려 관련 비용에 적재될
 * 수수료 기준액이 계산된다:
 *   brokerage → 중개수수료(부동산)   self → 자체수수료   online → Working(직접 모객)
 *   renewal / other → 기준표 없음, 금액은 직접 입력
 *
 * `contract_category`(계약서 구분)나 `lease_mode`(임대 유형)와는 직교한다 —
 * 저쪽은 계약의 성격, 이쪽은 계약을 데려온 경로다.
 */
export interface AcquisitionChannelDef {
  value: string;
  labelKey: string;
  /** 라디오 아래에 붙는 한 줄 설명. */
  hintKey: string;
  /** 배지 색. 화면마다 색이 어긋나지 않게 값 옆에 둔다. */
  color: string;
}

export const ACQUISITION_CHANNELS: AcquisitionChannelDef[] = [
  { value: "brokerage", labelKey: "contract.channel_brokerage", hintKey: "contract.channel_brokerage_hint", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "self", labelKey: "contract.channel_self", hintKey: "contract.channel_self_hint", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "renewal", labelKey: "contract.channel_renewal", hintKey: "contract.channel_renewal_hint", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "online", labelKey: "contract.channel_online", hintKey: "contract.channel_online_hint", color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "other", labelKey: "contract.channel_other", hintKey: "contract.channel_other_hint", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

/**
 * 기준표에서 금액이 나오지 않는 경로 — 서버의 MANUAL_FEE_CHANNELS 와 같은 집합이다.
 * 연장은 기존 세입자 재계약이라 모객 수수료가 없는 것이 보통이고, 기타는 정의상 열려 있다.
 */
export const MANUAL_FEE_CHANNELS = new Set(["renewal", "other"]);

/** 알 수 없는 값(과거 이관 데이터 등)은 지워 버리지 말고 그대로 읽히게 둔다. */
export function acquisitionChannelLabel(t: TFunction, value?: string | null): string {
  if (!value) return "—";
  const def = ACQUISITION_CHANNELS.find((d) => d.value === value);
  return def ? t(def.labelKey) : value;
}

export function acquisitionChannelColor(value?: string | null): string {
  return ACQUISITION_CHANNELS.find((d) => d.value === value)?.color ?? "bg-gray-100 text-gray-700 border-gray-200";
}
