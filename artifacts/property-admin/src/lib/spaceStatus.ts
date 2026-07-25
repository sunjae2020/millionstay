/**
 * Space status option sets.
 *
 * Standard tenants use the platform listing lifecycle
 * (Active/Inactive/Suspended), which drives public visibility. Building-ledger
 * tenants (e.g. MetHeim — a single 분양/임대 building managed unit-by-unit) track
 * Korean occupancy states on each unit instead. The set is chosen at BUILD time
 * via `VITE_SPACE_STATUS_SET`, so it only affects that tenant's admin bundle;
 * the main MillionStay admin (which never sets the var) is unchanged.
 */

/** Building-ledger occupancy states (전체관리대장 임대현황). */
export const LEDGER_STATUS_VALUES = ["임대", "대여", "분양", "공실", "임대불가"] as const;

/** Platform listing lifecycle. */
export const STANDARD_STATUS_VALUES = ["Active", "Inactive", "Suspended"] as const;

export const isLedgerStatusSet = import.meta.env.VITE_SPACE_STATUS_SET === "ledger-ko";

/** Default status for a newly created space in the current tenant's set. */
export const DEFAULT_SPACE_STATUS = isLedgerStatusSet ? "공실" : "Active";

/** Base status option values for the current tenant's set. */
export function spaceStatusValues(): string[] {
  return isLedgerStatusSet ? [...LEDGER_STATUS_VALUES] : [...STANDARD_STATUS_VALUES];
}

/**
 * Status option values including `current` when it falls outside the base set,
 * so an existing value (e.g. an `Inactive` type-template row under the ledger
 * set) still renders as the selected option and is preserved on save instead of
 * being silently dropped.
 */
export function spaceStatusValuesWith(current?: string | null): string[] {
  const base = spaceStatusValues();
  if (current && !base.includes(current)) return [...base, current];
  return base;
}
