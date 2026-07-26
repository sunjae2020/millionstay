import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  /** Hidden when there's nothing to page through. */
  hideWhenEmpty?: boolean;
}

/**
 * Presentational pagination bar for server-paginated tables.
 * Self-contained (native controls) so it can drop into any partner portal.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  onPageSize,
  hideWhenEmpty = true,
}: TablePaginationProps) {
  const { t } = useTranslation();
  if (hideWhenEmpty && total === 0) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>{t("pagination.rows_per_page", "Rows per page:")}</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-md border border-input bg-background text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span>
          {t("pagination.range", "{{from}}–{{to}} of {{total}}", { from, to, total })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("pagination.prev", "Previous page")}
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs px-1 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            aria-label={t("pagination.next", "Next page")}
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
