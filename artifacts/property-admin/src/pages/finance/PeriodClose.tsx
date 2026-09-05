/** 재무 → 기간 마감 — FIN-001 제6·7조.
 *
 *  한 해 12칸을 한눈에 놓고 각 달을 마감·해제·확정한다. 마감 버튼 옆에 그 달의
 *  거래 건수와 **아직 결재 중인 지출결의 건수**를 함께 보여 주는 것이 요점이다 —
 *  결재가 걸린 채로 마감하면 그 결의는 영원히 그 달에 들어갈 수 없다. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, ShieldCheck, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";

type PeriodStatus = "open" | "closed" | "locked";

type Period = {
  year: number;
  month: number;
  status: PeriodStatus;
  closed_at: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  locked_at: string | null;
  transaction_count: number;
  pending_claims: number;
  unposted_count: number;
};

const STATUS_CARD: Record<PeriodStatus, string> = {
  open: "border-border bg-card",
  closed: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  locked: "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
};

const STATUS_TEXT: Record<PeriodStatus, string> = {
  open: "text-muted-foreground",
  closed: "text-amber-700 dark:text-amber-300",
  locked: "text-emerald-700 dark:text-emerald-300",
};

export default function PeriodClosePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [reopenOn, setReopenOn] = useState<Period | null>(null);
  const [reason, setReason] = useState("");

  const { data } = useQuery<{ data: Period[] }>({
    queryKey: ["accounting-periods", year],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/accounting-periods?year=${year}`);
      if (!res.ok) throw new Error("Failed to load periods");
      return res.json();
    },
  });
  const periods = data?.data ?? [];

  const act = useMutation({
    mutationFn: async ({ p, verb, reason }: { p: Period; verb: "close" | "reopen" | "lock"; reason?: string }) => {
      const res = await apiFetch(`/api/v1/accounting-periods/${p.year}/${p.month}/${verb}`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed");
      return body;
    },
    onSuccess: (_r, v) => {
      toast({ title: t(`period.toast_${v.verb}`) });
      setReopenOn(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["accounting-periods"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("period.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("period.subtitle")}</p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">{t("period.rule_title")}</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>· {t("period.rule_open")}</li>
            <li>· {t("period.rule_closed")}</li>
            <li>· {t("period.rule_locked")}</li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)} aria-label={t("period.prev_year")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold tabular-nums">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)} aria-label={t("period.next_year")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {periods.map((p) => (
            <div key={p.month} className={`flex flex-col gap-2 rounded-lg border p-4 ${STATUS_CARD[p.status]}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold tabular-nums">{t("period.month_label", { month: p.month })}</span>
                <span className={`text-xs font-medium ${STATUS_TEXT[p.status]}`}>{t(`period.status.${p.status}`)}</span>
              </div>

              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div>{t("period.txn_count", { count: p.transaction_count })}</div>
                {p.unposted_count > 0 && <div>{t("period.unposted_count", { count: p.unposted_count })}</div>}
                {p.pending_claims > 0 && (
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={12} />
                    {t("period.pending_claims", { count: p.pending_claims })}
                  </div>
                )}
                {p.closed_at && p.status !== "open" && <div>{t("period.closed_on", { date: formatDate(p.closed_at) })}</div>}
                {p.locked_at && <div>{t("period.locked_on", { date: formatDate(p.locked_at) })}</div>}
                {p.reopen_reason && <div className="italic">{t("period.reopened_note", { reason: p.reopen_reason })}</div>}
              </div>

              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {p.status === "open" && (
                  <Button size="sm" variant="outline" disabled={act.isPending}
                    onClick={() => act.mutate({ p, verb: "close" })}>
                    <Lock className="mr-1 h-3.5 w-3.5" />{t("period.close")}
                  </Button>
                )}
                {p.status === "closed" && (
                  <>
                    <Button size="sm" variant="outline" disabled={act.isPending}
                      onClick={() => { setReopenOn(p); setReason(""); }}>
                      <LockOpen className="mr-1 h-3.5 w-3.5" />{t("period.reopen")}
                    </Button>
                    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ p, verb: "lock" })}>
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />{t("period.lock")}
                    </Button>
                  </>
                )}
                {p.status === "locked" && (
                  <span className="text-xs text-muted-foreground">{t("period.locked_final")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={reopenOn !== null} onOpenChange={(o) => !o && setReopenOn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("period.reopen_title")}</DialogTitle>
            <DialogDescription>
              {reopenOn && `${reopenOn.year} · ${t("period.month_label", { month: reopenOn.month })}`}
              {" — "}
              {t("period.reopen_desc")}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder={t("period.reopen_reason_required")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOn(null)}>{t("common.cancel")}</Button>
            <Button disabled={act.isPending || reason.trim() === ""}
              onClick={() => reopenOn && act.mutate({ p: reopenOn, verb: "reopen", reason: reason.trim() })}>
              {t("period.reopen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
