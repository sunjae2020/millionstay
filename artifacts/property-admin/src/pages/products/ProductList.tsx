import { useState } from "react";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListContractProducts,
  getListContractProductsQueryKey,
  useDeleteContractProduct,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Draft: "bg-gray-100 text-gray-600",
  Archived: "bg-red-100 text-red-600",
};

const TERM_LABELS: Record<string, string> = {
  ShortTerm: "Short-term",
  MidTerm: "Mid-term",
  LongTerm: "Long-term",
};

export default function ProductList() {
  const [q, setQ] = useState("");
  const [termType, setTermType] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: products, isLoading } = useListContractProducts(
    { q: q || undefined },
    { query: { queryKey: getListContractProductsQueryKey({ q: q || undefined }) } }
  );

  const deleteMutation = useDeleteContractProduct({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContractProductsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const filtered = (products ?? []).filter((p) => {
    if (termType !== "_all" && p.term_type !== termType) return false;
    if (statusFilter !== "_all" && p.status !== statusFilter) return false;
    return true;
  });

  const pagination = usePagination(filtered);

  return (
    <Layout>
      <PageHeader
        title="Products"
        subtitle={`${filtered.length} of ${products?.length ?? 0} total`}
        actions={
          <Link href="/products/contract-products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={termType} onValueChange={setTermType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Terms</SelectItem>
              <SelectItem value="ShortTerm">Short-term</SelectItem>
              <SelectItem value="MidTerm">Mid-term</SelectItem>
              <SelectItem value="LongTerm">Long-term</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Space</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Promotion</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Term</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Rate / wk</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Eff. Rate</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Billing</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">No products found</td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[260px]">
                        <Link
                          href={`/products/contract-products/${p.id}`}
                          className="text-[#E8621A] hover:underline line-clamp-2"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                        {p.space_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.promotion_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {p.term_type ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            {TERM_LABELS[p.term_type] ?? p.term_type}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        {p.weekly_rate != null ? `$${Number(p.weekly_rate).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums font-medium text-[#E8621A]">
                        {p.effective_weekly_rate != null ? `$${Number(p.effective_weekly_rate).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.billing_frequency ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[p.status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/products/contract-products/${p.id}`}>
                            <button className="p-1.5 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </Link>
                          <button
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                            onClick={() => setDeleteId(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
