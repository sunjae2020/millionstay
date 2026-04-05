import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, Plus, Search, Pencil } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useListPromotions } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Scheduled: "bg-yellow-100 text-yellow-700",
  Expired: "bg-gray-100 text-gray-700",
  Disabled: "bg-red-100 text-red-700",
  Draft: "bg-slate-100 text-slate-600",
};

const TYPE_LABELS: Record<string, string> = {
  Percentage: "% Off",
  Fixed: "$ Off",
  FreeNights: "Free Nights",
};

function formatDiscount(promo: { promotion_type: string; discount_percentage?: number | null; discount_amount?: number | null; free_nights?: number | null }) {
  if (promo.promotion_type === "Percentage" && promo.discount_percentage != null) return `${promo.discount_percentage}%`;
  if (promo.promotion_type === "Fixed" && promo.discount_amount != null) return `$${promo.discount_amount.toFixed(0)}`;
  if (promo.promotion_type === "FreeNights" && promo.free_nights != null) return `${promo.free_nights} nights`;
  return "—";
}

export default function PromotionList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");

  const { data: promotions = [], isLoading } = useListPromotions({
    search: search || undefined,
    status: status !== "_all" ? status : undefined,
  });

  const pagination = usePagination(promotions);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Promotions</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${promotions.length} promotion${promotions.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/products/promotions/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Promotion</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search promotions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Disabled">Disabled</SelectItem>
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
                  <TableHead>Discount</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Valid From</TableHead>
                  <TableHead>Valid To</TableHead>
                  <TableHead>Max Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">Loading...</TableCell>
                  </TableRow>
                ) : pagination.paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">No promotions found</TableCell>
                  </TableRow>
                ) : pagination.paginatedItems.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <Link href={`/products/promotions/${p.id}`} className="text-[#E8621A] hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{TYPE_LABELS[p.promotion_type] ?? p.promotion_type}</TableCell>
                    <TableCell className="text-sm font-mono font-medium">{formatDiscount(p)}</TableCell>
                    <TableCell>
                      {p.code ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p.code}</code>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.valid_from ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.valid_to ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.max_uses ?? "∞"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/products/promotions/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
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
