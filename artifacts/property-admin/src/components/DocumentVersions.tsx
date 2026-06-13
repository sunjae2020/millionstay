import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, FileDown, Lock } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/date";

interface Snapshot {
  id: string;
  version: number | null;
  doc_type: string;
  file_name: string;
  file_size: number;
  created_at: string | null;
  retention_until: string | null;
  download_url: string | null;
}

/**
 * Frozen-version viewer for a document record. Lists immutable PDF snapshots
 * (each send/freeze adds a version) and lets the user download or freeze a new
 * one. `freezeUrl` is the POST endpoint that renders + stores a new snapshot.
 */
export function DocumentVersions({
  entityType,
  entityId,
  freezeUrl,
}: {
  entityType: string;
  entityId: number | string;
  freezeUrl: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);

  const queryKey = ["doc-snapshots", entityType, String(entityId)];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Snapshot[]> => {
      const res = await apiFetch(`/api/v1/document-snapshots?entity_type=${entityType}&entity_id=${entityId}`);
      if (!res.ok) throw new Error("Failed to load versions");
      return res.json();
    },
    enabled: open,
  });

  const snapshots: Snapshot[] = Array.isArray(data) ? data : [];

  const freezeNow = async () => {
    setFreezing(true);
    try {
      const res = await apiFetch(freezeUrl, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: "Version frozen", description: `Saved v${body?.version ?? "?"} as an immutable snapshot.` });
      qc.invalidateQueries({ queryKey });
    } catch (err) {
      toast({ title: "Freeze failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setFreezing(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <History className="h-4 w-4 mr-1" /> Versions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Frozen Versions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Each time this document is emailed or frozen, an immutable PDF snapshot is stored.
            </p>
            <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
              ) : snapshots.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No frozen versions yet.</div>
              ) : snapshots.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <div>
                    <span className="font-mono font-semibold text-[#E8621A]">v{s.version ?? "?"}</span>
                    <span className="text-muted-foreground ml-2">{s.file_name}</span>
                    <div className="text-xs text-muted-foreground">
                      {s.created_at ? formatDateTime(s.created_at) : "—"}
                      {" · "}{(s.file_size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  {s.download_url ? (
                    <a href={s.download_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-muted" title="Download this version">
                      <FileDown className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ) : <span className="text-xs text-muted-foreground">unavailable</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" disabled={freezing} onClick={freezeNow}>
                <Lock className="h-4 w-4 mr-1" /> {freezing ? "Freezing…" : "Freeze current version"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
