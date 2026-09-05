import { sql } from "drizzle-orm";
import { db, fixedAssetsTable } from "@workspace/db";

// 자산대장 계산기 — FIN-001 제11조.
//
// 감가상각액은 저장하지 않는다. 취득원가·내용연수·기준일에서 나오는 파생값이라
// 저장해 두면 기준일이 바뀔 때마다 장부와 계산이 갈라진다. 읽는 시점에 센다.

/** 자산 계상 기준(제11조 제1·2항): 거래단위 100만원 초과 + 내용연수 1년 이상. */
export const CAPITALISATION_THRESHOLD_KRW = 1_000_000;

/** 자산으로 잡히는 계정과목. 212 비품 / 202 건물. */
export const ASSET_ACCOUNTS = new Set(["212", "202"]);

/** 계정과목별 기본 내용연수(년). 한국 세무 실무의 통상 기준. */
export const DEFAULT_USEFUL_LIFE: Record<string, number> = {
  "212": 5,  // 비품
  "202": 40, // 건물
};

/**
 * 이 지출이 자산으로 잡혀야 하는가.
 *
 * 계정과목이 자산 계정이면 금액과 무관하게 자산이다(사람이 이미 그렇게 골랐다).
 * 자본적 지출로 표시된 건도 마찬가지다 — 제9조에서 자본적이라고 판정한 순간
 * 그것은 비용이 아니라 건물에 가산되는 금액이다.
 * 비용 계정에 남아 있으면서 금액만 큰 건은 자산이 아니다 — 소모품은 1억어치를
 * 사도 소모품이다.
 */
export function shouldCapitalise(input: {
  glAccountCode: string | null;
  expenditureKind: string | null;
  amount: number;
  currency: string;
}): boolean {
  if (input.glAccountCode && ASSET_ACCOUNTS.has(input.glAccountCode)) return true;
  if (input.expenditureKind === "capital") return true;
  return false;
}

/** 취득가액이 즉시 비용 처리(소액자산 즉시상각) 범위인지 — 경고용. */
export function isBelowCapitalisationThreshold(amount: number, currency: string): boolean {
  return currency === "KRW" && amount <= CAPITALISATION_THRESHOLD_KRW;
}

export interface Depreciation {
  /** 상각 대상 금액 = 취득원가 − 잔존가액. */
  depreciableBase: number;
  monthlyAmount: number;
  /** 취득월부터 기준일까지 경과 개월(내용연수로 잘린다). */
  elapsedMonths: number;
  accumulated: number;
  bookValue: number;
  fullyDepreciated: boolean;
}

/**
 * 정액법 월할 상각. 취득한 달을 1개월째로 센다(한국 실무의 월할 관행).
 * declining_balance 는 아직 구현하지 않았고, 그 경우도 정액법으로 계산한다 —
 * 잘못된 정률 근사치를 내놓는 것보다 낫다. 화면에 방법이 그대로 표시된다.
 */
export function depreciationAsOf(
  asset: {
    acquired_on: string;
    acquisition_cost: string | number;
    residual_value: string | number;
    useful_life_years: number;
  },
  asOf: Date = new Date(),
): Depreciation {
  const cost = Number(asset.acquisition_cost);
  const residual = Number(asset.residual_value);
  const base = Math.max(cost - residual, 0);
  const months = Math.max(asset.useful_life_years, 0) * 12;

  if (months === 0 || base === 0) {
    return { depreciableBase: base, monthlyAmount: 0, elapsedMonths: 0, accumulated: 0, bookValue: cost, fullyDepreciated: months === 0 ? false : true };
  }

  const acquired = new Date(`${asset.acquired_on}T00:00:00Z`);
  if (Number.isNaN(acquired.getTime())) {
    return { depreciableBase: base, monthlyAmount: 0, elapsedMonths: 0, accumulated: 0, bookValue: cost, fullyDepreciated: false };
  }

  const raw =
    (asOf.getUTCFullYear() - acquired.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - acquired.getUTCMonth()) + 1;
  const elapsed = Math.min(Math.max(raw, 0), months);

  const monthly = round2(base / months);
  // 마지막 달에 반올림 오차가 남지 않도록, 만기에는 상각 대상 금액 전액을 채운다.
  const accumulated = elapsed >= months ? base : round2(monthly * elapsed);

  return {
    depreciableBase: base,
    monthlyAmount: monthly,
    elapsedMonths: elapsed,
    accumulated,
    bookValue: round2(cost - accumulated),
    fullyDepreciated: elapsed >= months,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 자산번호 FA-YYYY-00001. */
export async function nextAssetNo(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(fixedAssetsTable)
    .where(sql`${fixedAssetsTable.asset_no} LIKE ${`FA-${year}-%`}`);
  return `FA-${year}-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
}
