import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, Copy, ExternalLink, Route } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import { TenantLinkCard } from "@/components/TenantLinkCard";

interface Step {
  key: string;
  label: string;
  state: "todo" | "sent" | "done";
  at: string | null;
  link: string | null;
  detail: string | null;
  /** 세는 단계(서류 제출·청구)만 채워진다. 문장은 화면이 만든다. */
  counts?: { submitted?: number; unpaid?: number; total: number } | null;
}

/** 단계 옆에 붙는 짧은 부연. 숫자는 서버에서, 문장은 여기서. */
function stepDetail(s: Step, t: (k: string, o?: any) => string): string | null {
  if (s.counts) {
    if (s.key === "documents") return t("onboarding.detail_documents", { submitted: s.counts.submitted ?? 0, total: s.counts.total });
    if (s.key === "billing") return t("onboarding.detail_billing", { unpaid: s.counts.unpaid ?? 0, total: s.counts.total });
  }
  return s.detail;
}

/**
 * 세입자 온보딩 — 계약 상세에서 평소에는 **한 줄**, 필요할 때만 펼친다.
 *
 * 처음에는 단계 목록과 링크 카드 두 장을 계약 화면에 그대로 폈는데, 계약을 열
 * 때마다 화면의 절반을 차지했다. 온보딩은 계약을 볼 때 항상 필요한 정보가
 * 아니라 "지금 어디까지 갔나"를 가끔 확인하는 것이므로, 접힌 상태의 진행 막대
 * 한 줄이면 충분하다.
 *
 * 펼치기를 팝업이 아니라 인라인으로 둔 이유: 링크 발급 창이 그 자체로 팝업이라,
 * 팝업 안에 팝업을 띄우면 바깥 창이 포인터를 잠가 안쪽 창을 못 누르는 사고가
 * 난다. 접기는 그런 위험이 없다.
 */
export function TenantOnboardingPanel({
  contractId,
  tenantEmail,
}: {
  contractId: number;
  tenantEmail?: string | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ["contract-onboarding", contractId],
    queryFn: async (): Promise<{ steps: Step[] } | null> => {
      const res = await apiFetch(`/api/v1/contracts/${contractId}/onboarding`);
      if (!res.ok) return null;
      return (await res.json()).data ?? null;
    },
    enabled: Number.isFinite(contractId) && contractId > 0,
  });

  const steps = data?.steps ?? [];
  if (!steps.length) return null;

  const done = steps.filter((s) => s.state === "done").length;
  // 다음에 할 일 = 아직 끝나지 않은 첫 단계. 담당자가 화면에서 찾는 값은 결국 이것뿐이다.
  const next = steps.find((s) => s.state !== "done") ?? null;

  return (
    <div className="border rounded-lg bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Route className="h-3.5 w-3.5" /> {t("onboarding.title")}
        </span>

        {/* 단계 막대 — 칸 하나가 단계 하나. 마우스를 올리면 단계 이름이 뜬다. */}
        <div className="flex items-center gap-1" role="img"
          aria-label={t("onboarding.progress_aria", { done, total: steps.length })}>
          {steps.map((s) => (
            <span
              key={s.key}
              title={`${t(`onboarding.step_${s.key}`, s.label)} · ${t(`onboarding.state_${s.state}`)}`}
              className={`h-1.5 w-6 rounded-full ${
                s.state === "done" ? "bg-green-500"
                  : s.state === "sent" ? "bg-amber-400"
                  : "bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <span className="text-xs tabular-nums text-muted-foreground">{done}/{steps.length}</span>

        {next && (
          <span className="text-xs text-muted-foreground truncate">
            {t("onboarding.next_up")} <span className="text-foreground">{t(`onboarding.step_${next.key}`, next.label)}</span>
          </span>
        )}

        <Button type="button" size="sm" variant="outline" className="ml-auto h-7 gap-1" aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
          {expanded ? t("onboarding.btn_collapse") : t("onboarding.btn_manage")}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <ol className="rounded-lg border divide-y">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <StateIcon state={s.state} />
                <span className={s.state === "todo" ? "text-muted-foreground" : "font-medium"}>
                  {t(`onboarding.step_${s.key}`, s.label)}
                </span>
                {stepDetail(s, t) && <span className="text-xs text-muted-foreground truncate">{stepDetail(s, t)}</span>}
                <span className="ml-auto flex items-center gap-2">
                  {s.at && <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(s.at)}</span>}
                  {s.link && (
                    <>
                      <button type="button" className="text-muted-foreground hover:text-foreground" title={t("tenantLink.btn_copy")}
                        onClick={() => { navigator.clipboard?.writeText(s.link!); toast({ title: t("tenantLink.toast_copied") }); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a className="text-muted-foreground hover:text-foreground" href={s.link} target="_blank" rel="noreferrer"
                         title={t("onboarding.open_link")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>

          <TenantLinkCard
            kind="intake"
            issuePath={`/api/v1/contracts/${contractId}/intake-request`}
            listPath={`/api/v1/contracts/${contractId}/intake-request`}
            defaultEmail={tenantEmail ?? null}
          />
          <TenantLinkCard
            kind="doc_request"
            issuePath={`/api/v1/contracts/${contractId}/document-request`}
            listPath={`/api/v1/contracts/${contractId}/document-request`}
            defaultEmail={tenantEmail ?? null}
          />
        </div>
      )}
    </div>
  );
}

function StateIcon({ state }: { state: Step["state"] }) {
  if (state === "done") return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
  if (state === "sent") return <Clock className="h-4 w-4 shrink-0 text-amber-600" />;
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />;
}
