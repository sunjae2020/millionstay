import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

/** One suggested address returned by `<doc>/email-recipients`. */
interface RecipientCandidate {
  email: string;
  name: string | null;
  role: "account" | "primary_contact" | "secondary_contact" | "lead" | "landlord" | "agency";
}

export interface DocumentEmailTarget {
  /** Heading line — usually the document ref + type. */
  title: string;
  /** GET endpoint returning `{ default, candidates }` used to prefill the form. */
  recipientsPath?: string;
  /** Sends the document; resolves on success, throws with a message on failure. */
  send: (to: string[]) => Promise<void>;
}

interface Props {
  target: DocumentEmailTarget | null;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Recipient editor shown before a document is emailed. Prefills the customer's
 * (or their 담당자's) address, and lets the admin correct it, add more, or pick
 * from the other addresses on the record.
 */
export function DocumentEmailDialog({ target, onClose }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<string[]>([""]);
  const [candidates, setCandidates] = useState<RecipientCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = target !== null;
  const recipientsPath = target?.recipientsPath;

  // Load the suggested addresses each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setRows([""]);
    setCandidates([]);
    setError(null);
    if (!recipientsPath) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await apiFetch(recipientsPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { default?: string[]; candidates?: RecipientCandidate[] };
        if (cancelled) return;
        setCandidates(body.candidates ?? []);
        setRows(body.default?.length ? body.default : [""]);
      } catch {
        // A failed lookup just means no prefill — the admin can still type one.
        if (!cancelled) setRows([""]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, recipientsPath]);

  const setRow = (i: number, value: string) => setRows((prev) => prev.map((r, idx) => (idx === i ? value : r)));
  const removeRow = (i: number) => setRows((prev) => (prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i)));
  const addRow = (value = "") =>
    setRows((prev) => {
      const empty = prev.findIndex((r) => !r.trim());
      if (empty >= 0) return prev.map((r, idx) => (idx === empty ? value : r));
      return [...prev, value];
    });

  const filled = rows.map((r) => r.trim()).filter(Boolean);
  const invalid = filled.filter((r) => !EMAIL_RE.test(r));
  const canSend = filled.length > 0 && invalid.length === 0 && !sending && !loading;

  const roleLabel = (role: RecipientCandidate["role"]) =>
    role === "account" || role === "lead"
      ? t("doc_email.role_customer", "Customer")
      : role === "landlord"
        ? t("doc_email.role_landlord", "Landlord")
        : role === "agency"
          ? t("doc_email.role_agency", "Agency")
          : t("doc_email.role_contact", "Contact");

  const unusedCandidates = candidates.filter(
    (c) => !filled.some((r) => r.toLowerCase() === c.email.toLowerCase()),
  );

  const handleSend = async () => {
    if (!target || !canSend) return;
    setSending(true);
    setError(null);
    try {
      // De-duplicate here too so a pasted address twice doesn't send twice.
      const seen = new Set<string>();
      const to = filled.filter((e) => {
        const key = e.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await target.send(to);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t("doc_email.title", "Send by email")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {target && <p className="text-xs text-muted-foreground truncate">{target.title}</p>}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("doc_email.to", "Recipients")}
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("doc_email.loading", "Looking up the recipient…")}
              </div>
            ) : (
              rows.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    type="email"
                    autoFocus={i === 0}
                    value={row}
                    onChange={(e) => setRow(i, e.target.value)}
                    placeholder={t("doc_email.placeholder", "name@example.com")}
                    className={row.trim() && !EMAIL_RE.test(row.trim()) ? "border-destructive" : ""}
                  />
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
                    title={t("doc_email.remove", "Remove")}
                    disabled={rows.length === 1 && !row.trim()}
                    onClick={() => removeRow(i)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => addRow()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("doc_email.add", "Add recipient")}
            </Button>
          </div>

          {unusedCandidates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {t("doc_email.suggestions", "On this record")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unusedCandidates.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => addRow(c.email)}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
                    title={`${roleLabel(c.role)}${c.name ? ` · ${c.name}` : ""}`}
                  >
                    <span className="text-muted-foreground">{roleLabel(c.role)}</span>
                    <span className="mx-1">·</span>
                    {c.email}
                  </button>
                ))}
              </div>
            </div>
          )}

          {invalid.length > 0 && (
            <p className="text-xs text-destructive">
              {t("doc_email.invalid", "Check this address: {{email}}", { email: invalid[0] })}
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button size="sm" onClick={() => void handleSend()} disabled={!canSend}>
            {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
            {t("doc_email.send", "Send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
