import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

/**
 * One suggested recipient returned by `<doc>/email-recipients`. The endpoint
 * serves both channels — a candidate may carry an address, a mobile, or both.
 */
interface RecipientCandidate {
  email: string | null;
  phone?: string | null;
  name: string | null;
  role: "account" | "primary_contact" | "secondary_contact" | "lead" | "landlord" | "agency";
}

export interface SmsRecipient {
  phone: string;
  name: string | null;
}

export interface DocumentSmsTarget {
  /** Heading line — usually the document ref + type. */
  title: string;
  /** GET endpoint returning `{ default_phone, candidates }` used to prefill the form. */
  recipientsPath?: string;
  /** Sends the document link; resolves on success, throws with a message on failure. */
  send: (to: SmsRecipient[]) => Promise<void>;
}

interface Props {
  target: DocumentSmsTarget | null;
  onClose: () => void;
}

/** 국내 휴대폰(010·011·016·017·018·019). 하이픈·공백·+82 허용. */
function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "").replace(/^\+?82/, "0");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

function prettyPhone(p: string): string {
  return p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p;
}

interface Row { phone: string; name: string | null }

/**
 * Recipient editor shown before a document link is texted. Mirrors the email
 * dialog: prefills the customer's (or their 담당자's) mobile, lets the admin
 * correct it, add more, or pick from the other numbers on the record.
 */
export function DocumentSmsDialog({ target, onClose }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([{ phone: "", name: null }]);
  const [candidates, setCandidates] = useState<RecipientCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = target !== null;
  const recipientsPath = target?.recipientsPath;

  useEffect(() => {
    if (!open) return;
    setRows([{ phone: "", name: null }]);
    setCandidates([]);
    setError(null);
    if (!recipientsPath) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await apiFetch(recipientsPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { default_phone?: string[]; candidates?: RecipientCandidate[] };
        if (cancelled) return;
        const cands = (body.candidates ?? []).filter((c) => !!c.phone);
        setCandidates(cands);
        const first = body.default_phone?.[0];
        if (first) {
          const match = cands.find((c) => c.phone === first);
          setRows([{ phone: first, name: match?.name ?? null }]);
        }
      } catch {
        if (!cancelled) setRows([{ phone: "", name: null }]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, recipientsPath]);

  const setRow = (i: number, phone: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { phone, name: null } : r)));
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length === 1 ? [{ phone: "", name: null }] : prev.filter((_, idx) => idx !== i)));
  const addRow = (phone = "", name: string | null = null) =>
    setRows((prev) => {
      const empty = prev.findIndex((r) => !r.phone.trim());
      if (empty >= 0) return prev.map((r, idx) => (idx === empty ? { phone, name } : r));
      return [...prev, { phone, name }];
    });

  const filled = rows.filter((r) => r.phone.trim());
  const invalid = filled.filter((r) => !normalizePhone(r.phone));
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
    (c) => !filled.some((r) => normalizePhone(r.phone) === c.phone),
  );

  const handleSend = async () => {
    if (!target || !canSend) return;
    setSending(true);
    setError(null);
    try {
      const seen = new Set<string>();
      const to: SmsRecipient[] = [];
      for (const r of filled) {
        const phone = normalizePhone(r.phone)!;
        if (seen.has(phone)) continue;
        seen.add(phone);
        // A hand-typed number that matches a known candidate borrows its name.
        const name = r.name ?? candidates.find((c) => c.phone === phone)?.name ?? null;
        to.push({ phone, name });
      }
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
          <DialogTitle className="text-base">{t("doc_sms.title", "Send by text message")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {target && <p className="text-xs text-muted-foreground truncate">{target.title}</p>}
          <p className="text-xs text-muted-foreground">
            {t("doc_sms.hint", "The recipient gets a short link that opens this document in their browser. The link expires after 30 days.")}
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("doc_sms.to", "Mobile numbers")}
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
                    type="tel"
                    inputMode="tel"
                    autoFocus={i === 0}
                    value={row.phone}
                    onChange={(e) => setRow(i, e.target.value)}
                    placeholder={t("doc_sms.placeholder", "010-0000-0000")}
                    className={row.phone.trim() && !normalizePhone(row.phone) ? "border-destructive" : ""}
                  />
                  {row.name && <span className="text-xs text-muted-foreground whitespace-nowrap">{row.name}</span>}
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
                    title={t("doc_email.remove", "Remove")}
                    disabled={rows.length === 1 && !row.phone.trim()}
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
                    key={c.phone!}
                    type="button"
                    onClick={() => addRow(c.phone!, c.name)}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
                    title={`${roleLabel(c.role)}${c.name ? ` · ${c.name}` : ""}`}
                  >
                    <span className="text-muted-foreground">{roleLabel(c.role)}</span>
                    <span className="mx-1">·</span>
                    {c.name ? `${c.name} ` : ""}{prettyPhone(c.phone!)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {invalid.length > 0 && (
            <p className="text-xs text-destructive">
              {t("doc_sms.invalid", "Check this number: {{phone}}", { phone: invalid[0].phone })}
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button size="sm" onClick={() => void handleSend()} disabled={!canSend}>
            {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-1.5" />}
            {t("doc_email.send", "Send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
