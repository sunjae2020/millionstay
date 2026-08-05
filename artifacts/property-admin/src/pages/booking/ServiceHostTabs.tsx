import { useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Briefcase, Wrench, Receipt, Plus, Camera, Headphones, Upload, Trash2 } from "lucide-react";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
// Admin service-host detail tabs (#4): jobs & payouts (GL-backed accounting),
// photos, and CS tickets — all scoped to one service host by id.

const chip = (s: string) => {
  const m: Record<string, string> = {
    Accrued: "bg-blue-100 text-blue-700", Approved: "bg-amber-100 text-amber-700",
    Paid: "bg-green-100 text-green-700", Active: "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700", Open: "bg-blue-100 text-blue-700",
    Cancelled: "bg-gray-100 text-gray-600", InProgress: "bg-yellow-100 text-yellow-700",
  };
  return m[s] ?? "bg-gray-100 text-gray-600";
};

/* ── Jobs & Payouts (accounting) ─────────────────────────────────────────── */
export function ServiceHostAccounting({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const money = (n: string | number, ccy?: string | null) => formatMoney(n, ccy ?? currency, currencyPosition);
  const qc = useQueryClient();
  const jobsQ = useQuery<{ data: { jobs: any[]; work_orders: any[] } }>({ queryKey: ["sh-jobs", hostId], queryFn: () => apiJson(`/api/v1/service-hosts/${hostId}/jobs`) });
  const payQ = useQuery<{ data: any[]; summary: any }>({ queryKey: ["sh-payouts", hostId], queryFn: () => apiJson(`/api/v1/service-hosts/${hostId}/payouts`) });
  const inval = () => { qc.invalidateQueries({ queryKey: ["sh-payouts", hostId] }); };

  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useMutation({
    mutationFn: () => apiJson(`/api/v1/service-hosts/${hostId}/payouts`, { method: "POST", body: JSON.stringify({ amount: Number(amount), description: desc, source_type: "manual" }) }),
    onSuccess: () => { setAdding(false); setAmount(""); setDesc(""); inval(); },
  });
  const approve = useMutation({ mutationFn: (id: number) => apiJson(`/api/v1/partner-payouts/${id}/approve`, { method: "POST", body: "{}" }), onSuccess: inval });
  const pay = useMutation({ mutationFn: (id: number) => apiJson(`/api/v1/partner-payouts/${id}/mark-paid`, { method: "POST", body: "{}" }), onSuccess: inval });

  const s = payQ.data?.summary;
  const jobs = jobsQ.data?.data.jobs ?? [];
  const wos = jobsQ.data?.data.work_orders ?? [];
  const payouts = payQ.data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("service_host_acct.revenue", "Revenue generated")} value={s ? money(s.revenue_generated) : "—"} />
        <Stat label={t("service_host_acct.outstanding", "Outstanding payout")} value={s ? money(s.outstanding) : "—"} accent="orange" />
        <Stat label={t("service_host_acct.approved", "Approved")} value={s ? money(s.payout_approved) : "—"} />
        <Stat label={t("service_host_acct.paid", "Paid")} value={s ? money(s.payout_paid) : "—"} accent="green" />
      </div>

      {/* Payouts */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Receipt className="w-4 h-4 text-primary" />{t("service_host_acct.payouts", "Partner payouts")}</h3>
          {!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5 mr-1" />{t("service_host_acct.add_payout", "Record payout")}</Button>}
        </div>
        {adding && (
          <div className="rounded-lg border bg-white p-3 mb-2 flex gap-2 flex-wrap items-end">
            <div><label className="block text-xs text-muted-foreground mb-1">{t("service_host_acct.amount", "Amount")}</label><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-32" /></div>
            <div className="flex-1 min-w-[160px]"><label className="block text-xs text-muted-foreground mb-1">{t("common.description", "Description")}</label><input value={desc} onChange={(e) => setDesc(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-full" /></div>
            <Button size="sm" disabled={!(Number(amount) > 0) || create.isPending} onClick={() => create.mutate()}>{t("common.save", "Save")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t("common.cancel", "Cancel")}</Button>
          </div>
        )}
        <div className="rounded-lg border bg-white overflow-x-auto">
          <ExportableTable fileName="service-host-payouts" className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{[t("service_host_acct.ref", "Ref"), t("common.description", "Description"), t("service_host_acct.amount", "Amount"), t("common.status", "Status"), ""].map((h) => <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {payouts.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">{t("service_host_acct.no_payouts", "No payouts yet")}</td></tr> : payouts.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{p.payout_ref}</td>
                  <td className="px-3 py-2">{p.description ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{money(p.amount, p.currency)}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${chip(p.status)}`}>{p.status}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {p.status === "Accrued" && <button className="text-primary hover:underline text-xs mr-3" onClick={() => approve.mutate(p.id)}>{t("service_host_acct.approve", "Approve")}</button>}
                    {p.status === "Approved" && <button className="text-green-600 hover:underline text-xs" onClick={() => pay.mutate(p.id)}>{t("service_host_acct.mark_paid", "Mark paid")}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </ExportableTable>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">{t("service_host_acct.gl_note", "Accrual posts Dr Contractor Expense / Cr Contractor Payable; payment posts Dr Payable / Cr Cash.")}</p>
      </section>

      {/* Jobs */}
      <section>
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><Briefcase className="w-4 h-4 text-primary" />{t("service_host_acct.jobs", "Service jobs")} ({jobs.length})</h3>
        <div className="rounded-lg border bg-white overflow-x-auto">
          <ExportableTable fileName="service-host-gl-entries" className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{[t("service_host_acct.booking", "Booking"), t("common.name", "Name"), t("service_host_acct.price", "Price"), t("common.status", "Status"), ""].map((h, i) => <th key={h || i} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {jobs.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">{t("service_host_acct.no_jobs", "No jobs")}</td></tr> : jobs.map((j) => (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{j.booking_ref ?? `#${j.booking_id}`}</td>
                  <td className="px-3 py-2">{j.service_name ?? "—"}</td>
                  <td className="px-3 py-2">{money(j.total_price, j.currency)}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${chip(j.status)}`}>{j.status}</span></td>
                  <td className="px-3 py-2 text-right"><JobPhotoUpload hostId={hostId} jobId={j.id} /></td>
                </tr>
              ))}
            </tbody>
          </ExportableTable>
        </div>
      </section>

      {/* Work orders */}
      {wos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><Wrench className="w-4 h-4 text-primary" />{t("service_host_acct.work_orders", "Work orders")} ({wos.length})</h3>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <ExportableTable fileName="service-host-work-orders" className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{[t("service_host_acct.ref", "Ref"), t("common.title", "Title"), t("service_host_acct.cost", "Cost"), t("common.status", "Status")].map((h) => <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {wos.map((w) => (
                  <tr key={w.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs"><Link href={`/maintenance/work-orders/${w.id}`} className="text-primary hover:underline">{w.order_ref}</Link></td>
                    <td className="px-3 py-2">{w.title}</td>
                    <td className="px-3 py-2">{w.cost != null ? money(w.cost, w.currency) : "—"}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${chip(w.status)}`}>{w.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </ExportableTable>
          </div>
        </section>
      )}
    </div>
  );
}

/** Per-job photo upload — files land on that booking_service and show in the 사진 tab. */
function JobPhotoUpload({ hostId, jobId }: { hostId: string; jobId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("image", file);
        await apiJson(`/api/v1/service-hosts/${hostId}/jobs/${jobId}/photos`, { method: "POST", body: fd });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sh-photos", hostId] }),
  });
  return (
    <>
      <input
        ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) upload.mutate(e.target.files); e.target.value = ""; }}
      />
      <button
        type="button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
      >
        <Upload className="w-3 h-3" />
        {upload.isPending ? t("common.uploading", "업로드 중…") : t("service_host_photos.add", "사진 추가")}
      </button>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "orange" | "green" }) {
  const c = accent === "orange" ? "text-primary" : accent === "green" ? "text-green-600" : "text-foreground";
  return <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`font-semibold mt-0.5 ${c}`}>{value}</p></div>;
}

