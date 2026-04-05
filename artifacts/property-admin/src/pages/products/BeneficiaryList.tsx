import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users2, Plus, CheckCircle, DollarSign } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

const MOCK_BENS = [
  { id: 1, name: "Dynamic Residential", account: "Dynamic Residential_Agent", contract_product: "Standard Room - Weekly", commission: "10%", amount: "$140.00", settlement_status: "Pending" },
  { id: 2, name: "Melcrop Commission", account: "Melcrop RealEstate", contract_product: "Suite Premium - Weekly", commission: "8%", amount: "$544.00", settlement_status: "Approved" },
];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Approved: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Disputed: "bg-red-100 text-red-700",
};

export default function BeneficiaryList() {
  const pagination = usePagination(MOCK_BENS);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users2 className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Beneficiaries</h1>
            </div>
            <p className="text-sm text-muted-foreground">{MOCK_BENS.length} beneficiary records</p>
          </div>
          <Button><Plus className="h-4 w-4 mr-2" />New Beneficiary</Button>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Contract Product</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.account}</TableCell>
                  <TableCell className="text-sm">{b.contract_product}</TableCell>
                  <TableCell className="text-sm">{b.commission}</TableCell>
                  <TableCell className="text-sm text-right font-mono">{b.amount}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[b.settlement_status] ?? "bg-gray-100 text-gray-700"}>
                      {b.settlement_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {b.settlement_status === "Pending" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />Approve
                        </Button>
                      )}
                      {b.settlement_status === "Approved" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <DollarSign className="h-3 w-3 mr-1" />Mark Paid
                        </Button>
                      )}
                    </div>
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
