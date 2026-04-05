import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};

async function fetchProducts(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  const res = await fetch(`/api/v1/products${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default function ProductList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");

  const { data, isLoading } = useQuery({
    queryKey: ["products", q, status],
    queryFn: () => fetchProducts({
      q,
      ...(status !== "_all" && status === "Active" ? { is_active: "true" } : {}),
      ...(status !== "_all" && status !== "Active" ? { is_active: "false" } : {}),
      limit: "200",
    }),
  });

  const products = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Products</h1>
            </div>
            <p className="text-sm text-muted-foreground">{total} total in catalogue</p>
          </div>
          <Link href="/products/products/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Product</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search products..."
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
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Space</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Min Period</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">Loading...</TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">No products found</TableCell>
                </TableRow>
              ) : products.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/products/products/${p.id}`} className="text-blue-600 hover:underline font-medium">
                      {p.name}
                    </Link>
                    {p.item_description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.item_description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{p.group_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.type_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.space_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-right">
                    {p.price != null ? `$${Number(p.price).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{p.gst_included ? "Incl." : "Excl."}</TableCell>
                  <TableCell className="text-sm">
                    {p.min_contract_period != null
                      ? `${p.min_contract_period} ${p.min_contract_period_unit ?? "wk"}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
