import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link2, Copy, Send, Ban, CheckCircle2, Clock, Upload, Banknote, ClipboardList, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime, formatDate } from "@/lib/date";

const API = "/api/v1/tenant-links";

export interface TenantLink {
  id: number;
  kind: string;
  token: string;
  url: string;
  status: string;
  sent_to: string | null;
  expires_at: string | null;
  viewed_at: string | null;
  completed_at: string | null;
  payload: any;
  submissions: any[];
  created_at: string;
}

interface DocPreset { key: string; doc_type: string; label: string; required: boolean }

/**
 * 세입자에게 보내는 무로그인 링크 카드 — 청구서 결제(`invoice_pay`), 서류
 * 제출(`doc_request`), 입주 신청서(`intake`)가 같은 카드를 쓴다. 발급·복사·
 * 재발송·회수, 그리고 세입자가 남긴 것(입금 통보 · 제출 서류 · 기입한 인적사항)
 * 까지 한자리에서 본다.
 *
 * 링크는 대상당 하나만 살아 있다(재발급하면 이전 것이 취소된다). 그래서 카드는
 * 최신 링크 하나를 크게 보여 주고 지난 것은 이력으로만 남긴다 — 화면에 링크가
 * 여러 개 떠 있으면 어느 쪽을 보냈는지 사람이 헷갈린다.
 */
