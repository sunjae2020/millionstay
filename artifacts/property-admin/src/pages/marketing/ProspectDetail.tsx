import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Loader2, Save, UserPlus } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/date";
import {
  getProspect,
  createProspect,
  updateProspect,
  disqualifyProspect,
  type ConsentBasis,
  type Prospect,
} from "@/lib/marketing/api";
import { ConvertToAccountModal } from "@/components/marketing/ConvertToAccountModal";

const SEGMENTS = ["owner", "agency", "corporate", "education", "service"] as const;
const CONSENT_BASES: ConsentBasis[] = ["none", "inferred_b2b", "existing", "express"];
const LANGUAGES = ["ko", "en", "ja", "zh", "th", "vi"] as const;

type FormState = Partial<Prospect>;

const EMPTY: FormState = {
  company_name: "",
  email: "",
  contact_name: "",
  contact_title: "",
  phone: "",
  website: "",
  segment: "",
  country: "",
  city: "",
  language_code: "ko",
  consent_basis: "none",
  consent_evidence: "",
  notes: "",
};

export default function ProspectDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/marketing/prospects/:id");

  const rawId = params?.id ?? "";
  const isNew = rawId === "new";
  const id = Number(rawId);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "prospect", id],
    queryFn: () => getProspect(id),
    enabled: !isNew && Number.isFinite(id),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (key: keyof Prospect, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const evidenceRequired =
    (form.consent_basis ?? "none") !== "none" && !(form.consent_evidence ?? "").trim();

  async function handleSave() {
    if (!form.company_name?.trim() || !form.email?.trim()) {
      toast({ title: t("marketing.company_and_email_required"), variant: "destructive" });
      return;
    }
    if (evidenceRequired) {
      toast({ title: t("marketing.consent_evidence_required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createProspect(form);
        toast({ title: t("marketing.prospect_created") });
        navigate(`/marketing/prospects/${created.id}`);
      } else {
        await updateProspect(id, form);
        toast({ title: t("common.saved") });
        qc.invalidateQueries({ queryKey: ["marketing", "prospect", id] });
      }
      qc.invalidateQueries({ queryKey: ["marketing", "prospects"] });
    } catch (err) {
      toast({
        title: t("marketing.save_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDisqualify() {
    const reason = window.prompt(t("marketing.disqualify_reason_prompt")) ?? "";
    try {
      await disqualifyProspect(id, reason);
      toast({ title: t("marketing.disqualified") });
      qc.invalidateQueries({ queryKey: ["marketing", "prospect", id] });
      qc.invalidateQueries({ queryKey: ["marketing", "prospects"] });
    } catch {
      toast({ title: t("marketing.save_failed"), variant: "destructive" });
    }
  }

  const timeline = useMemo(() => data?.timeline ?? [], [data]);

  if (!isNew && isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link href="/marketing/prospects">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            {isNew ? t("marketing.new_prospect") : form.company_name}
          </span>
        }
        actions={
          <div className="flex gap-2">
            {!isNew && !data?.converted_account_id && (
              <>
                <Button variant="outline" onClick={handleDisqualify}>
                  <Ban className="h-4 w-4 mr-2" />
                  {t("marketing.disqualify")}
                </Button>
                <Button variant="outline" onClick={() => setConvertOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("marketing.convert")}
                </Button>
              </>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("marketing.basic_info")}</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Field label={t("marketing.company_name")} required>
                <Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
              </Field>
              <Field label={t("common.email")} required>
                <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label={t("marketing.contact_person")}>
                <Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
              </Field>
              <Field label={t("marketing.contact_title")}>
                <Input value={form.contact_title ?? ""} onChange={(e) => set("contact_title", e.target.value)} />
              </Field>
              <Field label={t("common.phone")}>
                <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label={t("marketing.website")}>
                <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
              </Field>
              <Field label={t("marketing.segment")}>
                <Select value={form.segment || "__none"} onValueChange={(v) => set("segment", v === "__none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("common.none")}</SelectItem>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`marketing.segment_${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("marketing.language")}>
                <Select value={form.language_code ?? "ko"} onValueChange={(v) => set("language_code", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`lang.${l}`, { defaultValue: l })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("marketing.country")}>
                <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
              </Field>
              <Field label={t("marketing.city")}>
                <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("common.notes")}>
                  <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("marketing.consent_section")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">{t("marketing.consent_section_help")}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={t("marketing.consent_basis")}>
                  <Select
                    value={form.consent_basis ?? "none"}
                    onValueChange={(v) => set("consent_basis", v as ConsentBasis)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSENT_BASES.map((b) => (
                        <SelectItem key={b} value={b}>
                          {t(`marketing.consent_${b}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("marketing.consent_evidence")} required={evidenceRequired}>
                  <Input
                    value={form.consent_evidence ?? ""}
                    onChange={(e) => set("consent_evidence", e.target.value)}
                    placeholder={t("marketing.consent_evidence_ph")}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("marketing.status_and_stats")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label={t("common.status")} value={t(`marketing.status_${data?.prospect_status}`, { defaultValue: data?.prospect_status ?? "" })} />
                <Row label={t("marketing.score")} value={String(data?.qualification_score ?? 0)} />
                <Row label={t("marketing.source")} value={data?.source ?? "—"} />
                <Row label={t("marketing.source_detail")} value={data?.source_detail || "—"} />
                <Row label={t("marketing.bounce_count")} value={String(data?.bounce_count ?? 0)} />
                <Row
                  label={t("marketing.last_contacted")}
                  value={data?.last_contacted_at ? formatDateTime(data.last_contacted_at) : "—"}
                />
                {data?.converted_account_id ? (
                  <Row
                    label={t("marketing.converted_account")}
                    value={
                      <Link href={`/crm/accounts/${data.converted_account_id}`} className="text-primary hover:underline">
                        #{data.converted_account_id}
                      </Link>
                    }
                  />
                ) : null}
                {data?.disqualified_reason ? (
                  <Row label={t("marketing.disqualify_reason")} value={data.disqualified_reason} />
                ) : null}
              </CardContent>
            </Card>
          )}

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("marketing.campaign_timeline")}</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("marketing.no_events")}</p>
                ) : (
                  <ul className="space-y-2">
                    {timeline.map((event) => (
                      <li key={event.id} className="flex items-start gap-2 text-sm border-l-2 border-muted pl-3">
                        <div className="flex-1">
                          <div className="font-medium">
                            {t(`marketing.event_${event.event_type}`, { defaultValue: event.event_type })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {event.campaign_name ? `${event.campaign_name} · ` : ""}
                            {formatDateTime(event.occurred_at)}
                          </div>
                          {event.detail ? <div className="text-xs text-muted-foreground">{event.detail}</div> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConvertToAccountModal
        prospect={convertOpen && data ? (data as Prospect) : null}
        onOpenChange={(open) => !open && setConvertOpen(false)}
        onConverted={() => {
          setConvertOpen(false);
          qc.invalidateQueries({ queryKey: ["marketing", "prospect", id] });
        }}
      />
    </Layout>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
