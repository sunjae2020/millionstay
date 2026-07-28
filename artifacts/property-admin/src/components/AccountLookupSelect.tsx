import { useTranslation } from "react-i18next";
import { LookupSelect, type LookupSelectProps, type LookupItem } from "@/components/LookupSelect";
import { accountTypeLabel } from "@/lib/accountTypes";

/**
 * Account picker with a localised type suffix.
 *
 * `/v1/lookup/accounts` builds its `display` server-side and the API has no
 * admin i18n, so every picker read "㈜메트하임 (Tenant)" in an otherwise Korean
 * screen. The endpoint now also returns `name` and `account_type`, so the label
 * is assembled here against the same vocabulary the rest of the admin uses.
 *
 * A drop-in replacement for LookupSelect — `lookupUrl` still carries any
 * filter, e.g. `/api/v1/lookup/accounts?type=Agent`.
 */
export function AccountLookupSelect(props: Omit<LookupSelectProps, "formatLabel">) {
  const { t } = useTranslation();

  const formatLabel = (item: LookupItem) => {
    const name = typeof item["name"] === "string" ? item["name"] : "";
    const type = typeof item["account_type"] === "string" ? item["account_type"] : "";
    // An older API build returns display only — fall back rather than blank out.
    if (!name) return item.display;
    return type ? `${name} (${accountTypeLabel(t, type)})` : name;
  };

  return <LookupSelect {...props} formatLabel={formatLabel} />;
}

export default AccountLookupSelect;
