import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSignature, Copy, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime, formatDate } from "@/lib/date";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

interface SignReq {
  id: number;
  token: string;
  url: string;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  signers: Array<{ role: string; name: string; email: string }>;
}

/**
 * 퇴거 정산 확인서의 임차인 서명 링크.
 *
 * 정산은 세입자가 이미 짐을 빼고 떠난 뒤에 마무리된다. 종이 확인서에 도장을
 * 받으러 다시 만나는 일이 정산을 몇 주씩 미루므로, 계약서·작업 확인서와 같은
 * 전자서명 경로(`/sign/:token`)를 정산에도 붙였다. 초안(draft) 상태에서는
 * 발급하지 않는다 — 세입자가 확인할 금액이 아직 확정되지 않았다.
 */
export function SettlementSignLinkCard({
  settlementId,
  status,
  defaultEmail,
}: {
  settlementId: number;
  status: string;
  defaultEmail?: string | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultEmail ?? "");
  const [sendEmail, setSendEmail] = useState(true);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const { data: reqs = [], refetch } = useQuery({
    queryKey: ["settlement-sign-link", settlementId],
    queryFn: async (): Promise<SignReq[]> => {
      const res = await apiFetch(`/api/v1/deposit-settlements/${settlementId}/sign-link`);
      if (!res.ok) return [];
      return (await res.json()).data ?? [];
    },
  });

  const live = reqs.find((r) => r.status === "signed") ?? reqs.find((r) => r.status === "pending") ?? null;
  const signed = live?.status === "signed";

  const issue = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/deposit-settlements/${settlementId}/sign-link`, {
        method: "POST",
        body: JSON.stringify({ to: to.trim() || undefined, send_email: sendEmail }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? t("settlementSign.error_issue"));
      return body;
    },
    onSuccess: (body: any) => {
      setOpen(false);
      refetch();
      if (body?.email && !body.email.ok) {
        toast({ title: t("tenantLink.toast_issued_no_mail"), description: body.email.error ?? "", variant: "destructive" });
      } else {
        toast({ title: t("tenantLink.toast_issued") });
      }
    },
    onError: (e: any) => toast({ title: t("settlementSign.error_issue"), description: e.message, variant: "destructive" }),
  });

  return (
    <section className="rounded-md border bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b bg-gray-50">
        <span className="text-xs font-bold text-primary inline-flex items-center gap-1.5">
          <FileSignature className="h-3.5 w-3.5" /> {t("settlementSign.title")}
        </span>
        {live && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${signed ? "text-green-700" : "text-amber-700"}`}>
            {signed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {signed ? t("settlementSign.signed") : t("settlementSign.pending")}
            {live.signed_at ? ` · ${formatDateTime(live.signed_at)}` : ""}
            {!signed && live.expires_at ? ` · ${t("tenantLink.expires", { date: formatDate(live.expires_at) })}` : ""}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {live && (
            <>
              <Button size="sm" variant="outline" className="h-7 gap-1.5"
                onClick={() => { navigator.clipboard?.writeText(live.url); toast({ title: t("tenantLink.toast_copied") }); }}>
                <Copy className="h-3.5 w-3.5" /> {t("tenantLink.btn_copy")}
              </Button>
              <Button size="sm" variant="outline" className="h-7"
                onClick={() => openPreview({
                  title: t("settlementSign.preview"),
                  filename: `settlement-${settlementId}.pdf`,
                  source: { kind: "url", href: `/api/v1/public/contract-signing/${live.token}/${signed ? "pdf" : "preview"}` },
                })}>
                {t("settlementSign.preview")}
              </Button>
            </>
          )}
          {!signed && (
            <Button size="sm" className="h-7" disabled={status === "draft"}
              title={status === "draft" ? t("settlementSign.draft_blocked") : undefined}
              onClick={() => { setTo(defaultEmail ?? ""); setOpen(true); }}>
              {live ? t("tenantLink.btn_reissue") : t("settlementSign.btn_issue")}
            </Button>
          )}
        </div>
      </div>
      {!live && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {status === "draft" ? t("settlementSign.draft_blocked") : t("settlementSign.empty")}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("settlementSign.dialog_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <div className="grid gap-1.5">
              <Label>{t("tenantLink.label_to")}</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="tenant@example.com" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {t("tenantLink.label_send_email")}
            </label>
            <p className="text-xs text-muted-foreground">{t("settlementSign.hint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
              {issue.isPending ? t("common.saving") : t("settlementSign.btn_issue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </section>
  );
}
