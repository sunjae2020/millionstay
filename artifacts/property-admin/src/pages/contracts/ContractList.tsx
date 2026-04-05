import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListContracts } from "@workspace/api-client-react";
import { Plus, Search } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Signed: "bg-purple-100 text-purple-700",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-orange-100 text-orange-700",
  Terminated: "bg-red-100 text-red-700",
};

export default function ContractList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");

  const { data: contracts } = useListContracts({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
  });

  const pagination = usePagination(contracts ?? []);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Contracts</h1>
            <p className="text-sm text-muted-foreground">{contracts?.length ?? 0} total</p>
          </div>
          <Link href="/contracts/contracts/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Contract</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search contract ref..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Signed">Signed</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract Ref</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Weekly Rate</TableHead>
                <TableHead>Total Rent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!contracts || contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    No contracts found
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedItems.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/contracts/contracts/${c.id}`} className="text-blue-600 hover:underline font-medium font-mono">
                      {c.contract_ref}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.tenant_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.space_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.contract_product_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.start_date ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.end_date ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {c.weekly_rate != null ? `$${c.weekly_rate}/wk` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.total_rent != null ? `$${c.total_rent.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[c.status] ?? "bg-gray-100 text-gray-700"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}
