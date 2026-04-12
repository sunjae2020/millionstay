import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListSpaces,
  useDeleteSpace,
  getListSpacesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
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

export default function SpaceList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [spaceType, setSpaceType] = useState("");
  const [status, setStatus] = useState("");
  const [bookingMode, setBookingMode] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = {
    search: search || undefined,
    space_type: spaceType || undefined,
    status: status || undefined,
    booking_mode: bookingMode || undefined,
  };

  const { data: spaces, isLoading } = useListSpaces(params, {
    query: { queryKey: getListSpacesQueryKey(params) },
  });

  const pagination = usePagination(spaces ?? []);

  const deleteMutation = useDeleteSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  return (
    <Layout>
      <PageHeader
        title={t("nav.space")}
        subtitle={`${spaces?.length ?? 0} total`}
        actions={
          <Link href="/property/spaces/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Space
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search spaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={spaceType || "_all"} onValueChange={(v) => setSpaceType(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Space Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              <SelectItem value="Private Room">Private Room</SelectItem>
              <SelectItem value="Shared Room">Shared Room</SelectItem>
              <SelectItem value="Whole Property">Whole Property</SelectItem>
              <SelectItem value="Desk">Desk</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || "_all"} onValueChange={(v) => setStatus(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bookingMode || "_all"} onValueChange={(v) => setBookingMode(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Booking Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Modes</SelectItem>
              <SelectItem value="Instant">Instant</SelectItem>
              <SelectItem value="Request">Request</SelectItem>
              <SelectItem value="Manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Property</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Policy</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Parent Space</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Created On</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
              ) : spaces?.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No spaces found</td></tr>
              ) : (
                pagination.paginatedItems.map((space) => (
                  <tr key={space.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/property/spaces/${space.id}`} className="hover:underline text-[#E8621A]">{space.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.property_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.space_type ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={space.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.policy_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.parent_space_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(space.created_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/property/spaces/${space.id}`}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(space.id)}>
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
            <AlertDialogTitle>Delete Space</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this space?</AlertDialogDescription>
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
