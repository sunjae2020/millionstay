import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListBeneficiaries,
  getListBeneficiariesQueryKey,
  useDeleteBeneficiary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-600",
  Archived: "bg-red-100 text-red-600",
};

const TYPE_COLORS: Record<string, string> = {
  Percentage: "bg-blue-100 text-blue-700",
  Fixed: "bg-amber-100 text-amber-700",
};

export default function BeneficiaryList() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: beneficiaries, isLoading } = useListBeneficiaries(
    { q: q || undefined, status: statusFilter === "_all" ? undefined : statusFilter },
    { query: { queryKey: getListBeneficiariesQueryKey({ q: q || undefined }) } }
  );

  const deleteMutation = useDeleteBeneficiary({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const filtered = (beneficiaries ?? []).filter((b) => {
    if (typeFilter !== "_all" && b.commission_type !== typeFilter) return false;
    return true;
  });

  const pagination = usePagination(filtered);

  return (
    <Layout>
      <PageHeader
        title={t("nav.beneficiary")}
        subtitle={`${filtered.length} of ${beneficiaries?.length ?? 0} total`}
        actions={
          <Link href="/products/beneficiaries/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Beneficiary
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
              placeholder="Search beneficiaries..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              <SelectItem value="Percentage">Percentage</SelectItem>
              <SelectItem value="Fixed">Fixed Amount</SelectItem>
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
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Contract Product</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Commission</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Rate / Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-20">Priority</th>
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
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">No beneficiaries found</p>
                        <p className="text-xs">Beneficiaries connect accounts to commissions and contract products</p>
                        <Link href="/products/beneficiaries/new">
                          <Button size="sm" variant="outline">Add First Beneficiary</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/products/beneficiaries/${b.id}`} className="text-[#E8621A] hover:underline">
                          {b.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {b.account_name ?? <span className="italic opacity-50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {b.contract_product_name ?? <span className="italic opacity-50">All products</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {b.commission_name ?? <span className="italic opacity-50">Custom</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${TYPE_COLORS[b.commission_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.commission_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums font-semibold text-[#E8621A]">
                        {b.commission_type === "Percentage"
                          ? b.split_percentage != null ? `${b.split_percentage}%` : "—"
                          : b.fixed_amount != null ? `$${Number(b.fixed_amount).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{b.priority ?? 1}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/products/beneficiaries/${b.id}`}>
                            <button className="p-1.5 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </Link>
                          <button
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                            onClick={() => setDeleteId(b.id)}
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
            <AlertDialogTitle>Delete Beneficiary</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this beneficiary record. This action cannot be undone.
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
