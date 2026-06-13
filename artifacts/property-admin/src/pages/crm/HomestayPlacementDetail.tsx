import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Handshake, Check, FileSignature, FileText, Send, ExternalLink, Loader2, Copy, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { PlacementStatusBadge, PLACEMENT_STATUS_ORDER, PLACEMENT_STATUS_CONFIG, type PlacementStatus } from "./HomestayPlacements";

const API = "/api/v1/homestay-placements";
const SIGNING_API = "/api/v1/contract-signing";
const PUBLIC_SIGNING = "/api/v1/public/contract-signing";

interface Placement {
  id: number;
  placement_ref: string;
  status: PlacementStatus;
  host_application_id: number;
  student_request_id: number;
  host_name?: string | null;
  host_email?: string | null;
  host_suburb?: string | null;
  student_name?: string | null;
  student_email?: string | null;
  student_is_minor?: boolean;
  move_in_date?: string | null;
  move_out_date?: string | null;
  currency?: string;
  placement_fee?: string;
  deposit?: string;
  monthly_fee?: string;
  proposed_at?: string | null;
  host_accepted_at?: string | null;
  confirmed_at?: string | null;
  next_billing_date?: string | null;
  billing_cycle_weeks?: number | null;
  billing_method?: string | null;
  created_at: string;
}

interface SigningReq { id: number; token: string; status: string; context_type: string; signed_at?: string | null }

interface PlacementPayment {
  id: number;
  kind: "upfront" | "monthly";
  method: "card" | "bank_transfer";
  status: "pending" | "paid" | "failed" | "refunded";
  amount: string;
  base_amount: string;
  surcharge_amount: string;
  currency: string;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  created_at: string;
}
interface BankInfo { name?: string; bank_name?: string; bsb_number?: string; account_number?: string; account_name?: string; swift_code?: string }

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-orange-50 border-b px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{title}</span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-words">
        {value === null || value === undefined || value === "" ? <span className="text-muted-foreground/40">—</span> : value}
      </span>
    </div>
  );
}

