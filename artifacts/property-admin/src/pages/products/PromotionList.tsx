import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus } from "lucide-react";

const MOCK_PROMOS = [
  { id: 1, name: "Early Bird Discount", type: "Percentage", discount: "10%", code: "EARLY10", valid_from: "2026-05-01", valid_to: "2026-06-30", status: "Scheduled" },
  { id: 2, name: "Long Stay Special", type: "Fixed", discount: "$200", code: "LONG200", valid_from: "2026-04-01", valid_to: "2026-12-31", status: "Active" },
];

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Expired: "bg-gray-100 text-gray-700",
  Disabled: "bg-red-100 text-red-700",
};

export default function PromotionList() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Promotions</h1>
            </div>
            <p className="text-sm text-muted-foreground">{MOCK_PROMOS.length} promotions</p>
          </div>
          <Button><Plus className="h-4 w-4 mr-2" />New Promotion</Button>
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PROMOS.map(p => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm">{p.type}</TableCell>
                  <TableCell className="text-sm font-mono">{p.discount}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.code}</code></TableCell>
                  <TableCell className="text-sm">{p.valid_from}</TableCell>
                  <TableCell className="text-sm">{p.valid_to}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>
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
