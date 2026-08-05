import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Ban, Eye, Loader2, Pause, Play, Plus, Save, Send, Trash2, Users,
} from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/date";
import {
  getCampaign, updateCampaign, saveStep, deleteStep, buildCampaign, previewCampaign,
  testSendCampaign, campaignAction, getCampaignStats, getCampaignRecipients, markReplied,
  listMarketingLists, type CampaignStep, type BuildResult, type CampaignPreview,
} from "@/lib/marketing/api";

const LANGUAGES = ["ko", "en", "ja", "zh", "th", "vi"] as const;
const TIMEZONES = ["Asia/Seoul", "Australia/Sydney", "Asia/Tokyo", "Asia/Shanghai", "Asia/Bangkok", "Asia/Ho_Chi_Minh"] as const;

export default function CampaignDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, params] = useRoute("/marketing/campaigns/:id");
  const id = Number(params?.id ?? 0);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "campaign", id],
    queryFn: () => getCampaign(id),
    enabled: Number.isFinite(id) && id > 0,
  });
  const { data: lists } = useQuery({ queryKey: ["marketing", "lists"], queryFn: listMarketingLists });
  const { data: stats } = useQuery({
    queryKey: ["marketing", "campaign-stats", id],
    queryFn: () => getCampaignStats(id),
    enabled: Number.isFinite(id) && id > 0,
  });
  const { data: recipients } = useQuery({
    queryKey: ["marketing", "campaign-recipients", id],
    queryFn: () => getCampaignRecipients(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [testTo, setTestTo] = useState("");

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);
  const set = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["marketing", "campaign", id] });
    qc.invalidateQueries({ queryKey: ["marketing", "campaign-stats", id] });
    qc.invalidateQueries({ queryKey: ["marketing", "campaign-recipients", id] });
    qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
  };

  async function run<T>(fn: () => Promise<T>, successKey: string): Promise<T | undefined> {
    setSaving(true);
    try {
      const result = await fn();
      toast({ title: t(successKey) });
      invalidate();
      return result;
    } catch (err) {
      toast({
        title: t("marketing.save_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const locked = data.status === "sending";

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link href="/marketing/campaigns">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            {data.name}
            <span className="text-xs font-normal text-muted-foreground">
              {t(`marketing.campaign_status_${data.status}`, { defaultValue: data.status })}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => run(() => buildCampaign(id), "marketing.build_done").then((r) => r && setBuildResult(r))} disabled={saving || locked}>
              <Users className="h-4 w-4 mr-2" />{t("marketing.build_audience")}
            </Button>
            <Button variant="outline" onClick={() => previewCampaign(id).then(setPreview).catch(() => toast({ title: t("marketing.preview_failed"), variant: "destructive" }))}>
              <Eye className="h-4 w-4 mr-2" />{t("marketing.preview")}
            </Button>
            {data.status === "sending" ? (
              <Button variant="outline" onClick={() => run(() => campaignAction(id, "pause"), "marketing.paused")}>
                <Pause className="h-4 w-4 mr-2" />{t("marketing.pause")}
              </Button>
            ) : data.status === "paused" ? (
              <Button onClick={() => run(() => campaignAction(id, "resume"), "marketing.resumed")}>
                <Play className="h-4 w-4 mr-2" />{t("marketing.resume")}
              </Button>
            ) : (
              <Button onClick={() => run(() => campaignAction(id, "schedule"), "marketing.scheduled")} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />{t("marketing.schedule_send")}
              </Button>
            )}
            <Button variant="outline" onClick={() => run(() => campaignAction(id, "cancel"), "marketing.cancelled")} disabled={saving}>
              <Ban className="h-4 w-4 mr-2" />{t("marketing.cancel_campaign")}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {buildResult && (
          <Card>
            <CardContent className="pt-6 text-sm space-y-2">
              <div className="font-medium">
                {t("marketing.build_summary", { audience: buildResult.audience, recipients: buildResult.recipients })}
              </div>
              {buildResult.excluded_total > 0 && (
                <div className="text-muted-foreground">
                  {t("marketing.excluded_total", { count: buildResult.excluded_total })} —{" "}
                  {Object.entries(buildResult.excluded)
                    .map(([reason, n]) => `${t(`marketing.exclude_${reason}`, { defaultValue: reason })} ${n}`)
                    .join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">{t("marketing.settings")}</TabsTrigger>
            <TabsTrigger value="steps">{t("marketing.steps")}</TabsTrigger>
            <TabsTrigger value="recipients">{t("marketing.recipients")}</TabsTrigger>
            <TabsTrigger value="stats">{t("marketing.stats")}</TabsTrigger>
          </TabsList>

          {/* Settings */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
                <Field label={t("marketing.campaign_name")}>
                  <Input value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} disabled={locked} />
                </Field>
                <Field label={t("marketing.list")}>
                  <Select
                    value={form.list_id ? String(form.list_id) : "__none"}
                    onValueChange={(v) => set("list_id", v === "__none" ? null : Number(v))}
                    disabled={locked}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("common.none")}</SelectItem>
                      {(lists ?? []).map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name} ({l.member_count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("marketing.from_name")}>
                  <Input value={String(form.from_name ?? "")} onChange={(e) => set("from_name", e.target.value)} disabled={locked} />
                </Field>
                <Field label={t("marketing.from_email")}>
                  <Input value={String(form.from_email ?? "")} onChange={(e) => set("from_email", e.target.value)} disabled={locked} placeholder={t("marketing.from_email_ph")} />
                </Field>
                <Field label={t("marketing.reply_to")}>
                  <Input value={String(form.reply_to ?? "")} onChange={(e) => set("reply_to", e.target.value)} disabled={locked} />
                </Field>
                <Field label={t("marketing.language")}>
                  <Select value={String(form.language_code ?? "ko")} onValueChange={(v) => set("language_code", v)} disabled={locked}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{t(`lang.${l}`, { defaultValue: l })}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("marketing.throttle")}>
                  <Input type="number" value={Number(form.throttle_per_hour ?? 60)} onChange={(e) => set("throttle_per_hour", Number(e.target.value))} disabled={locked} />
                </Field>
                <Field label={t("marketing.timezone")}>
                  <Select value={String(form.timezone ?? "Asia/Seoul")} onValueChange={(v) => set("timezone", v)} disabled={locked}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("marketing.send_window")}>
                  <div className="flex items-center gap-2">
                    <Input type="time" value={String(form.send_window_start ?? "09:00")} onChange={(e) => set("send_window_start", e.target.value)} disabled={locked} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" value={String(form.send_window_end ?? "18:00")} onChange={(e) => set("send_window_end", e.target.value)} disabled={locked} />
                  </div>
                </Field>
                <div className="sm:col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={Boolean(form.is_advertising)} onCheckedChange={(v) => set("is_advertising", v === true)} disabled={locked} />
                    {t("marketing.is_advertising")}
                  </label>
                  <p className="text-xs text-muted-foreground">{t("marketing.is_advertising_help")}</p>
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={() => run(() => updateCampaign(id, form as never), "common.saved")} disabled={saving || locked}>
                    <Save className="h-4 w-4 mr-2" />{t("common.save")}
                  </Button>
                  {locked && <span className="text-xs text-amber-600 ml-3">{t("marketing.locked_while_sending")}</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Steps */}
          <TabsContent value="steps" className="mt-4 space-y-4">
            {data.steps.map((step) => (
              <StepEditor
                key={step.id}
                campaignId={id}
                step={step}
                disabled={locked}
                onSaved={invalidate}
                onTestSend={(to, stepId) =>
                  run(() => testSendCampaign(id, to, stepId), "marketing.test_sent")
                }
                testTo={testTo}
                setTestTo={setTestTo}
              />
            ))}
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                run(
                  () => saveStep(id, { step_no: (data.steps.at(-1)?.step_no ?? 0) + 1, name: "", subject: "", body_html: "" }),
                  "marketing.step_added",
                )
              }
            >
              <Plus className="h-4 w-4 mr-2" />{t("marketing.add_step")}
            </Button>
          </TabsContent>

          {/* Recipients */}
          <TabsContent value="recipients" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {!recipients?.length ? (
                  <p className="text-sm text-muted-foreground">{t("marketing.no_recipients")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">{t("marketing.company_name")}</th>
                          <th className="text-left p-2">{t("common.email")}</th>
                          <th className="text-left p-2">{t("common.status")}</th>
                          <th className="text-right p-2">{t("marketing.step")}</th>
                          <th className="text-right p-2">{t("marketing.opened")}</th>
                          <th className="text-right p-2">{t("marketing.clicked")}</th>
                          <th className="text-left p-2">{t("marketing.next_send")}</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2">{r.company_name}</td>
                            <td className="p-2">{r.email}</td>
                            <td className="p-2">
                              {t(`marketing.recipient_${r.recipient_status}`, { defaultValue: r.recipient_status })}
                              {r.skip_reason ? (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({t(`marketing.exclude_${r.skip_reason}`, { defaultValue: r.skip_reason })})
                                </span>
                              ) : null}
                            </td>
                            <td className="p-2 text-right">{r.current_step}</td>
                            <td className="p-2 text-right">{r.open_count}</td>
                            <td className="p-2 text-right">{r.click_count}</td>
                            <td className="p-2">{r.next_send_at ? formatDateTime(r.next_send_at) : "—"}</td>
                            <td className="p-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => run(() => markReplied(id, r.id), "marketing.marked_replied")}>
                                {t("marketing.mark_replied")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={t("marketing.recipients")} value={stats?.total_recipients ?? 0} />
              <Stat label={t("marketing.sent")} value={stats?.sent ?? 0} />
              <Stat label={t("marketing.delivered")} value={stats?.delivered ?? 0} rate={stats?.rates.delivered} />
              <Stat label={t("marketing.opened")} value={stats?.opened ?? 0} rate={stats?.rates.opened} />
              <Stat label={t("marketing.clicked")} value={stats?.clicked ?? 0} rate={stats?.rates.clicked} />
              <Stat label={t("marketing.replied")} value={stats?.replied ?? 0} rate={stats?.rates.replied} />
              <Stat label={t("marketing.bounced")} value={stats?.bounced ?? 0} rate={stats?.rates.bounced} />
              <Stat label={t("marketing.converted")} value={stats?.converted ?? 0} rate={stats?.rates.converted} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("marketing.preview")}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">{t("marketing.subject")}: </span>
                <span className="font-medium">{preview.subject}</span>
              </div>
              {preview.sample_prospect && (
                <div className="text-xs text-muted-foreground">
                  {t("marketing.preview_sample", { name: preview.sample_prospect.company_name })}
                </div>
              )}
              <iframe title="preview" srcDoc={preview.html} className="w-full h-[480px] border rounded-md bg-white" />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">{t("marketing.test_send_to")}</Label>
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                </div>
                <Button onClick={() => run(() => testSendCampaign(id, testTo), "marketing.test_sent")} disabled={!testTo.trim() || saving}>
                  <Send className="h-4 w-4 mr-2" />{t("marketing.test_send")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function StepEditor({
  campaignId, step, disabled, onSaved, onTestSend, testTo, setTestTo,
}: {
  campaignId: number;
  step: CampaignStep;
  disabled: boolean;
  onSaved: () => void;
  onTestSend: (to: string, stepId: number) => void;
  testTo: string;
  setTestTo: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [draft, setDraft] = useState<CampaignStep>(step);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(step), [step]);

  async function save() {
    setBusy(true);
    try {
      await saveStep(campaignId, draft);
      toast({ title: t("common.saved") });
      onSaved();
    } catch {
      toast({ title: t("marketing.save_failed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t("marketing.step_n", { n: draft.step_no })} {draft.name ? `· ${draft.name}` : ""}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onTestSend(testTo, draft.id)} disabled={!testTo.trim() || disabled}>
            <Send className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => deleteStep(campaignId, draft.id).then(onSaved)}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t("marketing.step_name")}>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={disabled} />
          </Field>
          <Field label={t("marketing.delay_days")}>
            <Input type="number" value={draft.delay_days} onChange={(e) => setDraft({ ...draft, delay_days: Number(e.target.value) })} disabled={disabled} />
          </Field>
          <Field label={t("marketing.stop_on")}>
            <Select value={draft.stop_on} onValueChange={(v) => setDraft({ ...draft, stop_on: v })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["none", "open", "click", "reply"].map((v) => (
                  <SelectItem key={v} value={v}>{t(`marketing.stop_on_${v}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t("marketing.subject")}>
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} disabled={disabled} />
        </Field>
        <Field label={t("marketing.body")}>
          <Textarea rows={7} value={draft.body_html} onChange={(e) => setDraft({ ...draft, body_html: e.target.value })} disabled={disabled} />
        </Field>
        <p className="text-xs text-muted-foreground">{t("marketing.variables_help")}</p>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={busy || disabled}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("common.save")}
          </Button>
          <Input className="max-w-xs" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={t("marketing.test_send_to")} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value, rate }: { label: string; value: number; rate?: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
        {rate !== undefined && <div className="text-xs text-muted-foreground">{rate}%</div>}
      </CardContent>
    </Card>
  );
}
