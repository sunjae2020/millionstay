import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListContractProducts } from "@workspace/api-client-react";
import { Plus, Search, Package } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};

const PRODUCT_TYPES = ["Room", "Suite", "Apartment", "House", "Studio", "Service"];

export default function ContractProductList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [productType, setProductType] = useState("_all");

  const { data: products } = useListContractProducts({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    product_type: productType === "_all" ? undefined : productType,
  });

  const pagination = usePagination(products ?? []);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Contract Products</h1>
            <p className="text-sm text-muted-foreground">{products?.length ?? 0} total</p>
          </div>
          <Link href="/products/contract-products/new">
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
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All types</SelectItem>
              {PRODUCT_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Weekly Rate</TableHead>
                <TableHead>Monthly Rate</TableHead>
                <TableHead>Bond (wks)</TableHead>
                <TableHead>Min Stay</TableHead>
                <TableHead>Inclusions</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!products || products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    No contract products found
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedItems.map(p => {
                const inclusions = [
                  p.includes_wifi && "WiFi",
                  p.includes_parking && "Parking",
                  p.includes_utilities && "Utilities",
                  p.includes_meals && "Meals",
                  p.includes_laundry && "Laundry",
                  p.includes_cleaning && "Cleaning",
                ].filter(Boolean).join(", ");
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/products/contract-products/${p.id}`} className="text-blue-600 hover:underline font-medium">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{p.product_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.space_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.weekly_rate != null ? `$${p.weekly_rate}/wk` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.monthly_rate != null ? `$${p.monthly_rate}/mo` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{p.bond_weeks ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.min_stay_weeks != null ? `${p.min_stay_weeks} wk${p.min_stay_weeks !== 1 ? "s" : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                      {inclusions || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] ?? "bg-gray-100 text-gray-700"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}
