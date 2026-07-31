/**
 * 계약서 서명 방식 정책 — 온라인 서명이 되는 계약과 안 되는 계약을 가른다.
 *
 * 운영 규칙(2026-07 확정)
 *  - **단기 체류(1달 이하)**: 4박5일 휴가·한달살기처럼 짧은 체류는 온라인 서명으로
 *    끝낸다. 서식은 자사 **일반 임대차계약서**를 쓴다 — 숙박에 가까워 정부 표준
 *    서식(주택임대차·민간임대주택)의 대상이 아니고, 기존 HTML 서명 스냅숏
 *    (contract_signing_requests.signed_snapshot)을 그대로 쓸 수 있다.
 *  - **1달 초과**: 계약서를 출력해 작성·날인(도장/인감)한 뒤 스캔해서 서류함에
 *    보관한다. 온라인 서명을 열어 주지 않는다.
 *
 * 자동 판정은 계약기간으로 하고, 경계 사례(예: 35일 한달살기)는 담당자가
 * `contracts.signing_mode` 로 뒤집을 수 있다 — 사유는 `signing_mode_reason` 에
 * 남겨 감사에 대비한다.
 *
 * 이 판정이 정본이다. 어드민은 계약 상세 응답의 `signing_policy` 를 그대로 쓰고,
 * 위저드 미리보기용으로만 같은 규칙을 화면에서 흉내 낸다.
 */

/** 이 일수까지를 "단기 체류"로 본다(양 끝 포함). */
export const SHORT_TERM_MAX_DAYS = 31;

/** online = 온라인 서명, wet = 출력 후 수기 날인. */
export type SigningMode = "online" | "wet";

/** 온라인 서명을 막은 이유. */
export type SigningBlockedReason =
  /** 1달 초과 체류 — 출력·날인 대상. */
  | "long_term"
  /** 정부 표준 서식은 원본 PDF 오버레이라 HTML 서명 스냅숏을 만들 수 없다. */
  | "government_form"
  /** 기간이 비어 있어 단기인지 판단할 수 없다. */
  | "term_unknown"
  /** 담당자가 직접 "출력 후 날인"으로 지정했다. */
  | "manual_override";

export interface SigningPolicy {
  /** 실제 적용되는 방식(수동 재지정이 있으면 그 값). */
  mode: SigningMode;
  /** 계약기간만으로 계산한 방식. */
  auto: SigningMode;
  /**
   * 담당자가 서명 방식을 명시 지정했는지.
   *
   * 자동 판정과 값이 같아도 참이다 — 지정값이 저장돼 있으면 나중에 기간이 바뀌어도
   * 자동 판정으로 돌아오지 않으므로, 화면이 "자동 판정"처럼 보이면 안 된다.
   */
  overridden: boolean;
  override_reason: string | null;
  /** 계약기간 일수(양 끝 포함). 기간이 비었으면 null. */
  term_days: number | null;
  /** 온라인 서명 요청을 발행할 수 있는지. */
  online_allowed: boolean;
  blocked_reason: SigningBlockedReason | null;
}

/** 정부 배포 원본 서식 — HTML 표현이 없어 온라인 서명 대상이 아니다. */
function isGovernmentForm(leaseForm: string | null | undefined): boolean {
  return leaseForm === "housing_standard" || leaseForm === "mlt_standard";
}

/** 계약기간 일수(양 끝 포함). 날짜가 없거나 뒤집혀 있으면 null. */
export function termDays(startDate: string | null | undefined, endDate: string | null | undefined): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

export interface SigningPolicyInput {
  start_date?: string | null;
  end_date?: string | null;
  lease_form?: string | null;
  /** 수동 재지정. null 이면 자동 판정을 따른다. */
  signing_mode?: string | null;
  signing_mode_reason?: string | null;
}

export function resolveSigningPolicy(row: SigningPolicyInput): SigningPolicy {
  const days = termDays(row.start_date, row.end_date);
  // 기간을 모르면 안전한 쪽(출력·날인)으로 기운다.
  const auto: SigningMode = days != null && days <= SHORT_TERM_MAX_DAYS ? "online" : "wet";
  const override = row.signing_mode === "online" || row.signing_mode === "wet" ? row.signing_mode : null;
  const mode: SigningMode = override ?? auto;

  let blocked: SigningBlockedReason | null = null;
  if (mode === "wet") {
    // 사유는 실제로 막은 것을 가리켜야 한다 — 5일짜리 계약을 담당자가 날인으로
    // 돌려놓고 "1달을 초과해서"라고 안내하면 안 된다.
    blocked = override === "wet" ? "manual_override"
      : days == null ? "term_unknown"
      : "long_term";
  } else if (isGovernmentForm(row.lease_form)) {
    blocked = "government_form";
  }

  return {
    mode,
    auto,
    overridden: override != null,
    override_reason: row.signing_mode_reason ?? null,
    term_days: days,
    online_allowed: blocked == null,
    blocked_reason: blocked,
  };
}

/** 사람이 읽을 수 있는 차단 사유 — API 오류 메시지에 쓴다. */
export const SIGNING_BLOCKED_MESSAGE: Record<SigningBlockedReason, string> = {
  long_term:
    "1달을 초과하는 계약은 온라인 서명 대상이 아닙니다. 계약서를 출력해 작성·날인한 뒤 서명본 스캔을 올려 주세요.",
  government_form:
    "정부 표준 서식(주택임대차표준계약서·민간임대주택 표준임대차계약서)은 온라인 서명을 지원하지 않습니다. 출력해 날인한 뒤 서명본 스캔을 올려 주세요.",
  term_unknown:
    "계약 시작일과 종료일을 먼저 채워 주세요. 단기(1달 이하) 계약인지 확인되어야 온라인 서명을 발행할 수 있습니다.",
  manual_override:
    "이 계약은 “출력 후 날인”으로 지정되어 있습니다. 온라인 서명이 필요하면 계약서 발행 위저드에서 서명 방식을 바꿔 주세요.",
};
