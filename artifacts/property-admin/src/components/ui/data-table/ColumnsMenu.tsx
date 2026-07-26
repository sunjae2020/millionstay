import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ACTIONS_KEY, type ColumnDef } from "./types";

interface Props<T> {
  /** All columns in current effective order (incl. hidden). */
  columns: ColumnDef<T>[];
  isHidden: (col: ColumnDef<T>) => boolean;
  onToggle: (key: string, hide: boolean) => void;
  onReorder: (orderedKeys: string[]) => void;
}

function labelFor<T>(col: ColumnDef<T>, t: (k: string) => string): React.ReactNode {
  return typeof col.header === "string" ? t(col.header) : col.header;
}

/**
 * "Columns" dropdown: show/hide via checkbox + drag-to-reorder via native HTML5
 * drag. Only hideable columns are listed (the actions column is fixed). Rendered
 * inside a Popover (not a DropdownMenu) so native row dragging works.
 */
export function ColumnsMenu<T>({ columns, isHidden, onToggle, onReorder }: Props<T>) {
  const { t } = useTranslation();
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // Reorderable rows = hideable columns (exclude the pinned actions column).
  const rows = columns.filter((c) => c.key !== ACTIONS_KEY && c.hideable !== false);

  const handleDrop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      setOverKey(null);
      return;
    }
    // Rebuild the full effective order with dragKey moved before targetKey.
    const fullKeys = columns.map((c) => c.key).filter((k) => k !== ACTIONS_KEY);
    const without = fullKeys.filter((k) => k !== dragKey);
    const idx = without.indexOf(targetKey);
    without.splice(idx, 0, dragKey);
    onReorder(without);
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("common.columns")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="px-1 pb-2 text-xs text-muted-foreground">{t("common.columns_hint")}</div>
        <div className="max-h-72 overflow-y-auto">
          {rows.map((col) => {
            const hidden = isHidden(col);
            return (
              <div
                key={col.key}
                draggable
                onDragStart={() => setDragKey(col.key)}
                onDragEnter={() => setOverKey(col.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/60",
                  dragKey === col.key && "opacity-50",
                  overKey === col.key && dragKey && dragKey !== col.key && "bg-primary/10",
                )}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                <Checkbox
                  checked={!hidden}
                  onCheckedChange={(v) => onToggle(col.key, !v)}
                  aria-label="Toggle column"
                />
                <span className="truncate">{labelFor(col, t)}</span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
