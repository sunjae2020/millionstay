import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Search, Sparkles, ExternalLink, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { useCmsSites } from "./useCmsSites";
import { SiteSwitcher } from "./CmsPagesList";

// ---------------------------------------------------------------------------
// CMS → SEO · GEO. One row per public page, scored out of 100 across eight
// categories, worst first — the screen is a work queue, not a report.
//
// Two things it deliberately does NOT do: it never changes a page by itself
// (an audit is a measurement), and it never publishes AI text without someone
// pressing Approve.
// ---------------------------------------------------------------------------

/**
 * A readable message out of any error body this API can return. The auth layer
 * answers `{ error: { code, message } }` while the route handlers answer
 * `{ error: "text" }`, and passing the first shape to `new Error()` is what put
 * a literal "[object Object]" in front of the user.
 */
async function errorText(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "SESSION_EXPIRED";
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return fallback;
  }
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

type EntityType = "page" | "blog" | "listing";

interface OverviewRow {
  entityType: EntityType;
  entityId: number;
  title: string;
  slug: string;
  path: string;
  status: string;
  locale: string;
  localeCount: number;
  editHref: string;
  scoreTotal: number | null;
  version: number | null;
  gapCount: number;
  highGapCount: number;
  hasDrafts: boolean;
  auditedAt: string | null;
  source: string | null;
}

interface Overview {
  site: {
    site_key: string;
    label: string;
    origin: string;
    default_locale: string;
    is_primary: boolean;
    has_organization_schema: boolean;
    serves_llms_txt: boolean;
    robots_has_ai_rules: boolean;
  };
  averageScore: number | null;
  auditedCount: number;
  totalCount: number;
  rows: OverviewRow[];
}

interface Gap {
  code: string;
  label: string;
  severity: "high" | "medium" | "low";
  category: string;
}

interface FaqPair {
  q: string;
  a: string;
}

interface Audit {
  version: number;
  scoreTotal: number;
  scores: Record<string, { score: number; max: number }>;
  gaps: Gap[];
  drift: { scoreDelta: number; added: Gap[]; resolved: Gap[] };
  generated: { seo_description?: string; geo_answer_summary?: string; geo_faq?: FaqPair[] };
  source: string;
  auditedBy: string | null;
  auditedAt: string;
}

const CATEGORY_ORDER = ["meta", "schema", "geo", "content", "signals", "robots", "llms", "brand"];

/** Green at 80, amber at 55 — the thresholds the score badge and bars share. */
function scoreTone(score: number, max = 100): "good" | "warn" | "bad" {
  const ratio = max > 0 ? (score / max) * 100 : 0;
  if (ratio >= 80) return "good";
  if (ratio >= 55) return "warn";
  return "bad";
}

const TONE_BADGE: Record<string, string> = {
  good: "border-green-400 bg-green-50 text-green-700",
  warn: "border-amber-400 bg-amber-50 text-amber-700",
  bad: "border-red-400 bg-red-50 text-red-700",
};
const TONE_BAR: Record<string, string> = {
  good: "bg-green-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};
const SEVERITY_BADGE: Record<string, string> = {
  high: "border-red-400 text-red-700",
  medium: "border-amber-400 text-amber-700",
  low: "border-muted-foreground/30 text-muted-foreground",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge variant="outline" className={`tabular-nums ${TONE_BADGE[scoreTone(score)]}`}>
      {score}
    </Badge>
  );
}

