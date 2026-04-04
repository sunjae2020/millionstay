import { useState } from "react";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useListContacts, useDeleteContact, getListContactsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Globe } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ContactList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = { search: search || undefined, status: statusFilter || undefined };
  const { data: contacts, isLoading } = useListContacts(params, {
    query: { queryKey: getListContactsQueryKey(params) },
  });

  const deleteMutation = useDeleteContact({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  return (
    <Layout>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts?.length ?? 0} total`}
        actions={
          <Link href="/crm/contacts/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Contact</Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search contacts…" className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mobile</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nationality</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Portal</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts?.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.first_name} {c.last_name}
                      </Link>
                      {c.nationality && <span className="ml-1 text-xs text-muted-foreground">({c.nationality})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.mobile_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.nationality ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.portal_enabled
                        ? <Badge variant="outline" className="gap-1 text-green-700 border-green-300"><Globe className="h-3 w-3" />On</Badge>
                        : <span className="text-xs text-muted-foreground">Off</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/contacts/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!contacts || contacts.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No contacts found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
