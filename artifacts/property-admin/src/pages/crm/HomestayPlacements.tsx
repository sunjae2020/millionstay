import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { formatDate } from "@/lib/date";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Eye } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-placements";

export type PlacementStatus =
  | "Proposed" | "HostAccepted" | "AwaitingPayment" | "Active"
  | "Ending" | "Completed" | "Cancelled" | "Terminated";

export interface Placement {
  id: number;
  placement_ref: string;
  status: PlacementStatus;
  host_name?: string | null;
  host_suburb?: string | null;
  student_name?: string | null;
  student_is_minor?: boolean;
  move_in_date?: string | null;
  move_out_date?: string | null;
  currency?: string;
  placement_fee?: string;
  monthly_fee?: string;
  created_at: string;
}

export const PLACEMENT_STATUS_CONFIG: Record<PlacementStatus, { key: string; badge: string; dot: string }> = {
  Proposed:       { key: "homestayPlacement.status_proposed",        badge: "bg-violet-100 text-violet-700 border-violet-200",  dot: "bg-violet-500" },
  HostAccepted:   { key: "homestayPlacement.status_host_accepted",   badge: "bg-blue-100 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  AwaitingPayment:{ key: "homestayPlacement.status_awaiting_payment",badge: "bg-amber-100 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  Active:         { key: "homestayPlacement.status_active",          badge: "bg-green-100 text-green-700 border-green-200",     dot: "bg-green-500" },
  Ending:         { key: "homestayPlacement.status_ending",          badge: "bg-orange-100 text-orange-700 border-orange-200",  dot: "bg-orange-500" },
  Completed:      { key: "homestayPlacement.status_completed",       badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-600" },
  Cancelled:      { key: "homestayPlacement.status_cancelled",       badge: "bg-zinc-100 text-zinc-600 border-zinc-200",        dot: "bg-zinc-400" },
  Terminated:     { key: "homestayPlacement.status_terminated",      badge: "bg-red-100 text-red-700 border-red-200",           dot: "bg-red-400" },
};

export const PLACEMENT_STATUS_ORDER: PlacementStatus[] = [
  "Proposed", "HostAccepted", "AwaitingPayment", "Active", "Ending", "Completed", "Cancelled", "Terminated",
];

export function PlacementStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = PLACEMENT_STATUS_CONFIG[status as PlacementStatus];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.badge ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
      {cfg ? t(cfg.key) : status}
    </span>
  );
}

async function fetchPlacements(status: string): Promise<Placement[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await apiFetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load placements");
  const json = await res.json();
  return (json.data ?? []) as Placement[];
}

export default function HomestayPlacements() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"" | PlacementStatus>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["homestay-placements", status],
    queryFn: () => fetchPlacements(status),
  });

  return (
    <Layout>
      <PageHeader
        title={<><Handshake className="h-5 w-5" />{t("homestayPlacement.list_title")}</>}
        subtitle={t("homestayPlacement.list_subtitle")}
      />

      <div className="px-6 py-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatus("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              status === "" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            {t("homestayPlacement.filter_all")}
          </button>
          {PLACEMENT_STATUS_ORDER.map((s) => {
            const cfg = PLACEMENT_STATUS_CONFIG[s];
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active ? cfg.badge : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {t(cfg.key)}
              </button>
            );
          })}
        </div>

        <div className="border rounded-lg bg-white mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("homestayPlacement.col_ref")}</TableHead>
                <TableHead>{t("homestayPlacement.col_student")}</TableHead>
                <TableHead>{t("homestayPlacement.col_host")}</TableHead>
                <TableHead>{t("homestayPlacement.col_move_in")}</TableHead>
                <TableHead>{t("homestayPlacement.col_status")}</TableHead>
                <TableHead>{t("homestayPlacement.col_created")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t("homestayPlacement.empty")}</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/account/homestay-placements/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {r.placement_ref}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/account/homestay-placements/${r.id}`} className="font-medium hover:underline">
                      {r.student_name || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.host_name || "—"}{r.host_suburb ? ` · ${r.host_suburb}` : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.move_in_date || <span className="text-muted-foreground/40">—</span>}</TableCell>
                  <TableCell><PlacementStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.created_at ? formatDate(r.created_at) : "—"}</TableCell>
                  <TableCell>
                    <Link href={`/account/homestay-placements/${r.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t("common.view")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {rows.length} {t("homestayPlacement.count_label")}
        </p>
      </div>
    </Layout>
  );
}
