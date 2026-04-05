import { useState } from "react";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListServiceHosts, useDeleteServiceHost, getListServiceHostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ServiceHostList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = { search: search || undefined };
  const { data: hosts, isLoading } = useListServiceHosts(params, {
    query: { queryKey: getListServiceHostsQueryKey(params) },
  });

  const pagination = usePagination(hosts ?? []);

  const deleteMutation = useDeleteServiceHost({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListServiceHostsQueryKey({}) });
        setDeleteId(null);
      },
    },
  });

  return (
    <Layout>
      <PageHeader
        title="Service Hosts"
        subtitle={`${hosts?.length ?? 0} total`}
        actions={
          <Link href="/booking/service-hosts/new">
            <Button><Plus className="w-4 h-4 mr-1" /> New Service Host</Button>
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search service hosts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Name", "Account", "Service Type", "Period", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : !hosts?.length ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No service hosts found</td></tr>
              ) : pagination.paginatedItems.map((host) => (
                <tr key={host.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/booking/service-hosts/${host.id}`} className="text-blue-600 hover:underline">{host.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{(host as any).account_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="flex gap-1">
                      {host.in_call && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">In-Call</span>}
                      {host.out_call && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">Out-Call</span>}
                      {!host.in_call && !host.out_call && "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {host.from_date && host.to_date ? `${host.from_date} → ${host.to_date}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${host.status === "Active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {host.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/booking/service-hosts/${host.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="w-3.5 h-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(host.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Host?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
