import React from "react";
import { getApiBase } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, ShieldCheck, Camera, Loader2, Wallet } from "lucide-react";
import { formatCurrencyAmount } from "@/contexts/DisplayCurrencyContext";

// Tenant-facing move-in/move-out condition report: read the admin-published
// property condition, then agree or dispute each item. A dispute lets the
// tenant attach explanatory photos (hashed server-side). See
// docs/proposals/CONDITION_REPORTS_SETTLEMENT.md.

type Photo = { id: number; file_url: string; thumbnail_url: string | null; caption: string | null; content_hash: string | null; uploaded_by_type: string };
type ResponseRow = { id: number; item_id: number; decision: "agreed" | "disputed"; comment: string | null };
type Item = {
  id: number;
  area_key: string | null;
  label: string;
  description: string | null;
  condition_rating: string | null;
  photos: Photo[];
  responses: ResponseRow[];
};
type Report = {
  id: number;
  report_ref: string;
  phase: string;
  status: string;
  title: string | null;
  summary: string | null;
  published_at: string | null;
  content_hash: string | null;
  items: Item[];
};

const PHASE_LABEL: Record<string, string> = { move_in: "Move-in", interim: "Interim", move_out: "Move-out" };
const RATING_STYLE: Record<string, string> = {
  good: "bg-green-50 text-green-700 border-green-200",
  fair: "bg-amber-50 text-amber-700 border-amber-200",
  damaged: "bg-red-50 text-red-700 border-red-200",
};

