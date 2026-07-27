import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ColumnDef, EditValue } from "./types";

/**
 * Renders one inline-editable cell. In read mode it shows the column's normal
 * `cell(row)` output with a hover pencil affordance; clicking swaps to an
 * editor. `boolean` columns toggle-and-save on click (no editor step).
 *
 * Save/cancel: Enter commits (via blur), Escape cancels, blur commits when the
 * value changed. A single commit path (blur) avoids double-saves.
 */
export function EditableCell<T>({
  col,
  row,
  onSave,
}: {
  col: ColumnDef<T>;
  row: T;
  onSave: (row: T, field: string, value: EditValue) => Promise<void>;
}) {
  const { t } = useTranslation();
  const cfg = col.editable!;
  const field = cfg.field ?? col.key;
  const canEdit = cfg.canEdit ? cfg.canEdit(row) : true;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditValue>("");
  const [saving, setSaving] = useState(false);
  const cancelRef = useRef(false);

  if (!canEdit) return <>{col.cell(row)}</>;

  async function commit(value: EditValue) {
    setSaving(true);
    try {
      await onSave(row, field, value);
      setEditing(false);
    } catch {
      /* error toast is surfaced by the table; stay in edit mode to retry */
    } finally {
      setSaving(false);
    }
  }

  // boolean → click toggles and saves immediately
  if (cfg.type === "boolean") {
    const cur = !!cfg.getValue(row);
    return (
      <button
        type="button"
        disabled={saving}
        title={t("common.click_to_edit")}
        onClick={() => commit(!cur)}
        className="inline-flex items-center rounded px-1 -mx-1 hover:bg-muted/60 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : col.cell(row)}
      </button>
    );
  }

  if (!editing) {
    // Only the pencil triggers edit — the cell body stays interactive so any
    // <Link> inside col.cell (name/title columns) still navigates on click.
    return (
      <span className="group inline-flex items-center gap-1">
        {col.cell(row)}
        <button
          type="button"
          title={t("common.click_to_edit")}
          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-60"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(cfg.getValue(row) ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    } else if (e.key === "Escape") {
      cancelRef.current = true;
      (e.currentTarget as HTMLElement).blur();
    }
  }

  function onBlurCommit() {
    if (cancelRef.current) {
      cancelRef.current = false;
      setEditing(false);
      return;
    }
    const orig = cfg.getValue(row) ?? "";
    const next = draft ?? "";
    if (next === orig) {
      setEditing(false);
      return;
    }
    commit(draft);
  }

  if (cfg.type === "select") {
    return (
      <select
        autoFocus
        disabled={saving}
        className={cn(
          "h-8 rounded border border-input bg-background px-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring",
        )}
        value={String(draft ?? "")}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={onKeyDown}
      >
        {cfg.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        disabled={saving}
        type={cfg.type === "number" ? "number" : cfg.type === "date" ? "date" : "text"}
        className="h-8 min-w-[6rem]"
        value={draft == null ? "" : String(draft)}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        placeholder={cfg.placeholder}
        onChange={(e) =>
          setDraft(
            cfg.type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
        onBlur={onBlurCommit}
        onKeyDown={onKeyDown}
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </span>
  );
}
