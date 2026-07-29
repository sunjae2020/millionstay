/**
 * 계약서 발행 위저드 — 세입자와 계약할 때 거치는 4단계.
 *
 *   1. 계약서 선택      3가지 서식 중 하나를 반드시 고른다(필수).
 *   2. 추가 페이지 선택  계약서 뒤에 붙일 첨부 문서.
 *   3. 최종 계약서 검토  요약 확인 + 미리보기. 서명 방식(온라인/날인)도 여기서 확정.
 *   4. 발행             PDF 모달(인쇄·다운로드·이메일) 또는 온라인 서명 요청.
 *
 * 서명 방식은 서버가 정본이다(`signing_policy`, api-server lib/contracts/signingPolicy.ts).
 * 1달 이하 단기 체류만 온라인 서명이 열리고, 그 밖은 출력·날인 후 스캔 보관이다.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronLeft, ChevronRight, Eye, FileSignature, Printer, Send } from "lucide-react";

/** 발행 가능한 계약서 서식 — api-server ContractLeaseForm 과 값이 같아야 한다. */
export const LEASE_FORM_OPTIONS = [
  { value: "general", labelKey: "contract.form_general", descKey: "contract.form_general_desc" },
  { value: "housing_standard", labelKey: "contract.form_housing_standard", descKey: "contract.form_housing_standard_desc" },
  { value: "mlt_standard", labelKey: "contract.form_mlt_standard", descKey: "contract.form_mlt_standard_desc" },
] as const;

/** 첨부 문서 — api-server leaseAttachments.ts 의 키와 1:1. */
export const LEASE_ATTACHMENT_OPTIONS = [
  { value: "special_terms", labelKey: "contract.attach_special_terms" },
  { value: "deposit_consent", labelKey: "contract.attach_deposit_consent" },
  { value: "trust_confirmation", labelKey: "contract.attach_trust_confirmation" },
  { value: "guarantee_undertaking", labelKey: "contract.attach_guarantee_undertaking" },
  // 별지2는 주택임대차표준계약서 원본에만 들어 있는 쪽이다.
  { value: "renewal_refusal", labelKey: "contract.attach_renewal_refusal", onlyForm: "housing_standard" },
] as const;

export interface SigningPolicy {
  mode: "online" | "wet";
  auto: "online" | "wet";
  overridden: boolean;
  override_reason: string | null;
  term_days: number | null;
  online_allowed: boolean;
  blocked_reason: "long_term" | "government_form" | "term_unknown" | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  contractId: number;
  contractRef: string;
  leaseForm: string | null;
  attachments: string[];
  signingPolicy: SigningPolicy | null;
  /** 부모의 미리보기 모달을 그대로 쓴다(공용 DocumentPreviewDialog). */
  onOpenPreview: () => void;
  /** 온라인 서명 요청 발행 후 계약을 다시 읽어 오게 한다. */
  onIssued: () => void;
}

const STEP_KEYS = [
  "contract.wiz_step_form",
  "contract.wiz_step_attachments",
  "contract.wiz_step_review",
  "contract.wiz_step_issue",
];

