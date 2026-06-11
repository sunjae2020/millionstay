// Single source of truth for the closed accommodation-classification option sets
// used in the property-admin UI. Values MUST match the Postgres enums defined in
// lib/db/src/schema/accommodation_options.ts. Labels are resolved via i18n keys
// under the `accommodation_options.*` namespace (see locales/*/translation.json).

export type OptionDef = { value: string; i18nKey: string };

export const CONTRACT_TERM_OPTIONS: OptionDef[] = [
  { value: "short_term", i18nKey: "accommodation_options.contract_term.short_term" },
  { value: "mid_term", i18nKey: "accommodation_options.contract_term.mid_term" },
  { value: "long_term", i18nKey: "accommodation_options.contract_term.long_term" },
];

export const ROOM_TYPE_OPTIONS: OptionDef[] = [
  { value: "room_share", i18nKey: "accommodation_options.room_type.room_share" },
  { value: "house_share", i18nKey: "accommodation_options.room_type.house_share" },
  { value: "entire_place", i18nKey: "accommodation_options.room_type.entire_place" },
  { value: "homestay", i18nKey: "accommodation_options.room_type.homestay" },
];

export const MEAL_PLAN_OPTIONS: OptionDef[] = [
  { value: "none", i18nKey: "accommodation_options.meal_plan.none" },
  { value: "partial_board", i18nKey: "accommodation_options.meal_plan.partial_board" },
  { value: "full_board", i18nKey: "accommodation_options.meal_plan.full_board" },
];

export const GUEST_AGE_OPTIONS: OptionDef[] = [
  { value: "adult", i18nKey: "accommodation_options.guest_age.adult" },
  { value: "minor", i18nKey: "accommodation_options.guest_age.minor" },
];

// meal_plan and guest_age are only meaningful when room_type === "homestay".
export const HOMESTAY_ROOM_TYPE = "homestay";

// Add-on service categories (for grouping rows in the catalogue UI).
export const ADDON_CATEGORY_OPTIONS: OptionDef[] = [
  { value: "transport", i18nKey: "accommodation_options.addon_category.transport" },
  { value: "living", i18nKey: "accommodation_options.addon_category.living" },
  { value: "supplies", i18nKey: "accommodation_options.addon_category.supplies" },
  { value: "telecom", i18nKey: "accommodation_options.addon_category.telecom" },
  { value: "other", i18nKey: "accommodation_options.addon_category.other" },
];

export const ADDON_UNIT_OPTIONS: OptionDef[] = [
  { value: "per_booking", i18nKey: "accommodation_options.addon_unit.per_booking" },
  { value: "per_trip", i18nKey: "accommodation_options.addon_unit.per_trip" },
  { value: "per_week", i18nKey: "accommodation_options.addon_unit.per_week" },
  { value: "per_item", i18nKey: "accommodation_options.addon_unit.per_item" },
  { value: "per_month", i18nKey: "accommodation_options.addon_unit.per_month" },
];
