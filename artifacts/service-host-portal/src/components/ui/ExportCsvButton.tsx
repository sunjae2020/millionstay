import { useRef, type ReactNode, type TableHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { csvFileName, downloadCsv, tableElementToCsv } from "@/lib/csv";
import { useToast } from "@/hooks/use-toast";

/**
 * CSV export for hand-rolled `<table>`s (detail-page sub-tables, dashboard
 * tabs). Wrap the table in `<CsvExportable>` and it exports exactly what is
 * rendered. Declarative lists use `DataTable`'s built-in export instead.
 */
export function ExportCsvButton({
  getTable,
  fileName,
  className,
  size = "sm",
}: {
  getTable: () => HTMLTableElement | null;
  fileName: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn("h-8 gap-1.5", className)}
      onClick={() => {
        const table = getTable();
        const csv = table ? tableElementToCsv(table) : "";
        if (!csv) {
          toast({ title: t("common.export_csv_empty") });
          return;
        }
        downloadCsv(csv, csvFileName(fileName));
      }}
    >
      <Download className="h-3.5 w-3.5" />
      {t("common.export_csv")}
    </Button>
  );
}

/**
 * Drop-in replacement for a hand-rolled `<table>`: renders an export button
 * just above it and exports the rendered rows. Swap `<table …>` /  `</table>`
 * for `<ExportableTable fileName="…" …>` / `</ExportableTable>` — it emits a
 * fragment, so no extra wrapper element and no layout change.
 */
export function ExportableTable({
  fileName,
  toolbarClassName,
  children,
  ...tableProps
}: { fileName: string; toolbarClassName?: string } & TableHTMLAttributes<HTMLTableElement>) {
  const ref = useRef<HTMLTableElement>(null);
  return (
    <>
      {/* sticky/left so the button stays visible on horizontally scrolled tables */}
      <div className={cn("sticky left-0 w-fit mb-2 px-1", toolbarClassName)}>
        <ExportCsvButton fileName={fileName} getTable={() => ref.current} />
      </div>
      <table ref={ref} {...tableProps}>
        {children}
      </table>
    </>
  );
}

/**
 * Convenience wrapper: renders an export button above `children` and scrapes
 * the first `<table>` inside it.
 *
 * ```tsx
 * <CsvExportable fileName="contract-related-costs">
 *   <table>…</table>
 * </CsvExportable>
 * ```
 */
export function CsvExportable({
  fileName,
  children,
  className,
  toolbarClassName,
  toolbarExtra,
}: {
  fileName: string;
  children: ReactNode;
  className?: string;
  toolbarClassName?: string;
  toolbarExtra?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={className}>
      <div className={cn("flex items-center justify-end gap-2 mb-2", toolbarClassName)}>
        {toolbarExtra}
        <ExportCsvButton
          fileName={fileName}
          getTable={() => ref.current?.querySelector("table") ?? null}
        />
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}
