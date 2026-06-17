import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheck, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/application-email-settings";

// The four public application intakes, in display order. Each maps to a key in
// the backend application_emails settings blob.
const APP_TYPES = ["homestay_student", "homestay_host", "short_term", "landlord"] as const;
type AppType = (typeof APP_TYPES)[number];

interface AckRule {
  send_ack_email: boolean;
  attach_pdf: boolean;
}
type Settings = Record<AppType, AckRule>;

const DEFAULTS: Settings = {
  homestay_student: { send_ack_email: false, attach_pdf: false },
  homestay_host: { send_ack_email: true, attach_pdf: false },
  short_term: { send_ack_email: false, attach_pdf: false },
  landlord: { send_ack_email: false, attach_pdf: false },
};

export default function ApplicationEmails() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULTS);

  const { data, isLoading } = useQuery({
    queryKey: ["application-email-settings"],
    queryFn: async (): Promise<{ settings: Settings }> => {
      const res = await apiFetch(API);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });
  useEffect(() => { if (data?.settings) setForm({ ...DEFAULTS, ...data.settings }); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API, { method: "PUT", body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("settings_app_emails.toast_saved") });
      qc.invalidateQueries({ queryKey: ["application-email-settings"] });
    },
    onError: (e: any) => toast({ title: t("settings_app_emails.error"), description: e.message, variant: "destructive" }),
  });

  function setRule(type: AppType, field: keyof AckRule, value: boolean) {
    setForm((f) => {
      const next = { ...f, [type]: { ...f[type], [field]: value } };
      // Attaching a PDF only makes sense when the email is actually sent.
      if (field === "send_ack_email" && !value) next[type].attach_pdf = false;
      if (field === "attach_pdf" && value) next[type].send_ack_email = true;
      return next;
    });
  }

  return (
    <Layout>
      <PageHeader
        title={<><MailCheck className="h-5 w-5" />{t("settings_app_emails.title")}</>}
        subtitle={t("settings_app_emails.subtitle")}
      />
      <div className="p-6 max-w-3xl space-y-6">
        {/* Explanation */}
        <div className="rounded-lg border bg-blue-50/60 border-blue-200 p-4 flex gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-blue-900">
            <p>{t("settings_app_emails.intro")}</p>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li><strong>{t("settings_app_emails.col_ack")}</strong> — {t("settings_app_emails.ack_explain")}</li>
              <li><strong>{t("settings_app_emails.col_pdf")}</strong> — {t("settings_app_emails.pdf_explain")}</li>
            </ul>
            <p className="text-xs text-blue-700">{t("settings_app_emails.note_ops")}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px] bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>{t("settings_app_emails.col_type")}</span>
              <span className="text-center">{t("settings_app_emails.col_ack")}</span>
              <span className="text-center">{t("settings_app_emails.col_pdf")}</span>
            </div>
            <div className="divide-y">
              {APP_TYPES.map((type) => (
                <div key={type} className="grid grid-cols-[1fr_120px_120px] items-center px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{t(`settings_app_emails.type_${type}_label`)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`settings_app_emails.type_${type}_desc`)}</p>
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={form[type].send_ack_email}
                      onCheckedChange={(v) => setRule(type, "send_ack_email", v)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={form[type].attach_pdf}
                      disabled={!form[type].send_ack_email}
                      onCheckedChange={(v) => setRule(type, "attach_pdf", v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-4">{t("settings_app_emails.note_pdf_render")}</p>
      </div>
    </Layout>
  );
}
