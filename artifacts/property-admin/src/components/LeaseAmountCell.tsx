import { useTranslation } from "react-i18next";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

/**
 * 리스트의 "금액" 한 칸 — 장기/단기가 섞인 목록에서 각 행이 자기 문법으로 읽히게 한다.
 *
 *   [장기] ₩350,000/월 · 보증금 ₩3,000,000
 *   [단기] ₩80,000/일 · 총 ₩2,400,000
 *
 * 컬럼을 유형별로 쪼개면 어느 쪽을 보든 절반이 빈칸이 되므로, 배지 + 한 칸으로
 * 합치고 정렬만 월 환산액으로 통일한다(monthlyEquivalent).
 */
export interface LeaseAmountRecord {
  lease_mode?: string | null;
  rate_period?: string | null;
  rate_amount?: number | string | null;
  /** 계약은 bond_amount, 예약은 deposit_amount 로 보증금을 든다. */
  bond_amount?: number | string | null;
  deposit_amount?: number | string | null;
  monthly_rent?: number | string | null;
  total_rent?: number | string | null;
  agreed_weekly_rate?: number | string | null;
  weekly_rate?: number | string | null;
  currency?: string | null;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 백필 전(lease_mode = NULL) 행은 월세 유무로 유형을 갈음한다. */
export function leaseModeOf(r: LeaseAmountRecord): "long" | "short" {
  if (r.lease_mode === "long" || r.lease_mode === "short") return r.lease_mode;
  return (num(r.monthly_rent) ?? 0) > 0 ? "long" : "short";
}

/** 정렬·비교용 월 환산액. 유형이 달라도 한 축으로 줄 세운다. */
export function monthlyEquivalent(r: LeaseAmountRecord): number {
  if (leaseModeOf(r) === "long") return num(r.monthly_rent) ?? 0;
  const amount = num(r.rate_amount) ?? num(r.agreed_weekly_rate) ?? num(r.weekly_rate);
  if (amount == null) return 0;
  switch (r.rate_period ?? "weekly") {
    case "daily": return (amount * 365) / 12;
    case "monthly": return amount;
    default: return (amount * 52) / 12;
  }
}

export function LeaseAmountCell({ record }: { record: LeaseAmountRecord }) {
  const { t } = useTranslation();
  const { currency: brandCurrency, currencyPosition } = useBrand();
  const currency = record.currency || brandCurrency;
  const mode = leaseModeOf(record);
  const money = (v: number | string | null | undefined) => formatMoney(num(v), currency, currencyPosition);

  const deposit = num(record.bond_amount) ?? num(record.deposit_amount);
  const primary = mode === "long"
    ? (() => {
        const rent = num(record.monthly_rent);
        return rent != null ? `${money(rent)}${t("lease.per_month_suffix")}` : null;
      })()
    : (() => {
        const amount = num(record.rate_amount) ?? num(record.agreed_weekly_rate) ?? num(record.weekly_rate);
        if (amount == null) return null;
        const suffix = t(`lease.per_${record.rate_period ?? "weekly"}_suffix`);
        return `${money(amount)}${suffix}`;
      })();
  const secondary = mode === "long"
    ? (deposit != null ? `${t("lease.deposit_short")} ${money(deposit)}` : null)
    : (num(record.total_rent) != null ? `${t("lease.total_short")} ${money(record.total_rent)}` : null);

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        mode === "long" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        {t(mode === "long" ? "lease.mode_long" : "lease.mode_short")}
      </span>
      <span className="text-sm tabular-nums">
        {primary ?? "—"}
        {secondary && <span className="text-muted-foreground"> · {secondary}</span>}
      </span>
    </div>
  );
}
