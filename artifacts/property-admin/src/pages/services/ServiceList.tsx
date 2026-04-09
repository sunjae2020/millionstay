import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Archive, Calendar, Package, Zap } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { apiFetch } from "@/lib/apiFetch";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-600",
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  one_time:  { label: "One-time",  color: "bg-blue-100 text-blue-700",   icon: Zap },
  scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-700", icon: Calendar },
  physical:  { label: "Physical",  color: "bg-amber-100 text-amber-700",  icon: Package },
};

async function fetchServices(q?: string, service_type?: string, status?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (service_type) params.set("service_type", service_type);
  if (status) params.set("status", status);
  const res = await apiFetch(`/api/v1/services?${params}`);
  if (!res.ok) throw new Error("Failed to fetch services");
  return res.json();
}

async function archiveService(id: number) {
  const res = await apiFetch(`/api/v1/services/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to archive");
  return res.json();
}

export default function ServiceList() {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["services", q, typeFilter, statusFilter],
    queryFn: () => fetchServices(
      q || undefined,
      typeFilter !== "_all" ? typeFilter : undefined,
      statusFilter !== "_all" ? statusFilter : undefined,
    ),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => archiveService(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      setArchiveId(null);
    },
  });

  const rows: any[] = data?.data ?? [];
  const pagination = usePagination(rows);

  return (
    <Layout>
      <PageHeader
        title="Service Products"
        subtitle={`${rows.length} services`}
        actions={
          <Link href="/services/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Service</Button>
          </Link>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="physical">Physical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Service Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Billing Trigger</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Optional</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Refundable</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No services found</td></tr>
                ) : pagination.paginatedItems.map((s: any) => {
                  const typeConf = TYPE_CONFIG[s.service_type] ?? { label: s.service_type, color: "bg-gray-100 text-gray-600", icon: Zap };
                  const Icon = typeConf.icon;
                  const TRIGGER_LABELS: Record<string, string> = {
                    at_booking: "At Booking",
                    at_checkout: "At Checkout",
                    on_request: "On Request",
                  };
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/services/${s.id}`} className="text-[#E8621A] hover:underline">
                          {s.name}
                        </Link>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs gap-1 ${typeConf.color}`}>
                          <Icon className="h-3 w-3" />{typeConf.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {s.base_price != null ? `$${Number(s.base_price).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {TRIGGER_LABELS[s.billing_trigger] ?? s.billing_trigger}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={s.is_optional ? "text-gray-400" : "text-[#E8621A] font-medium"}>
                          {s.is_optional ? "Optional" : "Required"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={s.is_refundable ? "text-green-600 font-medium" : "text-gray-400"}>
                          {s.is_refundable ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[s.status] ?? ""}`}>{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/services/${s.id}`}>
                            <button className="p-1.5 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </Link>
                          <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setArchiveId(s.id)}>
                            <Archive className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={archiveId !== null} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Service</AlertDialogTitle>
            <AlertDialogDescription>This service will be archived and hidden from booking pages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => archiveId && archiveMutation.mutate(archiveId)}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
