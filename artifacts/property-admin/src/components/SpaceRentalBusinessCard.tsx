import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BadgeCheck } from "lucide-react";
import { apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";

/**
 * 공간 상세 → "임대사업자 등록" 카드.
 *
 * 계정관리 → 임대인·소유주 → 임대사업자 등록증에 등재된 세대라면, 이 호실이 등록된
 * 민간임대주택임을 여기서 바로 확인할 수 있다(등록번호·주택종류·주택등록일·
 * 임대개시일). 등재되지 않은 세대에서는 아무것도 그리지 않는다 — 임대사업자
 * 등록을 쓰지 않는 인스턴스에서 빈 카드가 남지 않도록.
 */

interface RegisteredUnit {
  id: number;
  unit_no: string;
  housing_kind: string | null;
  housing_type: string | null;
  exclusive_area_label: string | null;
  registered_on: string | null;
  lease_started_on: string | null;
  registration_history: string | null;
  registration: Registration | null;
}

interface Registration {
  id: number;
  account_id: number | null;
  registration_no: string | null;
  operator_name: string | null;
}

export function SpaceRentalBusinessCard({ spaceId }: { spaceId: number }) {
  const { t } = useTranslation();
  const { data } = useQuery<{ data: RegisteredUnit[] }>({
    queryKey: ["rental-business-by-space", spaceId],
    queryFn: () => apiJson(`/api/v1/rental-business/by-space?space_ids=${spaceId}`),
    enabled: Number.isFinite(spaceId) && spaceId > 0,
  });

  const unit = data?.data?.[0];
  if (!unit) return null;
  const registration = unit.registration;

  const fields: Array<[string, string]> = [
    [t("settings_rental_biz.registration_no"), registration?.registration_no || "—"],
    [t("settings_rental_biz.operator_name"), registration?.operator_name || "—"],
    [t("settings_rental_biz.col_unit_no"), unit.unit_no],
    [t("settings_rental_biz.col_housing_kind"), unit.housing_kind ?? "—"],
    [t("settings_rental_biz.col_housing_type"), unit.housing_type ?? "—"],
    [t("settings_rental_biz.col_area"), unit.exclusive_area_label ?? "—"],
    [t("settings_rental_biz.col_registered_on"), unit.registered_on ? formatDate(unit.registered_on) : "—"],
    [t("settings_rental_biz.col_lease_started_on"), unit.lease_started_on ? formatDate(unit.lease_started_on) : "—"],
    [t("settings_rental_biz.col_history"), unit.registration_history ?? "—"],
  ];

  return (
    <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
        {t("settings_rental_biz.space_card_title")}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
            <span className="text-sm">{value}</span>
          </div>
        ))}
      </div>
      {/* 등록증은 임대인 계정에 있다 — 고칠 일이 있으면 그 계정으로 건너뛴다. */}
      {registration?.account_id ? (
        <Link href={`/account/accounts/${registration.account_id}`} className="text-xs text-primary underline underline-offset-2 self-start">
          {t("settings_rental_biz.space_card_link")}
        </Link>
      ) : null}
    </div>
  );
}
