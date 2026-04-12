import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListContractProducts } from "@workspace/api-client-react";
import { Plus, Search, Package, Tag } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};
const TERM_COLORS: Record<string, string> = {
  ShortTerm: "bg-sky-100 text-sky-700",
  MidTerm: "bg-violet-100 text-violet-700",
  LongTerm: "bg-amber-100 text-amber-700",
};
const TERM_LABELS: Record<string, string> = {
  ShortTerm: "Short-term",
  MidTerm: "Mid-term",
  LongTerm: "Long-term",
};

const PRODUCT_TYPES = ["Room", "Suite", "Apartment", "House", "Studio", "Service"];

export default function ContractProductList() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [productType, setProductType] = useState("_all");
  const [termType, setTermType] = useState("_all");

  const { data: products } = useListContractProducts({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    product_type: productType === "_all" ? undefined : productType,
  });

  const filtered = termType !== "_all" ? (products ?? []).filter(p => p.term_type === termType) : (products ?? []);
  const pagination = usePagination(filtered);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{t("nav.contract_product")}</h1>
              <p className="text-sm text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Link href="/products/contract-products/new">
            <Button className="bg-[#E8621A] hover:bg-[#d4561a] text-white"><Plus className="h-4 w-4 mr-2" />New Product</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search products..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={termType} onValueChange={setTermType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All term types</SelectItem>
              <SelectItem value="ShortTerm">Short-term (under 4 weeks)</SelectItem>
              <SelectItem value="MidTerm">Mid-term (4–25 weeks)</SelectItem>
              <SelectItem value="LongTerm">Long-term (26+ weeks)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All types</SelectItem>
              {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Space</TableHead>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Weekly Rate</TableHead>
                  <TableHead>Eff. Rate</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">No contract products found</TableCell>
                  </TableRow>
                ) : pagination.paginatedItems.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <Link href={`/products/contract-products/${p.id}`} className="text-[#E8621A] hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.product_type}</div>
                    </TableCell>
                    <TableCell>
                      {p.term_type ? (
                        <Badge className={`${TERM_COLORS[p.term_type] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
                          {TERM_LABELS[p.term_type] ?? p.term_type}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.space_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.promotion_name ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Tag className="h-3 w-3" />{p.promotion_name}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {p.weekly_rate != null ? `$${p.weekly_rate.toFixed(0)}/wk` : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold text-[#E8621A]">
                      {p.effective_weekly_rate != null && p.effective_weekly_rate !== p.weekly_rate
                        ? `$${p.effective_weekly_rate.toFixed(0)}/wk`
                        : (p.weekly_rate != null ? `$${p.weekly_rate.toFixed(0)}/wk` : "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.billing_frequency ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>
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
