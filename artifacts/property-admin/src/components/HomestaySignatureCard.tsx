import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, FileSignature, Send, Copy, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";

const SIGNING_API = "/api/v1/contract-signing";
const PUBLIC_SIGNING = "/api/v1/public/contract-signing";
const EMAIL_LOGS = "/api/v1/email-logs";

interface SigningReq { id: number; token: string; status: string; context_type: string; signed_at?: string | null }
interface EmailLog { id: number; to_email: string; status: string; subject?: string; sent_at: string }

/**
 * Admin card surfacing a record's e-signature document: status, PDF
 * preview/download, signing-link copy, resend-to-recipients, and email history.
 * Reuses the public token endpoints (preview/pdf/send) shipped with the e-sign flow.
 * Used for homestay applications and regular contracts. When `issuePath` is given
 * and no signing request exists yet, an "Issue signing request" button POSTs to it
 * (contracts must be issued explicitly; homestay auto-creates on submit).
 */
export function HomestaySignatureCard({
  contextType,
  contextId,
  entityType,
  issuePath,
}: {
  contextType: "student_app" | "host_app" | "contract";
  contextId: number;
  entityType: "homestay_student_request" | "homestay_host_application" | "contract";
  issuePath?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [sel, setSel] = useState({ applicant: true, agent: false, ops: false });

  const { data: signing, refetch: refetchSigning } = useQuery({
    queryKey: ["homestay-signing", contextType, contextId],
    queryFn: async (): Promise<SigningReq[]> => {
      const res = await apiFetch(`${SIGNING_API}/${contextType}/${contextId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!contextId,
  });
  const latest = (signing ?? []).slice().sort((a, b) => b.id - a.id)[0];
  const signed = latest?.status === "signed";

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["homestay-email-logs", entityType, contextId],
    queryFn: async (): Promise<EmailLog[]> => {
      const res = await apiFetch(`${EMAIL_LOGS}?entity_type=${entityType}&entity_id=${contextId}&limit=10`);
      if (!res.ok) return [];
      return (await res.json()).data ?? [];
    },
    enabled: !!contextId,
  });

  const issue = useMutation({
    mutationFn: async () => {
      if (!issuePath) throw new Error("No issue path");
      const res = await apiFetch(issuePath, { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("homestayDoc.toast_issued", "Signing request created") }); refetchSigning(); },
    onError: (e: any) => toast({ title: t("homestayDoc.error"), description: e.message, variant: "destructive" }),
  });

  const resend = useMutation({
    mutationFn: async () => {
      if (!latest) throw new Error("No document");
      const res = await apiFetch(`${PUBLIC_SIGNING}/${latest.token}/send`, { method: "POST", body: JSON.stringify(sel) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (d: any) => {
      const sent: string[] = d?.sent ?? [];
      refetchLogs();
      if (sent.length === 0) {
        // Nothing was actually emailed (e.g. "Operations team" selected but no
        // notification email configured). Warn and keep the dialog open.
        toast({ title: t("homestayDoc.toast_none_sent"), description: t("homestayDoc.toast_none_sent_desc"), variant: "destructive" });
        return;
      }
      toast({ title: t("homestayDoc.toast_sent"), description: sent.join(", ") });
      setSendOpen(false);
    },
    onError: (e: any) => toast({ title: t("homestayDoc.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-primary/10 border-b px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider inline-flex items-center gap-1.5">
          <FileSignature className="h-3.5 w-3.5" /> {t("homestayDoc.title")}
        </span>
      </div>
      <div className="p-4 space-y-4">
        {!latest ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{t("homestayDoc.none")}</p>
            {issuePath && (
              <Button size="sm" className="gap-1.5" onClick={() => issue.mutate()} disabled={issue.isPending}>
                <FileSignature className="h-4 w-4" /> {issue.isPending ? t("common.saving") : t("homestayDoc.btn_issue", "Issue signing request")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">{t("homestayDoc.status_label")}:</span>
              <span className={`font-medium ${signed ? "text-green-700" : "text-amber-700"}`}>
                {signed ? t("homestayDoc.signed") : t("homestayDoc.pending")}
              </span>
              {latest.signed_at && <span className="text-xs text-muted-foreground">· {formatDateTime(latest.signed_at)}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`${PUBLIC_SIGNING}/${latest.token}/preview`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5"><FileText className="h-4 w-4" /> {t("homestayDoc.btn_preview")}</Button>
              </a>
              {!signed && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sign/${latest.token}`); toast({ title: t("homestayDoc.toast_link_copied") }); }}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-muted/50"
                >
                  <Copy className="h-4 w-4" /> {t("homestayDoc.btn_copy_link")}
                </button>
              )}
              {signed && (
                <>
                  <a href={`${PUBLIC_SIGNING}/${latest.token}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5"><FileText className="h-4 w-4" /> {t("homestayDoc.btn_download")}</Button>
                  </a>
                  <Button size="sm" className="gap-1.5" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> {t("homestayDoc.btn_resend")}</Button>
                </>
              )}
            </div>
          </>
        )}

        {/* Email history */}
        <div className="pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> {t("homestayDoc.history_title")}
          </p>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("homestayDoc.history_empty")}</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((l) => (
                <li key={l.id} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="tabular-nums">{formatDateTime(l.sent_at)}</span>
                  <span className="text-foreground">{l.to_email}</span>
                  <span className={l.status === "Sent" ? "text-green-600" : "text-red-600"}>· {l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Resend dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayDoc.send_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-2 py-2 text-sm">
            {(["applicant", "agent", "ops"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={sel[k]} onChange={(e) => setSel((s) => ({ ...s, [k]: e.target.checked }))} className="h-4 w-4" />
                {t(`homestayDoc.recipient_${k}`)}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? t("common.saving") : t("homestayDoc.btn_resend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
