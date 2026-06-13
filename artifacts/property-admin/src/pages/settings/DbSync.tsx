import { useEffect, useState } from "react";
import { formatDateTime as fmtDateTime } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import {
  Database,
  FileText,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface SeedInfo {
  exists: boolean;
  path: string;
  sizeBytes: number | null;
  lineCount: number | null;
  insertCount: number | null;
  setvalCount: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  isProductionDb: boolean;
}

interface ImportResult {
  executed: number;
  errors: number;
  total: number;
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(iso: string | null): string {
  return fmtDateTime(iso);
}

function formatNumber(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

type Banner =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string }
  | null;

export default function DbSync() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [info, setInfo] = useState<SeedInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function refresh() {
    setLoadingInfo(true);
    try {
      const res = await apiFetch("/api/v1/admin/db-sync/info");
      const data = await res.json();
      if (res.ok && data.success) {
        setInfo(data.info);
      } else {
        setBanner({ kind: "error", text: data?.error?.message ?? t("settings_dbsync.load_info_failed") });
      }
    } catch (err: any) {
      setBanner({ kind: "error", text: err?.message ?? t("settings_dbsync.load_info_failed") });
    } finally {
      setLoadingInfo(false);
    }
  }

  const isSuperAdmin =
    !!user && ["Super Admin", "SuperAdmin", "superadmin", "super_admin"].includes(user.role);

  useEffect(() => {
    if (isSuperAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  if (user && !isSuperAdmin) {
    return <Redirect to="/settings" />;
  }

  async function handleExport() {
    setBanner(null);
    setImportResult(null);
    setExporting(true);
    try {
      const res = await apiFetch("/api/v1/admin/db-sync/export", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setInfo(data.info);
        setBanner({
          kind: "success",
          text: t("settings_dbsync.export_success", {
            size: formatBytes(data.info.sizeBytes),
            inserts: formatNumber(data.info.insertCount),
          }),
        });
      } else {
        setBanner({ kind: "error", text: data?.error?.message ?? t("settings_dbsync.export_failed") });
      }
    } catch (err: any) {
      setBanner({ kind: "error", text: err?.message ?? t("settings_dbsync.export_failed") });
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!window.confirm(t("settings_dbsync.import_confirm"))) {
      return;
    }
    setBanner(null);
    setImportResult(null);
    setImporting(true);
    try {
      const res = await apiFetch("/api/v1/admin/db-sync/import", {
        method: "POST",
        headers: { "x-confirm-import": "I-UNDERSTAND-DATA-WILL-BE-DELETED" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInfo(data.info);
        setImportResult(data.result);
        setBanner({
          kind: "success",
          text:
            t("settings_dbsync.import_success", {
              executed: data.result.executed,
              total: data.result.total,
            }) +
            (data.result.errors
              ? " " + t("settings_dbsync.import_success_errors", { errors: data.result.errors })
              : ""),
        });
      } else {
        // Surface rollback details when the server aborts a partial restore.
        if (data?.error?.code === "IMPORT_ROLLED_BACK") {
          setImportResult({
            executed: data.error.executed ?? 0,
            errors: data.error.errors ?? 0,
            total: data.error.total ?? 0,
          });
        }
        setBanner({ kind: "error", text: data?.error?.message ?? t("settings_dbsync.import_failed") });
      }
    } catch (err: any) {
      setBanner({ kind: "error", text: err?.message ?? t("settings_dbsync.import_failed") });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Layout>
      <PageHeader title={t("settings_dbsync.page_title")} />

      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Database className="h-5 w-5 text-orange-500" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">{t("settings_dbsync.heading")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t("settings_dbsync.intro")}
          </p>
        </div>

        {banner && (
          <div
            className={
              banner.kind === "success"
                ? "flex items-start gap-2 p-3 rounded-md border border-green-200 bg-green-50 text-sm text-green-800"
                : "flex items-start gap-2 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-800"
            }
          >
            {banner.kind === "success" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Snapshot info card */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("settings_dbsync.current_snapshot")}{" "}
                <span className="font-normal text-muted-foreground">(seed-migration.sql)</span>
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loadingInfo}
              data-testid="button-refresh-info"
            >
              <RefreshCw className={`h-4 w-4 ${loadingInfo ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loadingInfo && !info ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : info && !info.exists ? (
            <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{t("settings_dbsync.no_snapshot")}</span>
            </div>
          ) : info ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label={t("settings_dbsync.field_file_size")} value={formatBytes(info.sizeBytes)} />
              <Field
                label={t("settings_dbsync.field_total_lines")}
                value={
                  info.lineCount != null
                    ? t("settings_dbsync.lines_count", { count: formatNumber(info.lineCount) })
                    : "—"
                }
              />
              <Field label={t("settings_dbsync.field_created")} value={formatDateTime(info.createdAt)} />
              <Field label={t("settings_dbsync.field_last_modified")} value={formatDateTime(info.modifiedAt)} />
              <Field
                label={t("settings_dbsync.field_insert_statements")}
                value={info.insertCount != null ? formatNumber(info.insertCount) : "—"}
              />
              <Field
                label={t("settings_dbsync.field_sequence_resets")}
                value={info.setvalCount != null ? formatNumber(info.setvalCount) : "—"}
              />
            </div>
          ) : null}
        </div>

        <div className="h-px bg-border" />

        {/* Step 1 — Export */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("settings_dbsync.step1_title")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings_dbsync.step1_desc_before")}
            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">seed-migration.sql</code>
            {t("settings_dbsync.step1_desc_after")}
          </p>

          <div className="flex items-start gap-2 p-3 mb-4 rounded-md border border-muted bg-muted/40 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{t("settings_dbsync.step1_duration_note")}</span>
          </div>

          {info?.isProductionDb && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{t("settings_dbsync.export_disabled_prod")}</span>
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={exporting || importing || info?.isProductionDb}
            className="bg-[#E8621A] hover:bg-[#d2551a] text-white"
            data-testid="button-export-snapshot"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("settings_dbsync.generating")}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t("settings_dbsync.generate_snapshot")}
              </>
            )}
          </Button>
        </div>

        {/* Step 2 — Import */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("settings_dbsync.step2_title")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings_dbsync.step2_desc")}
          </p>

          <div className="flex items-start gap-2 p-3 mb-4 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>{t("settings_dbsync.warning_label")}</strong> {t("settings_dbsync.step2_warning")}
            </span>
          </div>

          {importResult && (
            <div className="mb-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div>{t("settings_dbsync.result_statements")}: {formatNumber(importResult.total)}</div>
              <div>{t("settings_dbsync.result_executed")}: {formatNumber(importResult.executed)}</div>
              <div>{t("settings_dbsync.result_errors")}: {formatNumber(importResult.errors)}</div>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={importing || exporting || !info?.exists}
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            data-testid="button-import-snapshot"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("settings_dbsync.importing")}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t("settings_dbsync.import_snapshot")}
              </>
            )}
          </Button>
        </div>

        {/* Recommended workflow */}
        <div className="rounded-lg border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("settings_dbsync.workflow_title")}</h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>{t("settings_dbsync.workflow_step1")}</li>
            <li>{t("settings_dbsync.workflow_step2")}</li>
            <li>{t("settings_dbsync.workflow_step3")}</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground mt-1">{value}</div>
    </div>
  );
}
