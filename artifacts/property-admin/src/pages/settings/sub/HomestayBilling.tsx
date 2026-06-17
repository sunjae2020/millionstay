import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-billing-settings";

interface BillingSettings {
  cycle_weeks: number;
  default_method: "card" | "bank_transfer";
  surcharge_pct: number;
  lead_days: number;
  default_placement_fee: number;
  default_deposit: number;
}

export default function HomestayBilling() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<BillingSettings>({ cycle_weeks: 4, default_method: "card", surcharge_pct: 2, lead_days: 0, default_placement_fee: 0, default_deposit: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-billing-settings"],
    queryFn: async (): Promise<{ data: BillingSettings }> => {
      const res = await apiFetch(API);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });
  useEffect(() => { if (data?.data) setForm(data.data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API, { method: "PUT", body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("homestayBilling.toast_saved") }); qc.invalidateQueries({ queryKey: ["homestay-billing-settings"] }); },
    onError: (e: any) => toast({ title: t("homestayBilling.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <PageHeader
        title={<><CreditCard className="h-5 w-5" />{t("homestayBilling.title")}</>}
        subtitle={t("homestayBilling.subtitle")}
      />
      <div className="p-6 max-w-xl">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="border rounded-lg bg-white p-6 grid gap-5">
            <div className="grid gap-1.5">
              <Label>{t("homestayBilling.cycle_weeks")}</Label>
              <Input type="number" inputMode="numeric" min={1} max={52} value={form.cycle_weeks}
                onChange={(e) => setForm((f) => ({ ...f, cycle_weeks: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">{t("homestayBilling.cycle_weeks_hint")}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("homestayBilling.default_method")}</Label>
              <Select value={form.default_method} onValueChange={(v) => setForm((f) => ({ ...f, default_method: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">{t("homestayBilling.method_card")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("homestayBilling.method_bank_transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("homestayBilling.surcharge_pct")}</Label>
              <Input type="number" inputMode="decimal" min={0} max={20} step={0.1} value={form.surcharge_pct}
                onChange={(e) => setForm((f) => ({ ...f, surcharge_pct: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">{t("homestayBilling.surcharge_pct_hint")}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("homestayBilling.lead_days")}</Label>
              <Input type="number" inputMode="numeric" min={0} max={30} value={form.lead_days}
                onChange={(e) => setForm((f) => ({ ...f, lead_days: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">{t("homestayBilling.lead_days_hint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t pt-5">
              <div className="grid gap-1.5">
                <Label>{t("homestayBilling.default_placement_fee")}</Label>
                <Input type="number" inputMode="decimal" min={0} step={0.01} value={form.default_placement_fee}
                  onChange={(e) => setForm((f) => ({ ...f, default_placement_fee: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("homestayBilling.default_deposit")}</Label>
                <Input type="number" inputMode="decimal" min={0} step={0.01} value={form.default_deposit}
                  onChange={(e) => setForm((f) => ({ ...f, default_deposit: Number(e.target.value) }))} />
              </div>
              <p className="text-xs text-muted-foreground col-span-2">{t("homestayBilling.default_fees_hint")}</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? t("common.saving") : t("common.save")}</Button>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-4">{t("homestayBilling.note_cron")}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
