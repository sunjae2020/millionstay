import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, ExternalLink, Minus, X } from "lucide-react";
import { apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";

/**
 * 서류 점검 — what is missing, and what is about to expire.
 *
 * Two questions that look different but are the same one: which tenancies need
 * someone to do something about their paperwork. They share a screen because
 * they share an answer — the row you act on is the same contract either way.
 *
 * Nothing here writes. It is a worklist: every row links to the contract where
 * the missing document actually gets uploaded.
 */

interface ChecklistLine {
  doc_type: string;
  level: "required" | "recommended";
  present: boolean;
}

interface ComplianceRow {
  contract_id: number;
  contract_ref: string;
  status: string;
  space_id: number | null;
  space_name: string | null;
  tenant_name: string | null;
  start_date: string | null;
  end_date: string | null;
  days_to_expiry: number | null;
  checklist: ChecklistLine[];
  missing_required: string[];
  complete: boolean;
  has_successor: boolean;
  detail_url: string;
}

interface ComplianceResponse {
  rows: ComplianceRow[];
  horizon_days: number;
  checklist: Array<{ doc_type: string; level: "required" | "recommended" }>;
  summary: { total: number; incomplete: number; expired: number; expiring: number };
}

type View = "incomplete" | "expiring" | "all";

/** Horizons offered for "about to expire". 90 days ≈ a renewal notice period. */
const HORIZONS = [30, 60, 90, 180];

export default function DocumentCompliance() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("incomplete");
  const [horizon, setHorizon] = useState(90);

  const { data, isLoading } = useQuery<ComplianceResponse>({
    queryKey: ["document-compliance", horizon],
    queryFn: () => apiJson<ComplianceResponse>(`/api/v1/documents/compliance?days=${horizon}`),
  });

  const typeLabel = (value: string) => t(`doc_type.${value}`, value);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (view === "incomplete") return all.filter((r) => !r.complete);
    if (view === "expiring") {
      // A tenancy whose unit already has a successor is not an outstanding
      // renewal, however close its end date is.
      return all.filter((r) =>
        r.days_to_expiry != null && r.days_to_expiry <= horizon && !r.has_successor);
    }
    return all;
  }, [data, view, horizon]);

  /** How urgent an end date is — drives the colour, not just the number. */
  function expiryTone(days: number | null, hasSuccessor: boolean): string {
    if (days == null) return "text-muted-foreground";
    if (hasSuccessor) return "text-muted-foreground";
    if (days < 0) return "text-red-600 font-medium";
    if (days <= 30) return "text-amber-600 font-medium";
    return "text-muted-foreground";
  }

  function expiryText(row: ComplianceRow): string {
    if (row.days_to_expiry == null) return "—";
    if (row.days_to_expiry < 0) return t("compliance.expiredAgo", "{{n}}일 지남", { n: -row.days_to_expiry });
    return t("compliance.inDays", "D-{{n}}", { n: row.days_to_expiry });
  }

  const TABS: Array<{ key: View; label: string; count?: number }> = [
    { key: "incomplete", label: t("compliance.tab.incomplete", "Missing documents"), count: data?.summary.incomplete },
    { key: "expiring", label: t("compliance.tab.expiring", "Expiring soon"), count: (data?.summary.expiring ?? 0) + (data?.summary.expired ?? 0) },
    { key: "all", label: t("compliance.tab.all", "All contracts"), count: data?.summary.total },
  ];

  return (
    <Layout>
      <PageHeader
        title={t("compliance.title", "Document check")}
        subtitle={t("compliance.subtitle", "Tenancies missing required paperwork, and those coming up for renewal.")}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={view === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setView(tab.key)}
          >
            {tab.label}
            {tab.count != null && <span className="ml-1.5 opacity-70">{tab.count}</span>}
          </Button>
        ))}

        {view === "expiring" && (
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="ml-2 h-9 rounded-md border bg-background px-2 text-sm"
          >
            {HORIZONS.map((d) => (
              <option key={d} value={d}>{t("compliance.withinDays", "Within {{n}} days", { n: d })}</option>
            ))}
          </select>
        )}
      </div>

      {/* The checklist itself, so the columns below are readable without
          guessing what the office decided "complete" means. */}
      {data?.checklist?.length ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {t("compliance.legend", "Required")}:{" "}
          {data.checklist.filter((c) => c.level === "required").map((c) => typeLabel(c.doc_type)).join(" · ")}
          {" — "}
          {t("compliance.legendRecommended", "Recommended")}:{" "}
          {data.checklist.filter((c) => c.level === "recommended").map((c) => typeLabel(c.doc_type)).join(" · ")}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {["col_contract", "col_unit", "col_tenant", "col_term", "col_expiry", "col_docs"].map((k) => (
                <th key={k} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`compliance.${k}`, k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("common.loading", "Loading…")}</td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {view === "incomplete"
                  ? t("compliance.allComplete", "Every tenancy has its required paperwork.")
                  : t("compliance.noneExpiring", "Nothing is due for renewal in this window.")}
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.contract_id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={r.detail_url} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {r.contract_ref}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.space_name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.tenant_name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(r.start_date)} ~ {formatDate(r.end_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={expiryTone(r.days_to_expiry, r.has_successor)}>{expiryText(r)}</span>
                    {/* Renewed units are the reason a past end date can be fine. */}
                    {r.has_successor && (
                      <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-700">
                        {t("compliance.renewed", "Renewed")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {r.checklist.map((line) => (
                        <span
                          key={line.doc_type}
                          title={t(`compliance.level.${line.level}`, line.level)}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
                            line.present
                              ? "bg-green-100 text-green-700"
                              : line.level === "required"
                                ? "bg-red-100 text-red-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {line.present
                            ? <Check className="h-3 w-3" />
                            : line.level === "required"
                              ? <X className="h-3 w-3" />
                              : <Minus className="h-3 w-3" />}
                          {typeLabel(line.doc_type)}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.summary.expired > 0 && view !== "expiring" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("compliance.expiredNotice", "{{n}} tenancies are past their end date with no successor.", { n: data.summary.expired })}
        </p>
      )}
    </Layout>
  );
}
