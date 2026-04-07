import { useEffect } from "react";
import { useLocation } from "wouter";
import { useListMyInvoices, getListMyInvoicesQueryKey } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FileText, Download, AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Paid: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700 border border-red-200",
  Cancelled: "bg-gray-100 text-gray-500",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

interface Invoice {
  id: number;
  invoice_ref: string | null;
  booking_ref: string | null;
  booking_id: number | null;
  space_name: string | null;
  amount: number;
  currency: string | null;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  description: string | null;
  created_at: string;
}

function PortalSideMenu({ active }: { active: string }) {
  const [, setLocation] = useLocation();
  const { logout } = useAuthStore();
  const items = [
    { href: "/portal/bookings", label: "My Bookings", icon: "📋" },
    { href: "/portal/invoices", label: "My Invoices", icon: "🧾" },
    { href: "/portal/documents", label: "Documents", icon: "📎" },
    { href: "/portal/profile", label: "My Profile", icon: "👤" },
  ];
  return (
    <aside className="w-full md:w-56 shrink-0">
      <nav className="bg-white rounded-2xl border overflow-hidden">
        {items.map((item) => (
          <button key={item.href} onClick={() => setLocation(item.href)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-b last:border-b-0 transition-colors ${
              active === item.href ? "bg-orange-50 text-primary border-l-2 border-l-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"
            }`}
          >
            <span>{item.icon}</span>{item.label}
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />
          </button>
        ))}
        <button onClick={() => { logout(); setLocation("/"); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          <span>🚪</span>Log out
        </button>
      </nav>
    </aside>
  );
}

function downloadInvoicePDF(inv: Invoice) {
  const lines: string[] = [];
  lines.push(`INVOICE`);
  lines.push(`=======`);
  lines.push(``);
  lines.push(`Invoice Number: ${inv.invoice_ref ?? `INV-${inv.id}`}`);
  lines.push(`Booking Reference: ${inv.booking_ref ?? "—"}`);
  lines.push(`Property: ${inv.space_name ?? "—"}`);
  lines.push(``);
  lines.push(`Amount Due: $${inv.amount.toLocaleString()} ${inv.currency ?? "AUD"}`);
  lines.push(`Status: ${inv.status}`);
  lines.push(`Issue Date: ${formatDate(inv.created_at)}`);
  lines.push(`Due Date: ${formatDate(inv.due_date)}`);
  if (inv.paid_at) lines.push(`Paid Date: ${formatDate(inv.paid_at)}`);
  lines.push(``);
  lines.push(`--`);
  lines.push(`MillionStay | Melbourne Student Accommodation`);
  lines.push(`info@millionstay.com`);

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inv.invoice_number ?? `INV-${inv.id}`}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function InvoiceRow({ inv }: { inv: Invoice }) {
  const overdue = inv.status === "Overdue";
  const { toast } = useToast();

  const handleDownload = () => {
    downloadInvoicePDF(inv);
    toast({ title: "Invoice downloaded", description: `${inv.invoice_ref ?? `INV-${inv.id}`} saved to your device.` });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 ${overdue ? "border-red-200" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${overdue ? "bg-red-50" : "bg-orange-50"}`}>
          {overdue ? <AlertCircle className="h-5 w-5 text-red-500" /> : <FileText className="h-5 w-5 text-primary" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{inv.invoice_ref ?? `INV-${inv.id}`}</p>
            {overdue && <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">OVERDUE</span>}
          </div>
          <p className="text-xs text-gray-500 truncate">
            {inv.space_name ?? inv.booking_ref ?? "—"} · Due {formatDate(inv.due_date)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
          {inv.status}
        </span>
        <p className="font-bold text-gray-900">${(inv.amount ?? 0).toLocaleString()} {inv.currency ?? "AUD"}</p>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs hidden sm:flex" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </div>
    </motion.div>
  );
}

export default function PortalInvoices() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/invoices");
  }, [token, setLocation]);

  const { data, isLoading } = useListMyInvoices({
    query: { enabled: !!token, queryKey: getListMyInvoicesQueryKey() },
  });

  const invoices: Invoice[] = (data?.data ?? []) as Invoice[];

  const filterInvoices = (tab: string) => {
    if (tab === "unpaid") return invoices.filter((i) => i.status === "Pending");
    if (tab === "paid") return invoices.filter((i) => i.status === "Paid");
    if (tab === "overdue") return invoices.filter((i) => i.status === "Overdue");
    return invoices;
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="bg-gradient-to-r from-[#c05010] via-[#e07828] to-[#c86820] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="font-cursive text-white/80 text-sm italic mb-1">Your account</p>
          <h1 className="text-2xl font-bold uppercase text-white tracking-wide">My Invoices</h1>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          <PortalSideMenu active="/portal/invoices" />
          <div className="flex-1">
            <Tabs defaultValue="all">
              <TabsList className="mb-6 bg-white border">
                {["all", "unpaid", "paid", "overdue"].map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="capitalize text-sm">{tab.charAt(0).toUpperCase() + tab.slice(1)}</TabsTrigger>
                ))}
              </TabsList>

              {["all", "unpaid", "paid", "overdue"].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-3">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
                  ) : filterInvoices(tab).length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No invoices yet</p>
                    </div>
                  ) : (
                    filterInvoices(tab).map((inv) => <InvoiceRow key={inv.id} inv={inv} />)
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