/* ── Photos ──────────────────────────────────────────────────────────────── */
export function ServiceHostPhotos({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery<{ data: any[] }>({ queryKey: ["sh-photos", hostId], queryFn: () => apiJson(`/api/v1/service-hosts/${hostId}/photos`) });
  const photos = data?.data ?? [];

  // apiJson omits the JSON content-type for FormData bodies, so the browser
  // writes the multipart boundary itself.
  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("image", file);
        await apiJson(`/api/v1/service-hosts/${hostId}/photos`, { method: "POST", body: fd });
      }
    },
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ["sh-photos", hostId] }); },
    onError: (e: any) => setError(e?.message ?? t("common.error", "Something went wrong")),
  });
  const remove = useMutation({
    mutationFn: (photoId: number) => apiJson(`/api/v1/service-hosts/${hostId}/photos/${photoId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sh-photos", hostId] }),
    onError: (e: any) => setError(e?.message ?? t("common.error", "Something went wrong")),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Camera className="w-4 h-4 text-primary" />{t("service_host_photos.title", "사진")} ({photos.length})</h3>
        <div>
          <input
            ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) upload.mutate(e.target.files); e.target.value = ""; }}
          />
          <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 mr-1" />
            {upload.isPending ? t("common.uploading", "업로드 중…") : t("service_host_photos.upload", "사진 업로드")}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {photos.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
          <Camera className="w-7 h-7 mx-auto mb-2 text-gray-300" />{t("service_host_photos.empty", "No job photos yet")}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={`${p.source ?? "job"}-${p.id}`} className="relative group">
              <a href={p.file_url} target="_blank" rel="noreferrer" className="block">
                <img src={p.thumbnail_url ?? p.file_url} alt={p.caption ?? ""} className="w-full aspect-square object-cover rounded-lg border" />
                {p.caption && <p className="text-xs text-muted-foreground mt-1 truncate">{p.caption}</p>}
              </a>
              {/* Job photos are booking evidence — only host-owned uploads are removable. */}
              {p.source === "host" && (
                <button
                  type="button" title={t("common.delete", "삭제")}
                  onClick={() => remove.mutate(p.id)}
                  className="absolute top-1.5 right-1.5 rounded-full bg-white/90 border p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── CS tickets ──────────────────────────────────────────────────────────── */
export function ServiceHostCs({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const { data } = useQuery<{ data: any[] }>({ queryKey: ["sh-cs", hostId], queryFn: () => apiJson(`/api/v1/service-hosts/${hostId}/cs-tickets`) });
  const tickets = data?.data ?? [];
  if (tickets.length === 0) return <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground"><Headphones className="w-7 h-7 mx-auto mb-2 text-gray-300" />{t("service_host_cs.empty", "No support tickets from this partner")}</div>;
  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <ExportableTable fileName="service-host-cs-tickets" className="w-full text-sm">
        <thead className="bg-gray-50 border-b"><tr>{[t("service_host_cs.ref", "Ref"), t("service_host_cs.subject", "Subject"), t("service_host_cs.category", "Category"), t("common.status", "Status")].map((h) => <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {tickets.map((tk) => (
            <tr key={tk.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs"><Link href={`/cs/tickets/${tk.id}`} className="text-primary hover:underline">{tk.ticket_ref}</Link></td>
              <td className="px-3 py-2">{tk.subject}</td>
              <td className="px-3 py-2 text-muted-foreground">{tk.category}</td>
              <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${chip(tk.status)}`}>{tk.status}</span></td>
            </tr>
          ))}
        </tbody>
      </ExportableTable>
    </div>
  );
}
