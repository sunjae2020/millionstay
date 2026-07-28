import type { TFunction } from "i18next";

/**
 * The account-type vocabulary, in one place.
 *
 * Before this existed each screen kept its own list and they had drifted apart:
 * the admin dropdowns still offered Broker / Manager / RealEstateAgent (zero
 * rows in either database) while `Tenant` and `Agent` — 71 of Metheim's 91
 * accounts — were missing entirely, so those rows rendered as unlabelled grey
 * badges and could not be filtered.
 *
 * Tenants are split by length of stay, which is the distinction that actually
 * matters operationally: `Tenant` is a 세입자 on a long lease, `Guest` is a
 * short-stay 게스트.
 *
 * `HomestayHost` only appears when the homestay module is on (see useModules).
 * Metheim has homestay disabled and no such accounts; MillionStay has five live
 * ones, so the type must not simply disappear.
 */
export interface AccountTypeDef {
  value: string;
  labelKey: string;
  /** Badge classes. Kept next to the value so colours cannot drift per screen. */
  color: string;
  /** Hidden unless the homestay module is enabled. */
  homestayOnly?: boolean;
}

export const ACCOUNT_TYPES: AccountTypeDef[] = [
  { value: "Tenant", labelKey: "account.type_tenant", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "Guest", labelKey: "account.type_guest", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "SpaceOwner", labelKey: "account.type_space_owner", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "Agent", labelKey: "account.type_agent", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "ServiceHost", labelKey: "account.type_service_host", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "Partner", labelKey: "account.type_partner", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "HomestayHost", labelKey: "account.type_homestay_host", color: "bg-teal-100 text-teal-700 border-teal-200", homestayOnly: true },
];

/** Selectable types for this instance. */
export function accountTypeOptions(homestayEnabled: boolean): AccountTypeDef[] {
  return ACCOUNT_TYPES.filter((d) => !d.homestayOnly || homestayEnabled);
}

/**
 * Localised label. Legacy values that predate this list (Broker, Manager,
 * RealEstateAgent…) fall back to the stored string rather than rendering blank —
 * an unknown type should still be readable, not invisible.
 */
export function accountTypeLabel(t: TFunction, value?: string | null): string {
  if (!value) return "—";
  const def = ACCOUNT_TYPES.find((d) => d.value === value);
  return def ? t(def.labelKey) : value;
}

export function accountTypeColor(value?: string | null): string {
  return ACCOUNT_TYPES.find((d) => d.value === value)?.color ?? "bg-gray-100 text-gray-700 border-gray-200";
}