export default function CmsSeo() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { sites, siteKey, setSiteKey } = useCmsSites();
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<OverviewRow | null>(null);

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["seo-overview", siteKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/seo/overview?site=${encodeURIComponent(siteKey)}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: Boolean(siteKey),
  });

  const refreshOne = useMutation({
    mutationFn: async ({ row, generate }: { row: OverviewRow; generate: boolean }) => {
      const res = await apiFetch(`/api/v1/seo/${row.entityType}/${row.entityId}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteKey, generate }),
      });
      if (!res.ok) throw new Error(await errorText(res, t("seo.refresh_failed")));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-overview", siteKey] });
      qc.invalidateQueries({ queryKey: ["seo-history"] });
      toast({ title: t("seo.refreshed") });
    },
    onError: (err: Error) =>
      toast({
        title: t("seo.refresh_failed"),
        description: err.message === "SESSION_EXPIRED" ? t("seo.session_expired") : err.message,
        variant: "destructive",
      }),
  });

  const refreshAll = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/seo/refresh-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteKey }),
      });
      if (!res.ok) throw new Error(await errorText(res, t("seo.refresh_failed")));
      return res.json() as Promise<{ audited: number; total: number; failures: unknown[] }>;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["seo-overview", siteKey] });
      toast({
        title: t("seo.refreshed_all", { count: result.audited }),
        description: result.failures.length
          ? t("seo.refresh_partial", { count: result.failures.length })
          : undefined,
      });
    },
    onError: (err: Error) =>
      toast({
        title: t("seo.refresh_failed"),
        description: err.message === "SESSION_EXPIRED" ? t("seo.session_expired") : err.message,
        variant: "destructive",
      }),
  });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data?.rows ?? [];
    return (data?.rows ?? []).filter((row) =>
      `${row.title} ${row.slug} ${row.path}`.toLowerCase().includes(term),
    );
  }, [data, query]);

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Sparkles className="h-5 w-5" />
            {t("seo.title")}
          </>
        }
        subtitle={t("seo.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            {data?.averageScore !== null && data?.averageScore !== undefined && (
              <Badge
                variant="outline"
                className={`tabular-nums ${TONE_BADGE[scoreTone(data.averageScore)]}`}
              >
                {t("seo.average_score", { score: data.averageScore })}
              </Badge>
            )}
            <Button onClick={() => refreshAll.mutate()} disabled={refreshAll.isPending || !siteKey}>
              {refreshAll.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("seo.refresh_all")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <SiteSwitcher sites={sites} value={siteKey} onChange={setSiteKey} />

        {/* Site-level facts every page inherits — a missing one caps every score
            on the site, so it belongs above the table, not inside a row. */}
        {data && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <SiteFlag ok={data.site.robots_has_ai_rules} label={t("seo.flag_robots")} />
            <SiteFlag ok={data.site.serves_llms_txt} label={t("seo.flag_llms")} />
            <SiteFlag ok={data.site.has_organization_schema} label={t("seo.flag_organization")} />
            <SiteFlag ok={Boolean(data.site.origin)} label={t("seo.flag_origin")} />
          </div>
        )}

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("seo.search")}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">{t("seo.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t("seo.col_page")}</th>
                      <th className="px-4 py-2 font-medium">{t("seo.col_type")}</th>
                      <th className="px-4 py-2 font-medium">{t("seo.col_score")}</th>
                      <th className="px-4 py-2 font-medium">{t("seo.col_gaps")}</th>
                      <th className="px-4 py-2 font-medium">{t("seo.col_version")}</th>
                      <th className="px-4 py-2 font-medium">{t("seo.col_audited")}</th>
                      <th className="px-4 py-2 font-medium text-right">{t("seo.col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.entityType}:${row.entityId}`}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-2">
                          <button
                            onClick={() => navigate(row.editHref)}
                            className="text-left font-medium hover:underline"
                          >
                            {row.title || row.slug}
                          </button>
                          <div className="text-xs text-muted-foreground">
                            {row.path} · {row.status} · {t("seo.locale_count", { count: row.localeCount })}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {t(`seo.type_${row.entityType}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <ScoreBadge score={row.scoreTotal} />
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {row.scoreTotal === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              {row.highGapCount > 0 && (
                                <span className="font-semibold text-red-600">
                                  {t("seo.high_gaps", { count: row.highGapCount })}
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {row.highGapCount > 0 ? " · " : ""}
                                {t("seo.total_gaps", { count: row.gapCount })}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {row.version ? `v${row.version}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {row.auditedAt ? formatDate(row.auditedAt) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {row.hasDrafts && (
                              <Badge
                                variant="outline"
                                className="border-violet-400 text-violet-700 text-[10px]"
                              >
                                {t("seo.ai_badge")}
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>
                              {t("seo.details")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("seo.refresh_with_ai")}
                              disabled={refreshOne.isPending}
                              onClick={() => refreshOne.mutate({ row, generate: true })}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {detail && (
        <SeoDetailDialog
          row={detail}
          siteKey={siteKey}
          origin={data?.site.origin ?? ""}
          onClose={() => setDetail(null)}
        />
      )}
    </Layout>
  );
}

function SiteFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={ok ? "border-green-400 text-green-700" : "border-amber-400 text-amber-700"}
    >
      {ok ? "✓" : "!"} {label}
    </Badge>
  );
}

// ── Details ────────────────────────────────────────────────────────────────

function SeoDetailDialog({
  row,
  siteKey,
  origin,
  onClose,
}: {
  row: OverviewRow;
  siteKey: string;
  origin: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ history: Audit[] }>({
    queryKey: ["seo-history", siteKey, row.entityType, row.entityId],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/v1/seo/${row.entityType}/${row.entityId}/history?site=${encodeURIComponent(siteKey)}`,
      );
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const latest = data?.history?.[0] ?? null;
  const drafts = latest?.generated ?? {};
  const hasDrafts = Object.keys(drafts).length > 0;

  const apply = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/seo/${row.entityType}/${row.entityId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteKey, ...drafts }),
      });
      if (!res.ok) throw new Error(await errorText(res, t("seo.apply_failed")));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-overview", siteKey] });
      qc.invalidateQueries({ queryKey: ["seo-history", siteKey, row.entityType, row.entityId] });
      toast({ title: t("seo.applied") });
    },
    onError: (err: Error) =>
      toast({
        title: t("seo.apply_failed"),
        description: err.message === "SESSION_EXPIRED" ? t("seo.session_expired") : err.message,
        variant: "destructive",
      }),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {row.title || row.slug}
            <ScoreBadge score={latest?.scoreTotal ?? row.scoreTotal} />
          </DialogTitle>
        </DialogHeader>

        {origin && (
          <a
            href={`${origin}${row.path}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            {origin}
            {row.path}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !latest ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("seo.never_audited")}</p>
        ) : (
          <div className="space-y-6">
            {/* Category bars */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("seo.categories")}</h3>
              {CATEGORY_ORDER.filter((key) => latest.scores[key]).map((key) => {
                const entry = latest.scores[key]!;
                const tone = scoreTone(entry.score, entry.max);
                const pct = entry.max > 0 ? (entry.score / entry.max) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 text-muted-foreground">
                      {t(`seo.cat_${key}`)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${TONE_BAR[tone]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                      {entry.score}/{entry.max}
                    </span>
                  </div>
                );
              })}
            </section>

            {/* AI drafts awaiting approval */}
            {hasDrafts && (
              <Card className="border-violet-300 bg-violet-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    {t("seo.drafts_title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <p className="text-muted-foreground">{t("seo.drafts_hint")}</p>
                  {drafts.seo_description && (
                    <div>
                      <div className="font-medium">{t("seo.draft_description")}</div>
                      <p className="mt-1 rounded border bg-background p-2">
                        {drafts.seo_description}
                      </p>
                    </div>
                  )}
                  {drafts.geo_answer_summary && (
                    <div>
                      <div className="font-medium">{t("seo.draft_answer")}</div>
                      <p className="mt-1 whitespace-pre-wrap rounded border bg-background p-2">
                        {drafts.geo_answer_summary}
                      </p>
                    </div>
                  )}
                  {drafts.geo_faq && drafts.geo_faq.length > 0 && (
                    <div>
                      <div className="font-medium">{t("seo.draft_faq")}</div>
                      <div className="mt-1 space-y-2 rounded border bg-background p-2">
                        {drafts.geo_faq.map((pair, index) => (
                          <div key={index}>
                            <div className="font-medium">{pair.q}</div>
                            <div className="text-muted-foreground">{pair.a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending}>
                    {apply.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    {t("seo.approve_apply")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Gaps */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("seo.gaps")}</h3>
              {latest.gaps.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("seo.no_gaps")}</p>
              ) : (
                <ul className="space-y-1">
                  {latest.gaps.map((gap) => (
                    <li key={gap.code} className="flex items-start gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] ${SEVERITY_BADGE[gap.severity]}`}
                      >
                        {t(`seo.sev_${gap.severity}`)}
                      </Badge>
                      <span>{t(`seo.gap_${gap.code}`, gap.label)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Version history */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("seo.history")}</h3>
              <div className="space-y-1 text-xs">
                {data?.history.map((audit) => (
                  <div
                    key={audit.version}
                    className="flex items-center justify-between rounded border px-2 py-1"
                  >
                    <span className="text-muted-foreground">v{audit.version}</span>
                    <span className="tabular-nums">{audit.scoreTotal}</span>
                    <span
                      className={
                        audit.drift.scoreDelta > 0
                          ? "text-green-700"
                          : audit.drift.scoreDelta < 0
                            ? "text-red-700"
                            : "text-muted-foreground"
                      }
                    >
                      {audit.drift.scoreDelta > 0 ? "+" : ""}
                      {audit.drift.scoreDelta}
                    </span>
                    <span className="text-muted-foreground">{t(`seo.source_${audit.source}`)}</span>
                    <span className="text-muted-foreground">{formatDate(audit.auditedAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
