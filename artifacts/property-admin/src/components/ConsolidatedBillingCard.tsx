/**
 * 통합(단체) 청구 설정 — 계정 상세 > 인보이스 탭.
 *
 * 여러 공간을 임차하는 법인 세입자(예: 재원산업)를 월 1회 한 장의 청구서로 묶어
 * 청구·수납한다. 여기서 켜고, 청구 기준일과 지난달 일할계산 이월 여부를 고른다.
 * 공간별 인보이스는 그대로 남고(회계·정산의 정본) 통합 청구서의 자식으로 묶인다.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiJson } from "@/lib/apiFetch";
import { getGetAccountQueryKey, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { Layers, RefreshCw, Save } from "lucide-react";

// 1~28만 고른다 — 29~31은 달마다 존재하지 않아 청구일이 흔들린다.
const BILLING_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export interface ConsolidatedBillingSettings {
  consolidated_billing_enabled?: boolean | null;
  consolidated_billing_day?: number | null;
  consolidated_prorate_enabled?: boolean | null;
  consolidated_issue_day?: number | null;
  consolidated_issue_next_month?: boolean | null;
}

/** 발행 주기 설정으로 다음 생성 대상 월을 계산한다(화면 안내와 "지금 생성"이 같은 값을 쓴다). */
function targetPeriod(issueDay: number | null, nextMonth: boolean): { year: number; month: number } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (issueDay == null || !nextMonth) return { year: y, month: m };
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
}

type RunResult = { accounts: number; invoices: number; children: number; prorated: number; skipped: number };

export function ConsolidatedBillingCard({
  accountId,
  account,
}: {
  accountId: number;
  account: ConsolidatedBillingSettings | undefined;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState(1);
  const [prorate, setProrate] = useState(true);
  const [issueDay, setIssueDay] = useState<number | null>(null);
  const [issueNextMonth, setIssueNextMonth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setEnabled(!!account.consolidated_billing_enabled);
    setDay(account.consolidated_billing_day ?? 1);
    setProrate(account.consolidated_prorate_enabled ?? true);
    setIssueDay(account.consolidated_issue_day ?? null);
    setIssueNextMonth(account.consolidated_issue_next_month ?? true);
  }, [account]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/api/v1/accounts/${accountId}/billing-settings`, {
        method: "PUT",
        body: JSON.stringify({
          consolidated_billing_enabled: enabled,
          consolidated_billing_day: day,
          consolidated_prorate_enabled: prorate,
          consolidated_issue_day: issueDay,
          consolidated_issue_next_month: issueNextMonth,
        }),
      });
      qc.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
      setMessage(t("account.consolidated_saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.consolidated_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  /** 설정된 대상 월(기본: 다음 달분)의 통합 청구서를 지금 생성/재계산한다 — 크론과 같은 경로, 멱등. */
  async function runNow() {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiJson<RunResult>("/api/v1/invoices/consolidated/run", {
        method: "POST",
        body: JSON.stringify({ account_id: accountId, ...targetPeriod(issueDay, issueNextMonth) }),
      });
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey({ account_id: accountId }) });
      qc.invalidateQueries({ queryKey: ["account-finance", String(accountId)] });
      setMessage(
        result.children > 0
          ? t("account.consolidated_run_done", { spaces: result.children, prorated: result.prorated })
          : t("account.consolidated_run_empty"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.consolidated_run_failed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">{t("account.consolidated_title")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t("account.consolidated_hint")}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t("account.consolidated_title")} />
      </div>

      {enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("account.consolidated_billing_day")}</Label>
            <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{t("account.consolidated_day_label", { day: d })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{t("account.consolidated_billing_day_hint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("account.consolidated_prorate")}</Label>
            <div className="flex items-center gap-2.5 h-9">
              <Switch checked={prorate} onCheckedChange={setProrate} aria-label={t("account.consolidated_prorate")} />
              <span className="text-sm text-muted-foreground">
                {prorate ? t("common.enabled") : t("common.disabled")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("account.consolidated_prorate_hint")}</p>
          </div>

          {/* 발행 주기 — "매월 28일에 다음 달분 생성"처럼 세입자와 합의된 주기를 넣는다. */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("account.consolidated_issue_day")}</Label>
            <Select
              value={issueDay == null ? "none" : String(issueDay)}
              onValueChange={(v) => setIssueDay(v === "none" ? null : Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("account.consolidated_issue_day_none")}</SelectItem>
                {BILLING_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{t("account.consolidated_day_label", { day: d })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{t("account.consolidated_issue_day_hint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("account.consolidated_issue_target")}</Label>
            <Select
              value={issueNextMonth ? "next" : "current"}
              onValueChange={(v) => setIssueNextMonth(v === "next")}
              disabled={issueDay == null}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="next">{t("account.consolidated_target_next")}</SelectItem>
                <SelectItem value="current">{t("account.consolidated_target_current")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {issueDay == null
                ? t("account.consolidated_issue_target_off")
                : t("account.consolidated_issue_target_hint", {
                    day: issueDay,
                    period: `${targetPeriod(issueDay, issueNextMonth).year}-${String(targetPeriod(issueDay, issueNextMonth).month).padStart(2, "0")}`,
                  })}
            </p>
          </div>

          {/* 생성 = 발송이 아니다. 메일은 사람이 확인하고 보낸다. */}
          <div className="sm:col-span-2 rounded-md border border-dashed bg-muted/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{t("account.consolidated_manual_send_hint")}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        {enabled && (
          <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${running ? "animate-spin" : ""}`} />
            {t("account.consolidated_run")}
          </Button>
        )}
        {message && <span className="text-xs text-emerald-600">{message}</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