export function TenantLinkCard({
  kind,
  issuePath,
  listPath,
  defaultEmail,
}: {
  kind: "invoice_pay" | "doc_request" | "intake";
  /** POST — 링크 발급 (예: /api/v1/invoices/12/pay-link) */
  issuePath: string;
  /** GET — 이 대상에 달린 링크들 */
  listPath: string;
  /** 발급 다이얼로그의 기본 수신 주소. */
  defaultEmail?: string | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultEmail ?? "");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const { data: links = [], refetch } = useQuery({
    queryKey: ["tenant-links", listPath],
    queryFn: async (): Promise<TenantLink[]> => {
      const res = await apiFetch(listPath);
      if (!res.ok) return [];
      return (await res.json()).data ?? [];
    },
  });

  const { data: presets = [] } = useQuery({
    queryKey: ["tenant-link-presets"],
    queryFn: async (): Promise<DocPreset[]> => {
      const res = await apiFetch(`${API}/doc-presets`);
      if (!res.ok) return [];
      return (await res.json()).data ?? [];
    },
    enabled: kind === "doc_request",
  });

  const live = links.find((l) => l.status !== "cancelled" && l.status !== "expired") ?? null;
  const past = links.filter((l) => l.id !== live?.id);

  const issue = useMutation({
    mutationFn: async () => {
      const items = kind === "doc_request"
        ? presets.filter((p) => picked[p.key]).map((p) => ({ key: p.key, doc_type: p.doc_type, label: p.label, required: p.required }))
        : undefined;
      const res = await apiFetch(issuePath, {
        method: "POST",
        body: JSON.stringify({
          to: to.trim() || undefined,
          send_email: sendEmail,
          ...(items ? { items } : {}),
          ...(kind !== "invoice_pay" && note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? t("tenantLink.error_issue"));
      return body;
    },
    onSuccess: (body: any) => {
      setOpen(false);
      refetch();
      const email = body?.email;
      if (email && !email.ok) {
        // 링크는 이미 발급됐다 — 메일만 실패한 것이므로 복사해 보내면 된다.
        toast({ title: t("tenantLink.toast_issued_no_mail"), description: email.error ?? "", variant: "destructive" });
      } else {
        toast({ title: t("tenantLink.toast_issued") });
      }
    },
    onError: (e: any) => toast({ title: t("tenantLink.error_issue"), description: e.message, variant: "destructive" }),
  });

  const resend = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}/resend`, { method: "POST", body: JSON.stringify({ to: to.trim() || undefined }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.email?.ok === false) throw new Error(body?.email?.error ?? body?.error?.message ?? t("tenantLink.error_send"));
      return body;
    },
    onSuccess: () => { refetch(); toast({ title: t("tenantLink.toast_sent") }); },
    onError: (e: any) => toast({ title: t("tenantLink.error_send"), description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => { refetch(); toast({ title: t("tenantLink.toast_revoked") }); },
  });

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    toast({ title: t("tenantLink.toast_copied") });
  }

  const Icon = kind === "invoice_pay" ? Banknote : kind === "intake" ? ClipboardList : Upload;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-primary/10 border-b px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {t(`tenantLink.title_${kind}`)}
        </span>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => { setTo(defaultEmail ?? ""); setOpen(true); }}>
          <Link2 className="h-3.5 w-3.5" /> {live ? t("tenantLink.btn_reissue") : t("tenantLink.btn_issue")}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {!live ? (
          <p className="text-sm text-muted-foreground">{t(`tenantLink.empty_${kind}`)}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <StatusChip status={live.status} />
              {live.sent_to && <span className="text-muted-foreground">{live.sent_to}</span>}
              {live.expires_at && (
                <span className="text-xs text-muted-foreground">
                  · {t("tenantLink.expires", { date: formatDate(live.expires_at) })}
                </span>
              )}
              {live.viewed_at && (
                <span className="text-xs text-muted-foreground">· {t("tenantLink.viewed", { at: formatDateTime(live.viewed_at) })}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{live.url}</code>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => copy(live.url)}>
                <Copy className="h-3.5 w-3.5" /> {t("tenantLink.btn_copy")}
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={resend.isPending || !live.sent_to}
                onClick={() => resend.mutate(live.id)}>
                <Send className="h-3.5 w-3.5" /> {t("tenantLink.btn_resend")}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-red-600 gap-1.5" onClick={() => revoke.mutate(live.id)}>
                <Ban className="h-3.5 w-3.5" /> {t("tenantLink.btn_revoke")}
              </Button>
            </div>

            {kind === "doc_request" && <RequestedDocs link={live} />}
            {kind === "invoice_pay" && <PaidNotices link={live} />}
            {kind === "intake" && <IntakeAnswers link={live} onApplied={() => refetch()} />}
          </>
        )}

        {past.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("tenantLink.history")}</p>
            <ul className="space-y-1">
              {past.slice(0, 5).map((l) => (
                <li key={l.id} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="tabular-nums">{formatDateTime(l.created_at)}</span>
                  <span>{t(`tenantLink.status_${l.status}`, l.status)}</span>
                  {l.sent_to && <span className="text-foreground">{l.sent_to}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t(`tenantLink.dialog_${kind}`)}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            {kind === "doc_request" && (
              <div className="grid gap-1.5">
                <Label>{t("tenantLink.label_items")}</Label>
                {presets.map((p) => (
                  <label key={p.key} className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={!!picked[p.key]}
                      onChange={(e) => setPicked((s) => ({ ...s, [p.key]: e.target.checked }))} />
                    {p.label}
                    {p.required && <span className="text-xs text-muted-foreground">({t("tenantLink.required")})</span>}
                  </label>
                ))}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>{t("tenantLink.label_to")}</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="tenant@example.com" />
            </div>
            {kind !== "invoice_pay" && (
              <div className="grid gap-1.5">
                <Label>{t("tenantLink.label_note")}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder={t("tenantLink.ph_note")} />
              </div>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {t("tenantLink.label_send_email")}
            </label>
            <p className="text-xs text-muted-foreground">{t("tenantLink.hint_reissue")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={() => issue.mutate()} disabled={issue.isPending || (kind === "doc_request" && !Object.values(picked).some(Boolean))}>
              {issue.isPending ? t("common.saving") : t("tenantLink.btn_issue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  const done = status === "completed";
  const Icon = done ? CheckCircle2 : Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${done ? "text-green-700" : "text-amber-700"}`}>
      <Icon className="h-3.5 w-3.5" /> {t(`tenantLink.status_${status}`, status)}
    </span>
  );
}

/** 요청한 서류와 그 제출 여부 — 무엇이 아직 안 왔는지가 이 카드의 요점이다. */
function RequestedDocs({ link }: { link: TenantLink }) {
  const { t } = useTranslation();
  const items = (link.payload?.items ?? []) as DocPreset[];
  const subs = Array.isArray(link.submissions) ? link.submissions : [];
  if (!items.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((it) => {
        const mine = subs.filter((s: any) => s?.doc_key === it.key);
        return (
          <li key={it.key} className="flex items-center gap-2">
            {mine.length ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            <span className={mine.length ? "" : "text-muted-foreground"}>{it.label}</span>
            {!it.required && <span className="text-xs text-muted-foreground">({t("tenantLink.optional")})</span>}
            {mine.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">· {mine[mine.length - 1].file_name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 세입자가 남긴 입금 통보. 수납 처리는 여전히 사람이 통장을 보고 한다. */
function PaidNotices({ link }: { link: TenantLink }) {
  const { t } = useTranslation();
  const notices = (Array.isArray(link.submissions) ? link.submissions : []).filter((s: any) => s?.event === "paid_notice");
  if (!notices.length) return null;
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
      <p className="font-medium text-green-800 mb-1">{t("tenantLink.notice_title")}</p>
      {notices.map((n: any, i: number) => (
        <div key={i} className="text-green-900">
          {t("tenantLink.notice_line", { payer: n.payer_name, date: n.paid_on })}
          {n.amount ? ` · ${n.amount}` : ""}
          {n.memo ? ` · ${n.memo}` : ""}
        </div>
      ))}
      <p className="mt-1 text-xs text-green-700">{t("tenantLink.notice_hint")}</p>
    </div>
  );
}

/** 입주 신청서에 세입자가 적어 보낸 값 + 반영 버튼. */
const INTAKE_GROUPS: Array<{ title: string; fields: string[] }> = [
  { title: "본인 정보", fields: ["first_name", "last_name", "mobile_number", "email", "sns_type", "sns_id", "date_of_birth", "nationality"] },
  { title: "주소", fields: ["address_line1", "suburb", "state", "postcode", "country"] },
  { title: "비상 연락처", fields: ["emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone"] },
  { title: "입주 정보", fields: ["move_in_date", "cohabitants", "vehicle_no", "pet_note"] },
];

function IntakeAnswers({ link, onApplied }: { link: TenantLink; onApplied: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const subs = Array.isArray(link.submissions) ? link.submissions : [];
  const latest = [...subs].reverse().find((s: any) => s?.event === "intake") as any;

  const apply = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${link.id}/apply`, { method: "POST", body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? t("tenantLink.error_apply"));
      return body;
    },
    onSuccess: () => { onApplied(); toast({ title: t("tenantLink.toast_applied") }); },
    onError: (e: any) => toast({ title: t("tenantLink.error_apply"), description: e.message, variant: "destructive" }),
  });

  if (!latest) return <p className="text-sm text-muted-foreground">{t("tenantLink.intake_waiting")}</p>;
  const a = (latest.answers ?? {}) as Record<string, string>;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {a["profile_photo_url"] && (
          <img src={a["profile_photo_url"]} alt="" className="h-20 w-16 rounded object-cover border" />
        )}
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          {INTAKE_GROUPS.map((g) => {
            const rows = g.fields.filter((f) => a[f]);
            if (!rows.length) return null;
            return (
              <div key={g.title}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t(`tenantLink.intake_group_${g.title}`, g.title)}</p>
                <dl className="mt-1 space-y-0.5 text-sm">
                  {rows.map((f) => (
                    <div key={f} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">{t(`tenantLink.intake_f_${f}`, f)}</dt>
                      <dd className="min-w-0 break-words">{a[f]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
      {a["note"] && <p className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-line">{a["note"]}</p>}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => apply.mutate()} disabled={apply.isPending}>
          <UserCheck className="h-3.5 w-3.5" /> {apply.isPending ? t("common.saving") : t("tenantLink.btn_apply")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("tenantLink.apply_hint")}</span>
      </div>
    </div>
  );
}