export function ContractIssueWizard({
  open, onClose, contractId, contractRef,
  leaseForm, attachments, signingPolicy, onOpenPreview, onIssued,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<string>(leaseForm ?? "");
  const [picked, setPicked] = useState<string[]>(attachments);
  const [modeOverride, setModeOverride] = useState<"" | "online" | "wet">("");
  const [overrideReason, setOverrideReason] = useState("");
  const [policy, setPolicy] = useState<SigningPolicy | null>(signingPolicy);

  // 계약이 다시 읽힐 때마다 초기값을 맞춘다. 위저드를 닫았다 열면 1단계부터.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(leaseForm ?? "");
    setPicked(attachments);
    setPolicy(signingPolicy);
    setModeOverride("");
    setOverrideReason("");
  }, [open, leaseForm, attachments, signingPolicy]);

  const saveConfig = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiFetch(`/api/v1/contracts/${contractId}/issue-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("contract.wiz_save_failed"));
      return json as { signing_policy: SigningPolicy };
    },
    onSuccess: (json) => {
      setPolicy(json.signing_policy ?? null);
      qc.invalidateQueries({ queryKey: ["/api/v1/contracts"] });
      onIssued();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const issueSigning = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/contracts/${contractId}/issue-signing`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("contract.wiz_signing_failed"));
      return json as { signing_url?: string };
    },
    onSuccess: (json) => {
      toast({ title: t("contract.wiz_signing_issued"), description: json.signing_url ?? undefined });
      onIssued();
      onClose();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  // 서식에 맞는 첨부만 보여 준다(별지2는 주택임대차표준계약서 전용).
  const availableAttachments = LEASE_ATTACHMENT_OPTIONS.filter(
    (a) => !("onlyForm" in a) || a.onlyForm === form,
  );

  const canLeaveFormStep = form !== "";
  const wet = policy?.mode === "wet";

  async function next() {
    // 서식·첨부·서명방식은 검토 단계로 넘어갈 때 한 번에 저장한다.
    if (step === 1) {
      const body: Record<string, unknown> = {
        lease_form: form,
        doc_attachments: picked.filter((p) => availableAttachments.some((a) => a.value === p)),
      };
      await saveConfig.mutateAsync(body).catch(() => null);
      if (saveConfig.isError) return;
    }
    if (step === 2 && modeOverride) {
      await saveConfig.mutateAsync({
        signing_mode: modeOverride,
        signing_mode_reason: overrideReason,
      }).catch(() => null);
      if (saveConfig.isError) return;
    }
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  }

  const formLabel = LEASE_FORM_OPTIONS.find((f) => f.value === form)?.labelKey;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("contract.wiz_title", { ref: contractRef })}</DialogTitle>
        </DialogHeader>

        {/* 단계 표시 */}
        <ol className="flex items-center gap-1 text-xs mb-2">
          {STEP_KEYS.map((key, i) => (
            <li key={key} className="flex items-center gap-1">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                i < step ? "bg-primary text-white" : i === step ? "bg-primary/15 text-primary ring-1 ring-primary" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={i === step ? "font-medium text-foreground" : "text-muted-foreground"}>{t(key)}</span>
              {i < STEP_KEYS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
            </li>
          ))}
        </ol>

        {/* 1. 계약서 선택 */}
        {step === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("contract.wiz_form_help")}</p>
            {LEASE_FORM_OPTIONS.map((f) => {
              const recommended = f.value === "general" && policy?.auto === "online";
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setForm(f.value)}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    form === f.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t(f.labelKey)}</span>
                    {recommended && <Badge variant="secondary" className="text-[10px]">{t("contract.wiz_recommended_short")}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t(f.descKey)}</p>
                </button>
              );
            })}
            {!canLeaveFormStep && <p className="text-xs text-red-600">{t("contract.wiz_form_required")}</p>}
          </div>
        )}

        {/* 2. 추가 페이지 선택 */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("contract.wiz_attach_help")}</p>
            {availableAttachments.map((a) => (
              <label key={a.value} className="flex items-center gap-2 text-sm cursor-pointer border rounded-lg p-2.5 hover:bg-muted/50">
                <Checkbox
                  checked={picked.includes(a.value)}
                  onCheckedChange={(checked) =>
                    setPicked((prev) => (checked ? [...prev, a.value] : prev.filter((v) => v !== a.value)))
                  }
                />
                {t(a.labelKey)}
              </label>
            ))}
            {!availableAttachments.length && <p className="text-sm text-muted-foreground">{t("contract.wiz_attach_none")}</p>}
          </div>
        )}

        {/* 3. 최종 계약서 검토 */}
        {step === 2 && (
          <div className="space-y-4">
            <dl className="text-sm border rounded-lg divide-y">
              <div className="flex justify-between gap-4 p-2.5">
                <dt className="text-muted-foreground">{t("contract.label_lease_form")}</dt>
                <dd className="font-medium text-right">{formLabel ? t(formLabel) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <dt className="text-muted-foreground">{t("contract.label_doc_attachments")}</dt>
                <dd className="text-right">
                  {picked.length
                    ? picked.map((p) => t(LEASE_ATTACHMENT_OPTIONS.find((a) => a.value === p)?.labelKey ?? p)).join(", ")
                    : t("contract.wiz_attach_zero")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <dt className="text-muted-foreground">{t("contract.wiz_term_days")}</dt>
                <dd className="text-right">
                  {policy?.term_days != null ? t("contract.wiz_days", { count: policy.term_days }) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <dt className="text-muted-foreground">{t("contract.wiz_signing_mode")}</dt>
                <dd className="text-right">
                  <Badge variant={policy?.online_allowed ? "default" : "secondary"}>
                    {t(policy?.mode === "online" ? "contract.signing_online" : "contract.signing_wet")}
                  </Badge>
                </dd>
              </div>
            </dl>

            {policy && !policy.online_allowed && (
              <p className="text-xs rounded-md bg-amber-50 border border-amber-200 p-2.5 text-amber-900">
                {t(
                  policy.blocked_reason === "government_form" ? "contract.signing_blocked_gov"
                  : policy.blocked_reason === "term_unknown" ? "contract.signing_blocked_unknown"
                  : "contract.signing_blocked_long",
                )}
              </p>
            )}

            {/* 경계 사례 수동 재지정 */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs">{t("contract.wiz_override_label")}</Label>
              <div className="flex gap-2">
                {(["", "online", "wet"] as const).map((v) => (
                  <Button
                    key={v || "auto"} type="button" size="sm"
                    variant={modeOverride === v ? "default" : "outline"}
                    onClick={() => setModeOverride(v)}
                  >
                    {t(v === "" ? "contract.wiz_override_auto" : v === "online" ? "contract.signing_online" : "contract.signing_wet")}
                  </Button>
                ))}
              </div>
              {modeOverride !== "" && (
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={t("contract.wiz_override_reason_ph")}
                />
              )}
              <p className="text-[11px] text-muted-foreground">{t("contract.wiz_override_help")}</p>
            </div>

            <Button type="button" variant="outline" onClick={onOpenPreview}>
              <Eye className="h-4 w-4 mr-2" />{t("contract.wiz_open_preview")}
            </Button>
          </div>
        )}

        {/* 4. 발행 */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("contract.wiz_issue_help")}</p>
            <Button type="button" className="w-full justify-start" variant="outline" onClick={onOpenPreview}>
              {wet ? <Printer className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {t(wet ? "contract.wiz_issue_print" : "contract.wiz_issue_pdf")}
            </Button>
            <p className="text-[11px] text-muted-foreground -mt-1 pl-1">{t("contract.wiz_issue_pdf_note")}</p>

            {policy?.online_allowed ? (
              <>
                <Button
                  type="button" className="w-full justify-start"
                  disabled={issueSigning.isPending}
                  onClick={() => issueSigning.mutate()}
                >
                  <Send className="h-4 w-4 mr-2" />{t("contract.wiz_issue_signing")}
                </Button>
                <p className="text-[11px] text-muted-foreground -mt-1 pl-1">{t("contract.wiz_issue_signing_note")}</p>
              </>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                <p className="flex items-center gap-1.5 font-medium">
                  <FileSignature className="h-3.5 w-3.5" />{t("contract.wiz_wet_title")}
                </p>
                <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                  <li>{t("contract.wiz_wet_step1")}</li>
                  <li>{t("contract.wiz_wet_step2")}</li>
                  <li>{t("contract.wiz_wet_step3")}</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm"
            disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" />{t("common.back")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.close")}</Button>
            {step < STEP_KEYS.length - 1 && (
              <Button type="button" onClick={next}
                disabled={(step === 0 && !canLeaveFormStep) || saveConfig.isPending}>
                {t("common.next")}<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
