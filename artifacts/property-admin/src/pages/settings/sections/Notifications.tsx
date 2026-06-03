import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotifItem {
  key: string;
  email: boolean;
  inapp: boolean;
}

const INITIAL: NotifItem[] = [
  { key: "new_booking", email: true, inapp: true },
  { key: "booking_cancelled", email: true, inapp: true },
  { key: "invoice_paid", email: true, inapp: true },
  { key: "invoice_overdue", email: true, inapp: false },
  { key: "contract_signed", email: true, inapp: true },
  { key: "contract_expiring", email: true, inapp: false },
  { key: "work_order_created", email: false, inapp: true },
  { key: "work_order_completed", email: false, inapp: true },
  { key: "lead_assigned", email: true, inapp: true },
  { key: "daily_summary", email: true, inapp: false },
];

export function Notifications() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<NotifItem[]>(INITIAL);

  function toggle(key: string, type: "email" | "inapp") {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [type]: !item[type] } : item
      )
    );
  }

  function handleSave() {
    toast({
      title: t("settings_notifications.toast_saved_title"),
      description: t("settings_notifications.toast_saved_desc"),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t("settings_notifications.preferences_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_notifications.preferences_desc")}</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px] bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>{t("settings_notifications.column_event")}</span>
          <span className="text-center">{t("settings_notifications.column_email")}</span>
          <span className="text-center">{t("settings_notifications.column_in_app")}</span>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium">{t(`settings_notifications.event_${item.key}_label`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(`settings_notifications.event_${item.key}_desc`)}</p>
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={item.email}
                  onCheckedChange={() => toggle(item.key, "email")}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={item.inapp}
                  onCheckedChange={() => toggle(item.key, "inapp")}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_notifications.bulk_actions_title")}</h3>
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, email: true, inapp: true })))}
          >
            {t("settings_notifications.enable_all")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, email: false, inapp: false })))}
          >
            {t("settings_notifications.disable_all")}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
