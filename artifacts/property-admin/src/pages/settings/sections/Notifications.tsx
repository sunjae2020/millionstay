import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotifItem {
  key: string;
  label: string;
  desc: string;
  email: boolean;
  inapp: boolean;
}

const INITIAL: NotifItem[] = [
  { key: "new_booking", label: "New Booking", desc: "When a new booking is created", email: true, inapp: true },
  { key: "booking_cancelled", label: "Booking Cancelled", desc: "When a booking is cancelled", email: true, inapp: true },
  { key: "invoice_paid", label: "Invoice Paid", desc: "When an invoice payment is confirmed", email: true, inapp: true },
  { key: "invoice_overdue", label: "Invoice Overdue", desc: "When an invoice payment deadline is exceeded", email: true, inapp: false },
  { key: "contract_signed", label: "Contract Signed", desc: "When a tenant signs a contract", email: true, inapp: true },
  { key: "contract_expiring", label: "Contract Expiring Soon", desc: "30 days before a contract expires", email: true, inapp: false },
  { key: "work_order_created", label: "Work Order Created", desc: "When a new maintenance request is submitted", email: false, inapp: true },
  { key: "work_order_completed", label: "Work Order Completed", desc: "When a maintenance task is marked complete", email: false, inapp: true },
  { key: "lead_assigned", label: "Lead Assigned", desc: "When a lead is assigned to a team member", email: true, inapp: true },
  { key: "daily_summary", label: "Daily Summary Report", desc: "Daily operations summary sent at 9am", email: true, inapp: false },
];

export function Notifications() {
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
    toast({ title: "Saved", description: "Notification preferences have been updated." });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Configure email and in-app alerts per event type</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px] bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Event</span>
          <span className="text-center">Email</span>
          <span className="text-center">In-App</span>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
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
        <h3 className="text-base font-semibold">Bulk Actions</h3>
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, email: true, inapp: true })))}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, email: false, inapp: false })))}
          >
            Disable All
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