export function ConditionReports({ bookingId, token }: { bookingId: string | number; token: string }) {
  const [reports, setReports] = React.useState<Report[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const listRes = await fetch(`${getApiBase()}/api/v1/guest/bookings/${bookingId}/condition-reports`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      const list: { id: number }[] = listRes?.data ?? [];
      const full = await Promise.all(
        list.map((r) =>
          fetch(`${getApiBase()}/api/v1/guest/condition-reports/${r.id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((j) => j.data as Report),
        ),
      );
      setReports(full.filter(Boolean));
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }
  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>No condition reports yet.</p>
        <p className="text-xs mt-1">When your property manager publishes a move-in or move-out inspection, it will appear here for your review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} token={token} onChanged={load} />
      ))}
      <DepositSettlements bookingId={bookingId} token={token} />
    </div>
  );
}

type Deduction = { id: number; description: string; amount: string };
type Settlement = {
  id: number; settlement_ref: string; status: string;
  deposit_held: string; total_deducted: string; refund_amount: string; currency: string;
  deductions: Deduction[];
};

function money(n: string | number, ccy: string) {
  return formatCurrencyAmount(Number(n), (ccy || "AUD").toUpperCase());
}

function DepositSettlements({ bookingId, token }: { bookingId: string | number; token: string }) {
  const [rows, setRows] = React.useState<Settlement[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/v1/guest/bookings/${bookingId}/deposit-settlements`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      setRows(res?.data ?? []);
    } catch {
      setRows([]);
    }
  }, [bookingId, token]);
  React.useEffect(() => { void load(); }, [load]);

  async function acknowledge(id: number) {
    await fetch(`${getApiBase()}/api/v1/guest/deposit-settlements/${id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    load();
  }

  if (!rows || rows.length === 0) return null;

  return (
    <div className="space-y-4">
      {rows.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-gray-800">Deposit settlement</span>
              <span className="text-xs font-mono text-gray-400">{s.settlement_ref}</span>
            </div>
            <span className="text-xs font-semibold text-gray-500">{s.status === "proposed" ? "Awaiting your acknowledgement" : s.status === "tenant_ack" ? "Acknowledged" : s.status === "finalized" ? "Finalized" : s.status}</span>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border p-3"><p className="text-xs text-gray-500">Deposit held</p><p className="font-semibold">{money(s.deposit_held, s.currency)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-gray-500">Deductions</p><p className="font-semibold text-red-600">−{money(s.total_deducted, s.currency)}</p></div>
              <div className="rounded-xl border p-3 bg-green-50/50"><p className="text-xs text-gray-500">Refund to you</p><p className="font-semibold text-green-700">{money(s.refund_amount, s.currency)}</p></div>
            </div>
            {s.deductions.length > 0 && (
              <div className="space-y-1.5">
                {s.deductions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                    <span className="text-gray-700">{d.description}</span>
                    <span className="font-medium text-red-600">−{money(d.amount, s.currency)}</span>
                  </div>
                ))}
              </div>
            )}
            {s.status === "proposed" && (
              <Button size="sm" onClick={() => acknowledge(s.id)} className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge settlement</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportCard({ report, token, onChanged }: { report: Report; token: string; onChanged: () => void }) {
  const decided = (itemId: number) => report.items.find((i) => i.id === itemId)?.responses[0]?.decision ?? null;
  const closed = report.status === "finalized";

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{PHASE_LABEL[report.phase] ?? report.phase} inspection</span>
            <span className="text-xs font-mono text-gray-400">{report.report_ref}</span>
          </div>
          {report.title && <p className="text-xs text-gray-500 mt-0.5">{report.title}</p>}
        </div>
        <StatusBadge status={report.status} />
      </div>

      {report.summary && <p className="px-6 pt-4 text-sm text-gray-600">{report.summary}</p>}

      {report.content_hash && (
        <div className="px-6 pt-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400" title={report.content_hash}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Tamper-evident · SHA-256 {report.content_hash.slice(0, 12)}…
          </div>
        </div>
      )}

      <div className="p-6 space-y-4">
        {report.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            reportId={report.id}
            token={token}
            decision={decided(item.id)}
            locked={closed}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    published: { label: "Awaiting your review", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    tenant_agreed: { label: "Agreed", cls: "bg-green-50 text-green-700 border-green-200" },
    disputed: { label: "Disputed", cls: "bg-red-50 text-red-700 border-red-200" },
    finalized: { label: "Finalized", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>{s.label}</span>;
}

function ItemRow({
  item, reportId, token, decision, locked, onChanged,
}: {
  item: Item; reportId: number; token: string; decision: "agreed" | "disputed" | null; locked: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [showDispute, setShowDispute] = React.useState(false);
  const [comment, setComment] = React.useState(item.responses[0]?.comment ?? "");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function respond(dec: "agreed" | "disputed") {
    setBusy(true);
    try {
      await fetch(`${getApiBase()}/api/v1/guest/condition-report-items/${item.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision: dec, comment: dec === "disputed" ? comment : null }),
      });
      onChanged();
    } finally {
      setBusy(false);
      if (dec === "agreed") setShowDispute(false);
    }
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("item_id", String(item.id));
      await fetch(`${getApiBase()}/api/v1/guest/condition-reports/${reportId}/upload-photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const adminPhotos = item.photos.filter((p) => p.uploaded_by_type === "admin");
  const tenantPhotos = item.photos.filter((p) => p.uploaded_by_type === "tenant");

  return (
    <div className="border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{item.label}</span>
            {item.condition_rating && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${RATING_STYLE[item.condition_rating] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {item.condition_rating}
              </span>
            )}
          </div>
          {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
        </div>
        {decision === "agreed" && <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold shrink-0"><CheckCircle2 className="h-4 w-4" />Agreed</span>}
        {decision === "disputed" && <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold shrink-0"><AlertTriangle className="h-4 w-4" />Disputed</span>}
      </div>

      {adminPhotos.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {adminPhotos.map((p) => (
            <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="block">
              <img src={p.thumbnail_url ?? p.file_url} alt={p.caption ?? ""} className="h-16 w-16 object-cover rounded-lg border" />
            </a>
          ))}
        </div>
      )}

      {tenantPhotos.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-400 mb-1">Your photos</p>
          <div className="flex gap-2 flex-wrap">
            {tenantPhotos.map((p) => (
              <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="block">
                <img src={p.thumbnail_url ?? p.file_url} alt="" className="h-16 w-16 object-cover rounded-lg border border-red-200" />
              </a>
            ))}
          </div>
        </div>
      )}

      {item.responses[0]?.comment && (
        <p className="mt-3 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-red-800">{item.responses[0].comment}</p>
      )}

      {!locked && (
        <div className="mt-3">
          {!showDispute ? (
            <div className="flex gap-2">
              <Button size="sm" variant={decision === "agreed" ? "default" : "outline"} disabled={busy} onClick={() => respond("agreed")} className="gap-1.5">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Agree
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowDispute(true)} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                <AlertTriangle className="h-3.5 w-3.5" /> Dispute
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe the issue (e.g. pre-existing scratch on the floor)…"
                className="w-full text-sm border rounded-lg px-3 py-2 min-h-[70px]"
              />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Add photo
                </Button>
                <Button size="sm" disabled={busy} onClick={() => respond("disputed")} className="gap-1.5 bg-red-600 hover:bg-red-700">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />} Submit dispute
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setShowDispute(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