export default function HomestayPlacementDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<PlacementStatus>("Active");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendSel, setSendSel] = useState({ applicant: true, host: true, agent: false, ops: false });
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeKind, setChargeKind] = useState<"upfront" | "monthly">("upfront");
  const [chargeMethod, setChargeMethod] = useState<"card" | "bank_transfer">("card");
  const [sendBank, setSendBank] = useState<BankInfo | null>(null);
  const [sendBankOpen, setSendBankOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [ovCycle, setOvCycle] = useState("");
  const [ovMethod, setOvMethod] = useState("");

  // Global billing defaults (for the charge dialog + effective billing display).
  const { data: settings } = useQuery({
    queryKey: ["homestay-billing-settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/homestay-billing-settings");
      if (!res.ok) return null;
      return (await res.json()).data as { cycle_weeks: number; default_method: "card" | "bank_transfer"; surcharge_pct: number; lead_days: number };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-placement", id],
    queryFn: async (): Promise<{ placement: Placement; payments?: PlacementPayment[] }> => {
      const res = await apiFetch(`${API}/${id}`);
      if (!res.ok) throw new Error("Failed to load placement");
      return res.json();
    },
    enabled: !!id,
  });
  const p = data?.placement;
  const payments = data?.payments ?? [];

  // Signing requests for this placement (to surface the contract status + PDF).
  const { data: signing } = useQuery({
    queryKey: ["placement-signing", id],
    queryFn: async (): Promise<SigningReq[]> => {
      const res = await apiFetch(`${SIGNING_API}/placement_contract/${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });
  const latestSigning = (signing ?? []).slice().sort((a, b) => b.id - a.id)[0];

  useEffect(() => { if (p) setNextStatus(p.status); }, [p]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["homestay-placement", id] });
    qc.invalidateQueries({ queryKey: ["placement-signing", id] });
    qc.invalidateQueries({ queryKey: ["homestay-placements"] });
  };

  const act = (path: string, method = "POST") => async () => {
    const res = await apiFetch(path, { method });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const hostAccept = useMutation({
    mutationFn: act(`${API}/${id}/host-accept`),
    onSuccess: () => { toast({ title: t("homestayPlacement.toast_host_accepted") }); invalidate(); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  const issueContract = useMutation({
    mutationFn: act(`${API}/${id}/contract`),
    onSuccess: (d: any) => { toast({ title: t("homestayPlacement.toast_contract_issued"), description: d?.signing_url }); invalidate(); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  const changeStatus = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/status`, { method: "POST", body: JSON.stringify({ status: nextStatus }) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("homestayPlacement.toast_updated") }); setStatusOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  const resend = useMutation({
    mutationFn: async () => {
      if (!latestSigning) throw new Error("No contract to send");
      const res = await apiFetch(`${PUBLIC_SIGNING}/${latestSigning.token}/send`, { method: "POST", body: JSON.stringify(sendSel) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (d: any) => {
      const sent: string[] = d?.sent ?? [];
      if (sent.length === 0) {
        // Nothing actually emailed (e.g. "Operations team" selected but no
        // notification email configured). Warn and keep the dialog open.
        toast({ title: t("homestayPlacement.toast_none_sent"), description: t("homestayPlacement.toast_none_sent_desc"), variant: "destructive" });
        return;
      }
      toast({ title: t("homestayPlacement.toast_sent"), description: sent.join(", ") });
      setSendOpen(false);
    },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  // Create a PENDING charge (not sent). Ops send it from the Payments list.
  const charge = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/charge`, { method: "POST", body: JSON.stringify({ kind: chargeKind, method: chargeMethod }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to create charge");
      return res.json();
    },
    onSuccess: () => { toast({ title: t("homestayPlacement.toast_charge_created") }); setChargeOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  // Send / collect a pending charge: card → open Stripe link; bank → show details.
  const send = useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await apiFetch(`/api/v1/homestay-placement-payments/${paymentId}/send`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to send");
      return res.json();
    },
    onSuccess: (d: any) => {
      if (d?.method === "card" && d?.url) {
        window.open(d.url, "_blank", "noopener");
        toast({ title: d?.emailed ? t("homestayPlacement.toast_link_sent") : t("homestayPlacement.toast_payment_link") });
      } else if (d?.method === "bank_transfer") {
        setSendBank(d?.bank ?? null); setSendBankOpen(true);
      }
      invalidate();
    },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  const markPaid = useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await apiFetch(`/api/v1/homestay-placement-payments/${paymentId}/mark-paid`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("homestayPlacement.toast_marked_paid") }); invalidate(); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  const saveBilling = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/billing`, { method: "POST", body: JSON.stringify({ billing_cycle_weeks: ovCycle || null, billing_method: ovMethod || null }) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("homestayPlacement.toast_updated") }); setBillingOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  function openCharge(kind: "upfront" | "monthly") {
    setChargeKind(kind);
    setChargeMethod((p?.billing_method as any) || settings?.default_method || "card");
    setChargeOpen(true);
  }

  if (isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;
  if (!p) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("homestayPlacement.not_found")}</p></Layout>;

  const money = (v?: string) => (v == null ? "—" : `${p.currency || "AUD"} ${Number(v).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`);
  const contractSigned = latestSigning?.status === "signed";
  const canAccept = p.status === "Proposed";
  const canIssue = ["Proposed", "HostAccepted", "AwaitingPayment"].includes(p.status);
  const canPay = p.status === "AwaitingPayment";
  const isActive = ["Active", "Ending", "Completed"].includes(p.status);

  return (
    <Layout>
      <PageHeader
        title={<span className="flex items-center gap-2"><Handshake className="h-5 w-5" /> {p.placement_ref}<PlacementStatusBadge status={p.status} /></span>}
        subtitle={`${p.student_name ?? "—"} ↔ ${p.host_name ?? "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/account/homestay-placements">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button>
            </Link>
            {canAccept && (
              <Button size="sm" className="gap-1.5" onClick={() => hostAccept.mutate()} disabled={hostAccept.isPending}>
                <Check className="h-4 w-4" /> {t("homestayPlacement.btn_host_accept")}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStatusOpen(true)}>
              {t("homestayPlacement.btn_set_status")}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-4xl space-y-5">
        <Section title={t("homestayPlacement.section_parties")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestayPlacement.f_student")} value={
              <Link href={`/account/homestay-student-requests/${p.student_request_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                {p.student_name} <ExternalLink className="h-3 w-3" />
              </Link>
            } />
            <Field label={t("homestayPlacement.f_student_email")} value={p.student_email} />
            <Field label={t("homestayPlacement.f_minor")} value={p.student_is_minor ? t("common.yes") : t("common.no")} />
            <Field label={t("homestayPlacement.f_host")} value={
              <Link href={`/account/homestay-applications/${p.host_application_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                {p.host_name} <ExternalLink className="h-3 w-3" />
              </Link>
            } />
            <Field label={t("homestayPlacement.f_host_email")} value={p.host_email} />
            <Field label={t("homestayPlacement.f_suburb")} value={p.host_suburb} />
          </div>
        </Section>

        <Section title={t("homestayPlacement.section_term")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestayPlacement.f_move_in")} value={p.move_in_date} />
            <Field label={t("homestayPlacement.f_move_out")} value={p.move_out_date} />
            <Field label={t("homestayPlacement.f_proposed_at")} value={p.proposed_at ? new Date(p.proposed_at).toLocaleDateString() : null} />
            <Field label={t("homestayPlacement.f_confirmed_at")} value={p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString() : null} />
          </div>
        </Section>

        <Section
          title={t("homestayPlacement.section_fees")}
          action={
            <div className="flex gap-2">
              {canPay && (
                <Button size="sm" className="gap-1.5 h-7" onClick={() => openCharge("upfront")}>
                  <CreditCard className="h-3.5 w-3.5" /> {t("homestayPlacement.btn_collect_upfront")}
                </Button>
              )}
              {isActive && (
                <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => openCharge("monthly")}>
                  <CreditCard className="h-3.5 w-3.5" /> {t("homestayPlacement.btn_charge_monthly")}
                </Button>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestayPlacement.f_placement_fee")} value={money(p.placement_fee)} />
            <Field label={t("homestayPlacement.f_deposit")} value={money(p.deposit)} />
            <Field label={t("homestayPlacement.f_rent_per_cycle")} value={money(p.monthly_fee)} />
            <Field label={t("homestayPlacement.f_currency")} value={p.currency} />
          </div>
          {/* Effective billing schedule (global setting + per-placement override) */}
          <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>{t("homestayPlacement.f_cycle")}: <span className="font-medium text-foreground">{(p.billing_cycle_weeks || settings?.cycle_weeks || 4)} {t("homestayPlacement.weeks")}</span>{p.billing_cycle_weeks ? ` (${t("homestayPlacement.override")})` : ""}</span>
            <span>{t("homestayPlacement.f_method")}: <span className="font-medium text-foreground">{t(`homestayPlacement.method_${p.billing_method || settings?.default_method || "card"}`)}</span>{p.billing_method ? ` (${t("homestayPlacement.override")})` : ""}</span>
            {p.next_billing_date && <span>{t("homestayPlacement.f_next_billing")}: <span className="font-medium text-foreground">{p.next_billing_date}</span></span>}
            <button className="underline hover:text-foreground" onClick={() => { setOvCycle(p.billing_cycle_weeks ? String(p.billing_cycle_weeks) : ""); setOvMethod(p.billing_method || ""); setBillingOpen(true); }}>{t("homestayPlacement.btn_edit_billing")}</button>
          </div>
        </Section>

        {/* Payments */}
        <Section title={t("homestayPlacement.section_payments")}>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("homestayPlacement.payments_none")}</p>
          ) : (
            <div className="space-y-2">
              {payments.map((pay) => (
                <div key={pay.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{t(`homestayPlacement.kind_${pay.kind}`)}</span>
                    <span className="text-xs text-muted-foreground">· {t(`homestayPlacement.method_${pay.method}`)}</span>
                    <span className="font-medium">{pay.currency} {Number(pay.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                    {Number(pay.surcharge_amount) > 0 && (
                      <span className="text-[11px] text-muted-foreground">({t("homestayPlacement.incl_surcharge")} {pay.currency} {Number(pay.surcharge_amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })})</span>
                    )}
                    <span className={`text-xs font-medium ${pay.status === "paid" ? "text-green-700" : pay.status === "pending" ? "text-amber-700" : "text-red-600"}`}>· {t(`homestayPlacement.paystatus_${pay.status}`)}</span>
                    {pay.paid_at && <span className="text-[11px] text-muted-foreground">{new Date(pay.paid_at).toLocaleDateString()}</span>}
                  </div>
                  {pay.status === "pending" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 gap-1.5" onClick={() => send.mutate(pay.id)} disabled={send.isPending}>
                        <Send className="h-3.5 w-3.5" /> {pay.method === "card" ? t("homestayPlacement.btn_send_link") : t("homestayPlacement.btn_show_bank")}
                      </Button>
                      {pay.method === "bank_transfer" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => markPaid.mutate(pay.id)} disabled={markPaid.isPending}>
                          <Check className="h-3.5 w-3.5" /> {t("homestayPlacement.btn_mark_paid")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Contract & signature */}
        <Section
          title={t("homestayPlacement.section_contract")}
          action={
            canIssue && (
              <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => issueContract.mutate()} disabled={issueContract.isPending}>
                {issueContract.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
                {latestSigning ? t("homestayPlacement.btn_reissue_contract") : t("homestayPlacement.btn_issue_contract")}
              </Button>
            )
          }
        >
          {!latestSigning ? (
            <p className="text-sm text-muted-foreground">{t("homestayPlacement.contract_none")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t("homestayPlacement.contract_status")}:</span>
                <span className={`font-medium ${contractSigned ? "text-green-700" : "text-amber-700"}`}>
                  {contractSigned ? t("homestayPlacement.contract_signed") : t("homestayPlacement.contract_pending")}
                </span>
                {latestSigning.signed_at && <span className="text-xs text-muted-foreground">· {new Date(latestSigning.signed_at).toLocaleString()}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`${PUBLIC_SIGNING}/${latestSigning.token}/preview`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5"><FileText className="h-4 w-4" /> {t("homestayPlacement.btn_preview")}</Button>
                </a>
                {!contractSigned && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sign/${latestSigning.token}`); toast({ title: t("homestayPlacement.toast_link_copied") }); }}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-muted/50"
                  >
                    <Copy className="h-4 w-4" /> {t("homestayPlacement.btn_copy_link")}
                  </button>
                )}
                {contractSigned && (
                  <>
                    <a href={`${PUBLIC_SIGNING}/${latestSigning.token}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5"><FileText className="h-4 w-4" /> {t("homestayPlacement.btn_download")}</Button>
                    </a>
                    <Button size="sm" className="gap-1.5" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> {t("homestayPlacement.btn_send")}</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayPlacement.set_status_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label>{t("homestayPlacement.col_status")}</Label>
            <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as PlacementStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLACEMENT_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{t(PLACEMENT_STATUS_CONFIG[s].key)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => changeStatus.mutate()} disabled={changeStatus.isPending}>
              {changeStatus.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send signed PDF dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayPlacement.send_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-2 py-2 text-sm">
            {(["applicant", "host", "agent", "ops"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={sendSel[k]} onChange={(e) => setSendSel((s) => ({ ...s, [k]: e.target.checked }))} className="h-4 w-4" />
                {t(`homestayPlacement.recipient_${k}`)}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? t("common.saving") : t("homestayPlacement.btn_send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New charge dialog (method chooser → creates a pending charge) */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{chargeKind === "upfront" ? t("homestayPlacement.btn_collect_upfront") : t("homestayPlacement.btn_charge_monthly")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <p className="text-muted-foreground">
              {t("homestayPlacement.charge_amount")}: <span className="font-medium text-foreground">{money(chargeKind === "upfront" ? String(Number(p.placement_fee ?? 0) + Number(p.deposit ?? 0)) : p.monthly_fee)}</span>
            </p>
            <div className="grid gap-2">
              {(["card", "bank_transfer"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer">
                  <input type="radio" name="charge-method" checked={chargeMethod === m} onChange={() => setChargeMethod(m)} className="h-4 w-4" />
                  <span className="font-medium">{t(`homestayPlacement.method_${m}`)}</span>
                  {m === "card" && <span className="text-[11px] text-muted-foreground">{t("homestayPlacement.card_surcharge_note")}</span>}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("homestayPlacement.charge_pending_hint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => charge.mutate()} disabled={charge.isPending}>
              {charge.isPending ? t("common.saving") : t("homestayPlacement.btn_create_charge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank details (from sending a bank-transfer charge) */}
      <Dialog open={sendBankOpen} onOpenChange={setSendBankOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayPlacement.bank_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-2 py-2 text-sm">
            <p className="text-muted-foreground">{t("homestayPlacement.bank_relay_hint")}</p>
            {sendBank ? (
              <div className="border rounded-md p-3 grid gap-1">
                <div><span className="text-muted-foreground">{t("homestayPlacement.bank_account_name")}:</span> <span className="font-medium">{sendBank.account_name || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("homestayPlacement.bank_name")}:</span> <span className="font-medium">{sendBank.bank_name || "—"}</span></div>
                <div><span className="text-muted-foreground">BSB:</span> <span className="font-medium">{sendBank.bsb_number || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("homestayPlacement.bank_account_number")}:</span> <span className="font-medium">{sendBank.account_number || "—"}</span></div>
                {sendBank.swift_code && <div><span className="text-muted-foreground">SWIFT:</span> <span className="font-medium">{sendBank.swift_code}</span></div>}
              </div>
            ) : <p className="text-amber-700">{t("homestayPlacement.bank_none")}</p>}
            <p className="text-xs text-muted-foreground">{t("homestayPlacement.bank_mark_paid_hint")}</p>
          </div>
          <DialogFooter><Button onClick={() => setSendBankOpen(false)}>{t("common.close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-placement billing override */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayPlacement.billing_override_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t("homestayPlacement.f_cycle")} ({t("homestayPlacement.weeks")})</Label>
              <Input type="number" inputMode="numeric" value={ovCycle} onChange={(e) => setOvCycle(e.target.value)} placeholder={`${settings?.cycle_weeks ?? 4} (${t("homestayPlacement.global_default")})`} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("homestayPlacement.f_method")}</Label>
              <Select value={ovMethod || "__default"} onValueChange={(v) => setOvMethod(v === "__default" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default">{t("homestayPlacement.global_default")} ({t(`homestayPlacement.method_${settings?.default_method ?? "card"}`)})</SelectItem>
                  <SelectItem value="card">{t("homestayPlacement.method_card")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("homestayPlacement.method_bank_transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveBilling.mutate()} disabled={saveBilling.isPending}>{saveBilling.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
