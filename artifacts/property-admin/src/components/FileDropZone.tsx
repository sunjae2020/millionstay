import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardPaste, Loader2 } from "lucide-react";

/**
 * Drop / paste target for every screen that takes files in bulk.
 *
 * The point is to get a group of files out of Finder or Explorer in one motion:
 * drag a folder in, or copy the files there and hit ⌘/Ctrl+V. Both land in the
 * same `onFiles` callback as the hidden file input the screen already has, so a
 * caller only wires the callback and keeps its own upload logic.
 *
 * Paste is armed by hovering or focusing the zone. That matters on pages with
 * more than one zone (a contract has both its own attachments and the generic
 * document panel) — without it, one ⌘V would upload to both.
 */

/**
 * Pull every file out of a drop, walking into folders.
 *
 * A folder dragged out of Finder/Explorer arrives as a directory entry rather
 * than its contents, so the tree has to be walked before there is anything to
 * upload. `readEntries` returns one page at a time, hence the loop.
 */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .filter((i) => i.kind === "file")
    .map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null));

  // No directory support, or a plain file list — take the files as given.
  if (!entries.some(Boolean)) return Array.from(dt.files);

  const out: File[] = [];

  async function walk(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) =>
        (entry as FileSystemFileEntry).file(resolve, () => resolve(null)),
      );
      if (file) {
        // Screens that group by folder (bulk photo upload) need the path the
        // file had on disk; a dropped File carries no webkitRelativePath.
        Object.defineProperty(file, "relativePath", {
          value: entry.fullPath.replace(/^\//, ""),
          configurable: true,
        });
        out.push(file);
      }
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) =>
        reader.readEntries(resolve, () => resolve([])),
      );
      if (!batch.length) break;
      for (const child of batch) await walk(child);
    }
  }

  for (const entry of entries) if (entry) await walk(entry);
  return out.length ? out : Array.from(dt.files);
}

/** Path the file had on disk, however it was picked (drop, folder input, plain input). */
export function relativePathOf(file: File): string {
  const dropped = (file as File & { relativePath?: string }).relativePath;
  return dropped || file.webkitRelativePath || file.name;
}

/** Split a big drop into request-sized groups. */
export function chunkFiles(files: File[], size: number): File[][] {
  const out: File[][] = [];
  for (let i = 0; i < files.length; i += size) out.push(files.slice(i, i + size));
  return out;
}

/** Attributes that turn a plain file input into a folder picker. */
export const DIRECTORY_INPUT_PROPS = { webkitdirectory: "", directory: "" } as Record<string, string>;

interface FileDropZoneProps {
  /** Receives the dropped/pasted files, folders already flattened. */
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** Shows the spinner strip and blocks input while a caller is uploading. */
  busy?: boolean;
  /** Accept a ⌘V even when the pointer is elsewhere — only for single-zone pages. */
  alwaysPaste?: boolean;
  /** Hides the "drag files here" line when the surrounding UI already says it. */
  hideHint?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function FileDropZone({
  onFiles,
  disabled,
  busy,
  alwaysPaste,
  hideHint,
  className,
  children,
}: FileDropZoneProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const armed = useRef(false);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  const blocked = Boolean(disabled || busy);

  const emit = useCallback((files: File[]) => {
    if (files.length) onFilesRef.current(files);
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (blocked) return;
      if (!armed.current && !alwaysPaste) return;
      // Let text paste work normally inside form fields.
      const target = e.target as HTMLElement | null;
      if (target?.closest("input:not([type='file']), textarea, [contenteditable='true']")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      emit(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [blocked, alwaysPaste, emit]);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (blocked) return;
    emit(await filesFromDataTransfer(e.dataTransfer));
  }

  return (
    <div
      className={`relative rounded-lg transition-colors ${
        dragging && !blocked ? "ring-2 ring-primary/40" : ""
      } ${className ?? ""}`}
      onMouseEnter={() => { armed.current = true; }}
      onMouseLeave={() => { armed.current = false; }}
      onFocusCapture={() => { armed.current = true; }}
      onDragOver={(e) => { e.preventDefault(); if (!blocked) setDragging(true); }}
      onDragEnter={(e) => { e.preventDefault(); if (!blocked) setDragging(true); }}
      onDragLeave={(e) => {
        // Ignore the events fired while the pointer crosses child elements.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => void handleDrop(e)}
    >
      {!hideHint && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
          {t("file_drop.hint", "Drag files or a folder here, or press ⌘/Ctrl+V to paste them")}
        </p>
      )}

      {busy && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("file_drop.uploading", "Uploading…")}
        </p>
      )}

      {dragging && !blocked && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
          {t("file_drop.drop_now", "Drop the files here")}
        </div>
      )}

      {children}
    </div>
  );
}
