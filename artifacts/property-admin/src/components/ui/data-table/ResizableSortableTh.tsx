import { useCallback, useRef } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/components/ui/SortableTable";
import type { Align } from "./types";

interface Props {
  colKey: string;
  label: React.ReactNode;
  align?: Align;
  sortable: boolean;
  activeKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  /** Current width (px) — starting point for a resize drag. */
  width?: number;
  minWidth: number;
  onResize: (key: string, px: number) => void;
  className?: string;
}

/**
 * Header cell for DataTable: reproduces `SortableTh`'s sort affordance and adds
 * a right-edge drag grip for column resizing. The grip stops propagation so a
 * drag never triggers the sort button.
 */
export function ResizableSortableTh({
  colKey,
  label,
  align = "left",
  sortable,
  activeKey,
  sortDir,
  onSort,
  width,
  minWidth,
  onResize,
  className,
}: Props) {
  const active = activeKey === colKey;
  const thRef = useRef<HTMLTableCellElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(minWidth, d.startW + (e.clientX - d.startX));
      onResize(colKey, next);
    },
    [colKey, minWidth, onResize],
  );

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopDrag);
  }, [onMouseMove]);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startW = width ?? thRef.current?.getBoundingClientRect().width ?? minWidth;
      dragRef.current = { startX: e.clientX, startW };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stopDrag);
    },
    [width, minWidth, onMouseMove, stopDrag],
  );

  return (
    <th
      ref={thRef}
      className={cn(
        "relative px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide select-none",
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(colKey)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors group max-w-full",
            align === "right" && "flex-row-reverse",
            align === "center" && "justify-center",
            active && "text-foreground",
          )}
        >
          <span className="truncate">{label}</span>
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3 shrink-0" />
            ) : (
              <ArrowDown className="h-3 w-3 shrink-0" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
          )}
        </button>
      ) : (
        <span className="truncate inline-block max-w-full align-middle">{label}</span>
      )}
      {/* Resize grip on the right edge. */}
      <span
        onMouseDown={startDrag}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-primary/40"
        aria-hidden="true"
      />
    </th>
  );
}
