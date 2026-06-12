import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
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
  created_at: string;
}

interface SigningReq { id: number; token: string; status: string; context_type: string; signed_at?: string | null }

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

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-placement", id],
    queryFn: async (): Promise<{ placement: Placement }> => {
      const res = await apiFetch(`${API}/${id}`);
      if (!res.ok) throw new Error("Failed to load placement");
      return res.json();
    },
    enabled: !!id,
  });
  const p = data?.placement;

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
    onSuccess: (d: any) => { toast({ title: t("homestayPlacement.toast_sent"), description: (d?.sent ?? []).join(", ") }); setSendOpen(false); },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

  const collectPayment = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/payment`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to start payment");
      return res.json();
    },
    onSuccess: (d: any) => {
      if (d?.url) window.open(d.url, "_blank", "noopener");
      toast({ title: t("homestayPlacement.toast_payment_link") });
    },
    onError: (e: any) => toast({ title: t("homestayPlacement.error"), description: e.message, variant: "destructive" }),
  });

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
            (canPay || isActive) && (
              canPay ? (
                <Button size="sm" className="gap-1.5 h-7" onClick={() => collectPayment.mutate()} disabled={collectPayment.isPending}>
                  {collectPayment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                  {t("homestayPlacement.btn_collect_payment")}
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><Check className="h-3.5 w-3.5" /> {t("homestayPlacement.paid")}</span>
              )
            )
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestayPlacement.f_placement_fee")} value={money(p.placement_fee)} />
            <Field label={t("homestayPlacement.f_deposit")} value={money(p.deposit)} />
            <Field label={t("homestayPlacement.f_monthly_fee")} value={money(p.monthly_fee)} />
            <Field label={t("homestayPlacement.f_currency")} value={p.currency} />
          </div>
          {canPay && (
            <p className="text-xs text-muted-foreground mt-3">
              {t("homestayPlacement.payment_hint")} — {money(String(Number(p.placement_fee ?? 0) + Number(p.deposit ?? 0)))}
            </p>
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
    </Layout>
  );
}
