import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useListSpacePolicies,
  useDeleteSpacePolicy,
  getListSpacePoliciesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
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

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-0.5 text-green-600 text-xs font-medium"><Check className="h-3 w-3" /> Yes</span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs"><X className="h-3 w-3" /> No</span>
  );
}

export default function SpacePolicyList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: policies, isLoading } = useListSpacePolicies(
    { search: search || undefined },
    { query: { queryKey: getListSpacePoliciesQueryKey({ search: search || undefined }) } }
  );

  const pagination = usePagination(policies ?? []);

  const deleteMutation = useDeleteSpacePolicy({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacePoliciesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  return (
    <Layout>
      <PageHeader
        title={t("nav.space_policy")}
        subtitle={`${policies?.length ?? 0} total`}
        actions={
          <Link href="/property/space-policies/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Policy
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search policies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Same Gender</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Lady Only</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">No Pet</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">No Smoking</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Min Age</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
              ) : policies?.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No policies found</td></tr>
              ) : (
                pagination.paginatedItems.map((policy) => (
                  <tr key={policy.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/property/space-policies/${policy.id}`} className="hover:underline text-[#E8621A]">{policy.name}</Link>
                    </td>
                    <td className="px-4 py-3"><BoolCell value={policy.same_gender} /></td>
                    <td className="px-4 py-3"><BoolCell value={policy.lady_only} /></td>
                    <td className="px-4 py-3"><BoolCell value={policy.no_pet} /></td>
                    <td className="px-4 py-3"><BoolCell value={policy.no_smoking} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{policy.minimum_age ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={policy.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/property/space-policies/${policy.id}`}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(policy.id)}>
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
            <AlertDialogTitle>Delete Space Policy</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this policy?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
