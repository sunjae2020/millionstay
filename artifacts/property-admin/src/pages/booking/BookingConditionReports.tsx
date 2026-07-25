import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Plus, ShieldCheck, Upload, CheckCircle2, AlertTriangle, Lock, Trash2 } from "lucide-react";

// Admin management of booking condition reports (move-in / interim / move-out):
// build the item set, attach hashed evidence photos, publish (freezes a
// tamper-evident snapshot the tenant then agrees to or disputes), review
// disputes, finalize. See docs/proposals/CONDITION_REPORTS_SETTLEMENT.md.

type Photo = { id: number; file_url: string; thumbnail_url: string | null; content_hash: string | null; uploaded_by_type: string };
type ResponseRow = { id: number; item_id: number; decision: "agreed" | "disputed"; comment: string | null };
type Item = { id: number; area_key: string | null; label: string; description: string | null; condition_rating: string | null; photos: Photo[]; responses: ResponseRow[] };
type Report = { id: number; report_ref: string; phase: string; status: string; title: string | null; summary: string | null; content_hash: string | null; items: Item[] };

const AREA_KEYS = ["door", "floor", "living", "kitchen", "bathroom", "bedroom", "balcony", "other"];
const RATINGS = ["good", "fair", "damaged"];
const PHASES = ["move_in", "interim", "move_out"];
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-blue-50 text-blue-700",
  tenant_agreed: "bg-green-50 text-green-700",
  disputed: "bg-red-50 text-red-700",
  finalized: "bg-gray-200 text-gray-700",
};

