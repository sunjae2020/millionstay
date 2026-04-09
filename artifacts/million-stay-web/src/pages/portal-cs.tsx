import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MessageCircle, ChevronRight, HeadphonesIcon, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const BASE = "/api/v1";
function authHeaders() {
  const token = localStorage.getItem("ms_guest_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function gFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Open:       { label: "Open",        color: "bg-blue-100 text-blue-700",   icon: <Clock className="h-3 w-3" /> },
  InProgress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> },
  Resolved:   { label: "Resolved",    color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  Closed:     { label: "Closed",      color: "bg-gray-100 text-gray-500",   icon: <XCircle className="h-3 w-3" /> },
};

const CATEGORY_COLORS: Record<string, string> = {
  General:       "bg-purple-100 text-purple-700",
  Accommodation: "bg-orange-100 text-orange-700",
  Billing:       "bg-yellow-100 text-yellow-700",
  Maintenance:   "bg-red-100 text-red-700",
  Other:         "bg-gray-100 text-gray-600",
};

interface CsTicket {
  id: number;
  ticket_ref: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function PortalCs() {
  const [, navigate] = useLocation();
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery<{ success: boolean; data: CsTicket[] }>({
    queryKey: ["guest-cs-tickets"],
    queryFn: () => gFetch("/guest/cs-tickets"),
    enabled: !!token,
  });

  const tickets = data?.data ?? [];

  if (!token) {
    navigate("/login?redirect=/portal/cs");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <HeadphonesIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Inquiries</h1>
              <p className="text-sm text-gray-500">Submit and track your support requests</p>
            </div>
          </div>
          <Link href="/portal/cs/new">
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Plus className="h-4 w-4" />
              New Inquiry
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <HeadphonesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-semibold text-lg">No inquiries yet</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">Have a question or issue? We're here to help.</p>
            <Link href="/portal/cs/new">
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Plus className="h-4 w-4" />
                Submit First Inquiry
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => {
              const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.Open;
              return (
                <Link key={ticket.id} href={`/portal/cs/${ticket.id}`}>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-xs font-mono text-gray-400">{ticket.ticket_ref}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
                            {ticket.category}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.icon}{st.label}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {ticket.message_count} message{ticket.message_count !== 1 ? "s" : ""}
                          </span>
                          <span>Updated {format(new Date(ticket.updated_at), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
