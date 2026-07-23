import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTRACT_TERM_OPTIONS,
  ROOM_TYPE_OPTIONS,
  MEAL_PLAN_OPTIONS,
  GUEST_AGE_OPTIONS,
  HOMESTAY_ROOM_TYPE,
  type OptionDef,
} from "@/lib/accommodationOptions";

// Shape of the four classification fields. All optional/nullable — additive.
export type AccommodationOptionValues = {
  contract_term?: string | null;
  room_type?: string | null;
  meal_plan?: string | null;
  guest_age?: string | null;
};

type Props = {
  value: AccommodationOptionValues;
  onChange: (patch: Partial<AccommodationOptionValues>) => void;
};

// Drop-in block for the Accommodation Product form. Renders contract term and
// room type as required selects; meal plan + guest age appear only for homestay.
export function AccommodationOptionFields({ value, onChange }: Props) {
  const { t } = useTranslation();
  const isHomestay = value.room_type === HOMESTAY_ROOM_TYPE;

  const renderSelect = (
    label: string,
    field: keyof AccommodationOptionValues,
    options: OptionDef[],
  ) => (
    <div>
      <Label>{label}</Label>
      <Select
        value={value[field] ?? undefined}
        onValueChange={(v) => onChange({ [field]: v })}
      >
        <SelectTrigger className="mt-1">
          <SelectValue placeholder={t("common.select", "Select…")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {t(o.i18nKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {renderSelect(t("accommodation_options.field.contract_term"), "contract_term", CONTRACT_TERM_OPTIONS)}
        {renderSelect(t("accommodation_options.field.room_type"), "room_type", ROOM_TYPE_OPTIONS)}
      </div>

      {isHomestay && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          {renderSelect(t("accommodation_options.field.meal_plan"), "meal_plan", MEAL_PLAN_OPTIONS)}
          {renderSelect(t("accommodation_options.field.guest_age"), "guest_age", GUEST_AGE_OPTIONS)}
        </div>
      )}
    </div>
  );
}