export function BookingConditionReports({ bookingId }: { bookingId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [phase, setPhase] = useState("move_in");
  const [title, setTitle] = useState("");

  const listKey = ["condition-reports", bookingId];
  const { data: reports } = useQuery<Report[]>({
    queryKey: listKey,
    queryFn: async () => {
      const list = await apiJson<{ data: { id: number }[] }>(`/api/v1/bookings/${bookingId}/condition-reports`);
      const full = await Promise.all((list.data ?? []).map((r) => apiJson<{ data: Report }>(`/api/v1/condition-reports/${r.id}`).then((j) => j.data)));
      return full;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => apiJson(`/api/v1/bookings/${bookingId}/condition-reports`, {
      method: "POST",
      body: JSON.stringify({ phase, title: title || null }),
    }),
    onSuccess: () => { setCreating(false); setTitle(""); setPhase("move_in"); qc.invalidateQueries({ queryKey: listKey }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> Condition Reports</h4>
        {!creating && <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Report</Button>}
      </div>

      {creating && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Phase</span>
              <select value={phase} onChange={(e) => setPhase(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-sm flex-1 min-w-[200px]">
              <span className="block text-xs text-muted-foreground mb-1">Title (optional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-full" placeholder="Move-in inspection" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={createMut.isPending} onClick={() => createMut.mutate()}>Create draft</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {!reports?.length ? (
        <div className="text-center py-8 text-muted-foreground text-sm rounded-lg border bg-white">No condition reports yet</div>
      ) : (
        reports.map((r) => <ReportEditor key={r.id} report={r} onChanged={() => qc.invalidateQueries({ queryKey: listKey })} />)
      )}
    </div>
  );
}

function ReportEditor({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const isDraft = report.status === "draft";
  const isFinal = report.status === "finalized";
  const [showAdd, setShowAdd] = useState(false);

  async function addItem(payload: { area_key: string; label: string; description: string; condition_rating: string }) {
    await apiJson(`/api/v1/condition-reports/${report.id}/items`, { method: "POST", body: JSON.stringify(payload) });
    setShowAdd(false);
    onChanged();
  }
  async function publish() {
    await apiJson(`/api/v1/condition-reports/${report.id}/publish`, { method: "POST", body: "{}" });
    onChanged();
  }
  async function finalize() {
    await apiJson(`/api/v1/condition-reports/${report.id}/finalize`, { method: "POST", body: "{}" });
    onChanged();
  }

  const disputes = report.items.filter((i) => i.responses[0]?.decision === "disputed").length;
  const agreed = report.items.filter((i) => i.responses[0]?.decision === "agreed").length;

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{report.phase}</span>
          <span className="text-xs font-mono text-muted-foreground">{report.report_ref}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[report.status] ?? "bg-gray-100"}`}>{report.status}</span>
          {report.items.length > 0 && <span className="text-xs text-muted-foreground">{agreed} agreed · {disputes} disputed</span>}
        </div>
        <div className="flex gap-2">
          {isDraft && <Button size="sm" onClick={publish} disabled={!report.items.length}>Publish</Button>}
          {(report.status === "tenant_agreed" || report.status === "disputed") && <Button size="sm" variant="outline" onClick={finalize}><Lock className="w-3.5 h-3.5 mr-1" /> Finalize</Button>}
        </div>
      </div>

      {report.content_hash && (
        <div className="px-4 pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5" title={report.content_hash}>
          <ShieldCheck className="w-3.5 h-3.5" /> Tamper-evident · SHA-256 {report.content_hash.slice(0, 16)}…
        </div>
      )}

      <div className="p-4 space-y-2">
        {report.items.map((item) => (
          <ItemEditor key={item.id} item={item} reportId={report.id} editable={isDraft} onChanged={onChanged} />
        ))}

        {isDraft && (showAdd ? (
          <AddItemForm onAdd={addItem} onCancel={() => setShowAdd(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add item</Button>
        ))}
        {!report.items.length && !isDraft && <p className="text-sm text-muted-foreground">No items.</p>}
      </div>

      {isFinal && <div className="px-4 py-2 border-t bg-gray-50 text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Finalized — locked for evidence.</div>}
    </div>
  );
}

function ItemEditor({ item, reportId, editable, onChanged }: { item: Item; reportId: number; editable: boolean; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const decision = item.responses[0]?.decision ?? null;

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("item_id", String(item.id));
      // apiFetch attaches auth and skips JSON content-type for FormData bodies.
      await apiFetch(`/api/v1/condition-reports/${reportId}/upload-photo`, { method: "POST", body: fd });
      onChanged();
    } finally {
      setUploading(false);
    }
  }

  const adminPhotos = item.photos.filter((p) => p.uploaded_by_type === "admin");
  const tenantPhotos = item.photos.filter((p) => p.uploaded_by_type === "tenant");

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{item.label}</span>
            {item.area_key && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{item.area_key}</span>}
            {item.condition_rating && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{item.condition_rating}</span>}
          </div>
          {item.description && <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>}
        </div>
        {decision === "agreed" && <span className="text-xs text-green-600 flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> agreed</span>}
        {decision === "disputed" && <span className="text-xs text-red-600 flex items-center gap-1 shrink-0"><AlertTriangle className="w-3.5 h-3.5" /> disputed</span>}
      </div>

      {(adminPhotos.length > 0 || tenantPhotos.length > 0) && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {adminPhotos.map((p) => <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer"><img src={p.thumbnail_url ?? p.file_url} className="h-14 w-14 object-cover rounded border" alt="" /></a>)}
          {tenantPhotos.map((p) => <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer"><img src={p.thumbnail_url ?? p.file_url} className="h-14 w-14 object-cover rounded border border-red-300" alt="" title="tenant evidence" /></a>)}
        </div>
      )}

      {item.responses[0]?.comment && <p className="mt-2 text-sm bg-red-50 border border-red-100 rounded px-2 py-1 text-red-800">{item.responses[0].comment}</p>}

      {editable && (
        <label className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }} />
        </label>
      )}
    </div>
  );
}

function AddItemForm({ onAdd, onCancel }: { onAdd: (p: { area_key: string; label: string; description: string; condition_rating: string }) => void; onCancel: () => void }) {
  const [area_key, setArea] = useState("living");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [condition_rating, setRating] = useState("good");
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex gap-2 flex-wrap">
        <select value={area_key} onChange={(e) => setArea(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          {AREA_KEYS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Living room floor)" className="border rounded px-2 py-1.5 text-sm flex-1 min-w-[160px]" />
        <select value={condition_rating} onChange={(e) => setRating(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes / 특이사항" className="w-full border rounded px-2 py-1.5 text-sm min-h-[56px]" />
      <div className="flex gap-2">
        <Button size="sm" disabled={!label.trim()} onClick={() => onAdd({ area_key, label: label.trim(), description, condition_rating })}>Add</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
