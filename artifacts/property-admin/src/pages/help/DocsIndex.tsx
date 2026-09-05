/** 도움말 → 매뉴얼 (Docs 리스트) — 사내 규정·지침·매뉴얼·서식의 통합 관리대장.
 *
 *  목록의 정본은 `doc-meta.ts`의 DOC_REGISTRY다. 이 화면은 그 레지스트리를
 *  분류·상태로 걸러 보여주고, 정기검토 기한이 지난 문서와 아직 작성되지 않은
 *  문서를 눈에 띄게 드러내는 것이 목적이다 — "몇 건 있다"가 아니라 "무엇이
 *  비어 있다"를 답하는 화면. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { BookOpen, Search, ExternalLink, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import {
  DOC_CATEGORIES,
  DOC_REGISTRY,
  isReviewOverdue,
  nextReviewDate,
  type DocCategory,
  type DocEntry,
  type DocStatus,
} from "./doc-meta";

type CategoryFilter = "all" | DocCategory;
type StatusFilter = "all" | DocStatus | "overdue";

/** 상태 배지 색. 구속력 있는 문서(live)만 초록, 공백(missing)은 붉게 — 색이
 *  곧 "이 문서를 믿고 따라도 되는가"를 답한다. */
const STATUS_CLASS: Record<DocStatus, string> = {
  live: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  review: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  amending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  missing: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  retired: "bg-muted text-muted-foreground",
};

const STATUS_ORDER: DocStatus[] = ["live", "draft", "review", "amending", "missing"];

export default function DocsIndexPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");

  const docs = useMemo(
    () => DOC_REGISTRY.filter((d) => d.status !== "retired"),
    [],
  );

  const title = (d: DocEntry) => t(`help.doc_titles.${d.id}`, d.id);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: docs.length, overdue: 0 };
    for (const d of docs) {
      acc[d.category] = (acc[d.category] ?? 0) + 1;
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      if (isReviewOverdue(d)) acc.overdue += 1;
    }
    return acc;
  }, [docs]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (status === "overdue") {
        if (!isReviewOverdue(d)) return false;
      } else if (status !== "all" && d.status !== status) return false;
      if (!needle) return true;
      return d.id.toLowerCase().includes(needle) || title(d).toLowerCase().includes(needle);
    });
    // title() reads from i18n; re-run when the language changes via t identity.
  }, [docs, category, status, q, t]);

  const stats = [
    { key: "total", value: docs.length, tone: "" },
    { key: "live", value: counts.live ?? 0, tone: "" },
    { key: "pending", value: (counts.draft ?? 0) + (counts.review ?? 0) + (counts.amending ?? 0), tone: "text-amber-600 dark:text-amber-400" },
    { key: "missing", value: counts.missing ?? 0, tone: "text-red-600 dark:text-red-400" },
    { key: "overdue", value: counts.overdue, tone: "text-red-600 dark:text-red-400" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            <BookOpen size={14} /> {t("help.eyebrow")}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{t("help.docs_title")}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("help.docs_subtitle")}
          </p>
        </div>

        {/* 요약 — 총 건수가 아니라 "비어 있는 것"이 이 줄의 요점이다. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5 bg-card p-4">
              <span className="text-xs text-muted-foreground">{t(`help.stat.${s.key}`)}</span>
              <span className={`text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* 분류 탭 */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          {(["all", ...DOC_CATEGORIES] as CategoryFilter[]).map((key) => {
            const active = key === category;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`help.category.${key}`)}
                <span className="text-xs font-bold tabular-nums opacity-80">{counts[key] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* 상태 필터 + 검색 */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...STATUS_ORDER, "overdue"] as StatusFilter[]).map((key) => {
            const active = key === status;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                aria-pressed={active}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 ${
                  active ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {key === "all" ? t("help.status_all") : key === "overdue" ? t("help.overdue") : t(`help.status.${key}`)}
              </button>
            );
          })}
          <div className="relative ml-auto w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("help.search_placeholder")}
              aria-label={t("help.search_placeholder")}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{t("help.col.id")}</TableHead>
                <TableHead className="min-w-[220px]">{t("help.col.title")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("help.col.kind")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("help.col.owner")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("help.col.status")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("help.col.issued")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("help.col.revised")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("help.col.next_review")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((d) => {
                const overdue = isReviewOverdue(d);
                const next = nextReviewDate(d);
                return (
                  <TableRow key={d.id} className={d.status === "missing" ? "bg-red-50/50 dark:bg-red-950/20" : undefined}>
                    <TableCell className="whitespace-nowrap font-mono font-semibold text-primary">{d.id}</TableCell>
                    <TableCell>
                      {d.href ? (
                        <Link href={d.href} className="underline-offset-4 hover:underline">
                          {title(d)}
                        </Link>
                      ) : d.externalUrl ? (
                        <a
                          href={d.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                        >
                          {title(d)}
                          <ExternalLink size={13} className="text-muted-foreground" />
                        </a>
                      ) : (
                        <span className={d.status === "missing" ? "text-muted-foreground" : undefined}>{title(d)}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{t(`help.kind.${d.kind}`)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{t(`help.owner.${d.owner}`)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[d.status]}`}>
                        {t(`help.status.${d.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {d.issued ? formatDate(d.issued) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {d.revised ? formatDate(d.revised) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {next ? (
                        <span className={overdue ? "inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                          {overdue && <AlertTriangle size={13} />}
                          {formatDate(next)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    {t("help.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("help.footnote", { count: visible.length })}
        </p>
      </div>
    </Layout>
  );
}
