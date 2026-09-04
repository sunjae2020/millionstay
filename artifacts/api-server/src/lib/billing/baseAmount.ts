// 기준통화 환산액 스탬프.
//
// 통화가 섞인 원장에서 합계를 내려면 공통 축이 있어야 한다. 그 축은 거래
// **시점**에 박아 두어야 한다 — 나중에 다시 계산하면 그때의 환율이 적용돼 과거
// 장부가 조용히 바뀐다.
//
// ⚠️ 환율을 못 구하면 전부 NULL 로 둔다. 절대 1 로 채우지 않는다. 1 은 "환산했는데
// 값이 같았다"는 뜻이라 결측과 구분되지 않고, 그렇게 채운 값은 합계에 섞여 들어가
// 아무도 눈치채지 못한다. NULL 이면 "환산 못 했다"가 화면에 드러난다.
import { getRateToAud } from "../rateSnapshot";
import { DEFAULT_CURRENCY } from "../currency";

export type BaseAmountStamp = {
  base_currency: string | null;
  base_amount: string | null;
  fx_rate: string | null;
  fx_date: string | null;
};

const EMPTY: BaseAmountStamp = { base_currency: null, base_amount: null, fx_rate: null, fx_date: null };

/**
 * 거래 금액을 인스턴스 기준통화로 환산해 스탬프를 만든다.
 *
 * 환율표는 AUD 를 축으로 저장돼 있으므로(1 X = N AUD), 기준통화가 AUD 가 아니면
 * 두 번 환산한다: 거래통화 → AUD → 기준통화.
 */
export async function stampBaseAmount(
  amount: number,
  currency: string,
  onDate: string,
): Promise<BaseAmountStamp> {
  const base = DEFAULT_CURRENCY;
  const from = (currency || base).toUpperCase();
  const date = (onDate || new Date().toISOString()).slice(0, 10);

  if (from === base) {
    return { base_currency: base, base_amount: amount.toFixed(2), fx_rate: "1", fx_date: date };
  }

  const fromToAud = await getRateToAud(from);
  if (!fromToAud) return EMPTY;

  let rate = Number(fromToAud);
  if (base !== "AUD") {
    const baseToAud = await getRateToAud(base);
    if (!baseToAud || Number(baseToAud) <= 0) return EMPTY;
    // 1 from = fromToAud AUD, 1 base = baseToAud AUD  →  1 from = (fromToAud / baseToAud) base
    rate = Number(fromToAud) / Number(baseToAud);
  }
  if (!Number.isFinite(rate) || rate <= 0) return EMPTY;

  return {
    base_currency: base,
    base_amount: (amount * rate).toFixed(2),
    fx_rate: rate.toFixed(8),
    fx_date: date,
  };
}
