import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Circle, Copy, ExternalLink, Route } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";

interface Step {
  key: string;
  label: string;
  state: "todo" | "sent" | "done";
  at: string | null;
  link: string | null;
  detail: string | null;
}

/**
 * 계약 한 건의 세입자 온보딩 현황 — 신청부터 퇴거 정산까지 여섯 단계를 한 줄씩
 * 보여 준다. 각 단계는 서로 다른 원장(서명 요청 · 점검표 · 청구서 · 링크 원장)에
 * 살아 있어서, 그동안 담당자는 "이 세입자 어디까지 갔더라"를 화면 네 곳을 열어
 * 맞춰 봐야 했다. 서버가 한 번에 답하고(`/v1/contracts/:id/onboarding`) 여기서는
 * 그리기만 한다.
 *
 * 링크 발급 버튼은 일부러 두지 않았다 — 단계마다 발급 조건(제안 상태의 정산,
 * 점검표 작성 완료 등)이 다르고, 그 판단은 각 단계의 화면에서 하는 편이 옳다.
 * 이 카드는 "무엇이 남았는지"를 말하고, 링크가 이미 나갔으면 그 주소를 준다.
 */
export function TenantOnboardingCard({ contractId }: { contractId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();

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

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-primary/10 border-b px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider inline-flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5" /> {t("onboarding.title")}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{done}/{steps.length}</span>
      </div>
      <ol className="divide-y">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <StateIcon state={s.state} />
            <span className={s.state === "todo" ? "text-muted-foreground" : "font-medium"}>
              {t(`onboarding.step_${s.key}`, s.label)}
            </span>
            {s.detail && <span className="text-xs text-muted-foreground truncate">{s.detail}</span>}
            <span className="ml-auto flex items-center gap-2">
              {s.at && <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(s.at)}</span>}
              {s.link && (
                <>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    title={t("tenantLink.btn_copy")}
                    onClick={() => { navigator.clipboard?.writeText(s.link!); toast({ title: t("tenantLink.toast_copied") }); }}
                  >
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
    </div>
  );
}

function StateIcon({ state }: { state: Step["state"] }) {
  if (state === "done") return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
  if (state === "sent") return <Clock className="h-4 w-4 shrink-0 text-amber-600" />;
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />;
}
