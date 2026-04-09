import { useState } from "react";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
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
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: number;
  name: string;
  item_description: string | null;
  price: number | null;
  currency: string;
  space_name: string | null;
  space_id: number | null;
  promotion_id: number | null;
  promotion_name: string | null;
  min_contract_period: number | null;
  min_contract_period_unit: string | null;
  packed_services: string[];
  display_on_booking_page: boolean;
  status: string;
};

type Promotion = { id: number; display: string };

async function fetchProducts(q: string, promotionId: string): Promise<Product[]> {
  const params = new URLSearchParams({ limit: "200" });
  if (q) params.set("q", q);
  if (promotionId && promotionId !== "_all") params.set("promotion_id", promotionId);
  const res = await apiFetch(`/api/v1/accommodations?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

async function fetchPromotions(): Promise<Promotion[]> {
  const res = await apiFetch("/api/v1/lookup/promotions");
  if (!res.ok) return [];
  return res.json();
}

export default function ProductList() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [promotionFilter, setPromotionFilter] = useState("_all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["accommodation-products", q, promotionFilter],
    queryFn: () => fetchProducts(q, promotionFilter),
  });

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ["lookup-promotions"],
    queryFn: fetchPromotions,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/accommodations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accommodation-products"] });
      toast({ title: "Product deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" }),
  });

  const filtered = products.filter((p) => {
    if (statusFilter !== "_all" && p.status !== statusFilter) return false;
    return true;
  });

  const pagination = usePagination(filtered);
  const deleteTarget = products.find(p => p.id === deleteId);

  return (
    <Layout>
      <PageHeader
        title="Accommodation Products"
        subtitle={`${filtered.length} of ${products.length} total`}
        actions={
          <Link href="/products/products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          </Link>
        }
      />

      <div className="p-6">
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
          <Select value={promotionFilter} onValueChange={setPromotionFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Promotions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Promotions</SelectItem>
              {promotions.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.display}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Promotion</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Services</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No products found</td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[220px]">
                        <Link
                          href={`/products/products/${p.id}`}
                          className="text-[#E8621A] hover:underline line-clamp-2"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                        {p.promotion_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                        {p.promotion_id === 4 ? "1 Day" : "1 Week"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums font-medium text-[#E8621A]">
                        {p.price != null ? `${p.currency} ${Number(p.price).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px]">
                        {(p.packed_services ?? []).length === 0
                          ? <span className="text-muted-foreground/50">—</span>
                          : <span className="line-clamp-2">{(p.packed_services ?? []).join(", ")}</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t p-3">
              <TablePagination {...pagination} />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
