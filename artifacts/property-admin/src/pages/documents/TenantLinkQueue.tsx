import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Banknote, CheckCircle2, ClipboardList, Clock, Copy, ExternalLink, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import type { TenantLink } from "@/components/TenantLinkCard";

interface QueueRow extends TenantLink { context_type: string; context_id: number; context_ref: string | null }

const KINDS = ["", "invoice_pay", "doc_request", "intake"] as const;
const STATUSES = ["", "completed", "viewed", "pending", "expired", "cancelled"] as const;

/**
 * 세입자 링크 대기열 — 상세 화면을 하나씩 열지 않고 "처리할 게 있나"를 한 화면
 * 에서 본다. 기본 필터가 `completed` 인 이유는 그것이 곧 사람이 손대야 할 줄
 * 이기 때문이다: 입금 통보가 들어왔거나 서류 제출이 끝난 링크.
 *
 * 여기서 수납·검수를 처리하지는 않는다. 통장을 보고 청구서를 닫는 일은 청구서
 * 화면의 일이고, 이 목록은 그 화면으로 데려다 주는 역할만 한다.
 */
export default function TenantLinkQueue() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [kind, setKind] = useState<string>("");
  const [status, setStatus] = useState<string>("completed");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tenant-link-queue", kind, status],
    queryFn: async (): Promise<QueueRow[]> => {
      const q = new URLSearchParams();
      if (kind) q.set("kind", kind);
      if (status) q.set("status", status);
      const res = await apiFetch(`/api/v1/tenant-links${q.toString() ? `?${q}` : ""}`);
      if (!res.ok) return [];
      return (await res.json()).data ?? [];
    },
  });

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">{t("tenantLinkQueue.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("tenantLinkQueue.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Filter label={t("tenantLinkQueue.filter_kind")} value={kind} onChange={setKind}
            options={KINDS.map((k) => ({ value: k, label: k ? t(`tenantLink.title_${k}`) : t("tenantLinkQueue.all") }))} />
          <Filter label={t("tenantLinkQueue.filter_status")} value={status} onChange={setStatus}
            options={STATUSES.map((s) => ({ value: s, label: s ? t(`tenantLink.status_${s}`, s) : t("tenantLinkQueue.all") }))} />
        </div>

        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("tenantLinkQueue.col_kind")}</th>
                <th className="px-3 py-2 text-left">{t("tenantLinkQueue.col_target")}</th>
                <th className="px-3 py-2 text-left">{t("tenantLinkQueue.col_status")}</th>
                <th className="px-3 py-2 text-left">{t("tenantLinkQueue.col_submitted")}</th>
                <th className="px-3 py-2 text-left">{t("tenantLinkQueue.col_updated")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t("tenantLinkQueue.empty")}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {r.kind === "invoice_pay" ? <Banknote className="h-3.5 w-3.5 text-primary" /> : r.kind === "intake" ? <ClipboardList className="h-3.5 w-3.5 text-primary" /> : <Upload className="h-3.5 w-3.5 text-primary" />}
                      {t(`tenantLink.title_${r.kind}`, r.kind)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={r.context_type === "invoice" ? `/finance/invoices/${r.context_id}` : `/booking/contracts/${r.context_id}`}
                      className="text-primary hover:underline"
                    >
                      {r.context_ref ?? `${r.context_type} #${r.context_id}`}
                    </Link>
                    {r.sent_to && <span className="ml-2 text-xs text-muted-foreground">{r.sent_to}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.status === "completed" ? "text-green-700" : "text-amber-700"}`}>
                      {r.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {t(`tenantLink.status_${r.status}`, r.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{summarise(r, t)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatDateTime((r as any).updated_at ?? r.created_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5"
                      onClick={() => { navigator.clipboard?.writeText(r.url); toast({ title: t("tenantLink.toast_copied") }); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

/** 세입자가 남긴 것을 한 줄로 — 입금 통보면 입금자·날짜, 서류면 제출 건수. */
function summarise(r: QueueRow, t: (k: string, o?: any) => string): string {
  const subs = Array.isArray(r.submissions) ? r.submissions : [];
  if (r.kind === "invoice_pay") {
    const n = subs.filter((s: any) => s?.event === "paid_notice").slice(-1)[0];
    return n ? `${n.payer_name} · ${n.paid_on}` : "—";
  }
  if (r.kind === "intake") {
    const a = ([...subs].reverse().find((s: any) => s?.event === "intake") as any)?.answers;
    return a ? [a.last_name, a.first_name].filter(Boolean).join("") + (a.mobile_number ? ` · ${a.mobile_number}` : "") : "—";
  }
  const items = (r.payload?.items ?? []).length;
  const submitted = new Set(subs.filter((s: any) => s?.doc_key).map((s: any) => s.doc_key)).size;
  return items ? t("tenantLinkQueue.docs_count", { submitted, total: items }) : "—";
}

function Filter({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="text-sm">
      <span className="mr-2 text-muted-foreground">{label}</span>
      <select className="rounded-md border px-2 py-1" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
