import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, MessageCircle, ChevronRight, Headphones, Clock, CheckCircle2,
  XCircle, AlertCircle, Megaphone, Mail, MailOpen, Info, Wrench,
  CalendarDays, ShieldCheck, Star, Bell,
} from "lucide-react";
import { format } from "date-fns";

const BASE = "/api/v1";
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("ms_guest_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function gFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers as Record<string, string> ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

/* ── Types ── */
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

interface Announcement {
  id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  published_at: string;
}

interface DirectMessage {
  id: number;
  subject: string;
  body: string;
  sender_name: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

/* ── Config maps ── */
const STATUS_LABELS: Record<string, string> = {
  Open: "Open", InProgress: "In Progress", Resolved: "Resolved", Closed: "Closed",
};
const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700 border border-blue-200",
  InProgress: "bg-amber-100 text-amber-700 border border-amber-200",
  Resolved: "bg-green-100 text-green-700 border border-green-200",
  Closed: "bg-gray-100 text-gray-500 border border-gray-200",
};
const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-purple-100 text-purple-700",
  Accommodation: "bg-orange-100 text-orange-700",
  Billing: "bg-yellow-100 text-yellow-700",
  Maintenance: "bg-red-100 text-red-700",
  Other: "bg-gray-100 text-gray-600",
};
const ANN_CATEGORY_CONFIG: Record<string, { icon: React.ElementType; bg: string; border: string; text: string }> = {
  General:     { icon: Bell,       bg: "bg-blue-50",   border: "border-blue-100",   text: "text-blue-700" },
  Maintenance: { icon: Wrench,     bg: "bg-amber-50",  border: "border-amber-100",  text: "text-amber-700" },
  Policy:      { icon: ShieldCheck,bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-700" },
  Event:       { icon: Star,       bg: "bg-green-50",  border: "border-green-100",  text: "text-green-700" },
  Urgent:      { icon: AlertCircle,bg: "bg-red-50",    border: "border-red-100",    text: "text-red-700" },
};
const ANN_PRIORITY_BADGE: Record<string, string> = {
  High:   "bg-red-100 text-red-700 border border-red-200",
  Urgent: "bg-red-100 text-red-700 border border-red-200",
  Normal: "bg-gray-100 text-gray-500 border border-gray-200",
  Low:    "bg-gray-100 text-gray-400 border border-gray-200",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "Open") return <Clock className="h-3 w-3" />;
  if (status === "InProgress") return <AlertCircle className="h-3 w-3" />;
  if (status === "Resolved") return <CheckCircle2 className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

/* ── Inquiry Card ── */
function InquiryCard({ ticket }: { ticket: CsTicket }) {
  const { t } = useTranslation();
  const stColor = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.Open;
  const stLabel = STATUS_LABELS[ticket.status] ?? ticket.status;
  return (
    <Link href={`/portal/cs/${ticket.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-mono text-gray-400">{ticket.ticket_ref}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
                {ticket.category}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stColor}`}>
                <StatusIcon status={ticket.status} />{stLabel}
              </span>
            </div>
            <p className="font-semibold text-gray-900 text-sm truncate">{ticket.subject}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {ticket.message_count} {t("portal.cs.messages")}
              </span>
              <span>{t("portal.cs.updated")} {format(new Date(ticket.updated_at), "dd MMM yyyy")}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>
      </motion.div>
    </Link>
  );
}

/* ── Announcement Card ── */
function AnnouncementCard({ ann }: { ann: Announcement }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const cfg = ANN_CATEGORY_CONFIG[ann.category] ?? ANN_CATEGORY_CONFIG.General;
  const Icon = cfg.icon;
  const isHighPriority = ann.priority === "High" || ann.priority === "Urgent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border overflow-hidden ${isHighPriority ? "border-amber-200 shadow-sm shadow-amber-50" : "border-gray-100 shadow-sm"}`}
    >
      {/* Priority stripe */}
      {isHighPriority && <div className="h-1 w-full bg-amber-400" />}

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
            <Icon className={`h-5 w-5 ${cfg.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 text-sm leading-snug">{ann.title}</h3>
              <div className="flex items-center gap-1.5 shrink-0">
                {isHighPriority && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ANN_PRIORITY_BADGE[ann.priority]}`}>
                    {ann.priority}
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {ann.category}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {format(new Date(ann.published_at), "dd MMM yyyy")}
            </p>
            <p className={`text-sm text-gray-600 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {ann.body}
            </p>
            {ann.body.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-primary font-medium mt-1.5 hover:underline"
              >
                {expanded ? t("portal.cs.show_less") : t("portal.cs.read_more")}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Direct Message Card ── */
function DirectMessageCard({
  msg,
  onRead,
}: {
  msg: DirectMessage;
  onRead: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!msg.is_read);
  const isUnread = msg.is_read === 0;

  const handleToggle = () => {
    setExpanded((prev) => !prev);
    if (isUnread && !expanded) onRead(msg.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border overflow-hidden transition-all ${isUnread ? "border-primary/30 shadow-md shadow-primary/5" : "border-gray-100 shadow-sm"}`}
    >
      <button
        onClick={handleToggle}
        className="w-full text-left p-5"
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isUnread ? "bg-primary/10" : "bg-gray-50"}`}>
            {isUnread
              ? <Mail className="h-5 w-5 text-primary" />
              : <MailOpen className="h-5 w-5 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  <p className={`text-sm font-semibold truncate ${isUnread ? "text-gray-900" : "text-gray-700"}`}>
                    {msg.subject}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {t("portal.cs.from")} <span className="font-medium text-gray-600">{msg.sender_name}</span>
                  {" · "}
                  {format(new Date(msg.created_at), "dd MMM yyyy")}
                </p>
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""} text-gray-300`} />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0">
              <div className="border-t border-gray-50 pt-3">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                {msg.read_at && (
                  <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {t("portal.cs.read_on")} {format(new Date(msg.read_at), "dd MMM yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon: Icon, title, sub, action }: {
  icon: React.ElementType;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-gray-300" />
      </div>
      <p className="font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-gray-400 mb-5">{sub}</p>
      {action}
    </div>
  );
}

/* ── Main Page ── */
export default function PortalCs() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/cs");
  }, [token, setLocation]);

  /* Data queries */
  const { data: ticketsData, isLoading: loadingTickets } = useQuery<{ success: boolean; data: CsTicket[] }>({
    queryKey: ["guest-cs-tickets"],
    queryFn: () => gFetch("/guest/cs-tickets"),
    enabled: !!token,
  });

  const { data: annData, isLoading: loadingAnn } = useQuery<{ success: boolean; data: Announcement[] }>({
    queryKey: ["guest-announcements"],
    queryFn: () => gFetch("/guest/announcements"),
    enabled: !!token,
  });

  const { data: msgData, isLoading: loadingMsg } = useQuery<{ success: boolean; data: DirectMessage[]; meta: { unread_count: number } }>({
    queryKey: ["guest-direct-messages"],
    queryFn: () => gFetch("/guest/direct-messages"),
    enabled: !!token,
    refetchInterval: 60000,
  });

  /* Mark message as read mutation */
  const markReadMutation = useMutation({
    mutationFn: (id: number) => gFetch(`/guest/direct-messages/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest-direct-messages"] }),
  });

  const tickets = ticketsData?.data ?? [];
  const announcements = annData?.data ?? [];
  const messages = msgData?.data ?? [];
  const unreadCount = msgData?.meta?.unread_count ?? 0;

  const openTickets = tickets.filter((t) => t.status === "Open" || t.status === "InProgress").length;

  if (!token) return null;

  return (
    <PortalLayout active="/portal/cs">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t("portal.cs.title")}</h1>
              <p className="text-sm text-gray-500">{t("portal.cs.subtitle")}</p>
            </div>
          </div>
          <Link href="/portal/cs/new">
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              {t("portal.cs.new_inquiry")}
            </Button>
          </Link>
        </div>

        {/* ── Summary strip ── */}
        {!loadingTickets && !loadingMsg && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: t("portal.cs.open_inquiries"),  count: openTickets,  color: "text-blue-600",  bg: "bg-blue-50 border-blue-100" },
              { label: t("portal.cs.announcements"), count: announcements.length, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
              { label: t("portal.cs.unread_messages"), count: unreadCount,  color: "text-primary",   bg: "bg-orange-50 border-orange-100" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="inquiries">
          <TabsList className="mb-5 bg-white border w-full">
            <TabsTrigger value="inquiries" className="flex-1 gap-2 text-sm">
              <Headphones className="h-3.5 w-3.5" />
              {t("portal.cs.tab_inquiries")}
              {openTickets > 0 && (
                <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 border-0 text-xs px-1.5 py-0.5">
                  {openTickets}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex-1 gap-2 text-sm">
              <Megaphone className="h-3.5 w-3.5" />
              {t("portal.cs.tab_announcements")}
              {announcements.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-700 border-0 text-xs px-1.5 py-0.5">
                  {announcements.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-1 gap-2 text-sm">
              <Mail className="h-3.5 w-3.5" />
              {t("portal.cs.tab_messages")}
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-primary text-white border-0 text-xs px-1.5 py-0.5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Inquiries Tab ── */}
          <TabsContent value="inquiries" className="space-y-3">
            {loadingTickets ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : tickets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <EmptyState
                  icon={Headphones}
                  title={t("portal.cs.empty_inquiry_title")}
                  sub={t("portal.cs.empty_inquiry_sub")}
                  action={
                    <Link href="/portal/cs/new">
                      <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                        <Plus className="h-4 w-4" /> {t("portal.cs.submit_first")}
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <AnimatePresence>
                {tickets.map((t) => <InquiryCard key={t.id} ticket={t} />)}
              </AnimatePresence>
            )}
          </TabsContent>

          {/* ── Announcements Tab ── */}
          <TabsContent value="announcements" className="space-y-3">
            {loadingAnn ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
            ) : announcements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <EmptyState
                  icon={Megaphone}
                  title={t("portal.cs.empty_ann_title")}
                  sub={t("portal.cs.empty_ann_sub")}
                />
              </div>
            ) : (
              <AnimatePresence>
                {announcements.map((a) => <AnnouncementCard key={a.id} ann={a} />)}
              </AnimatePresence>
            )}
          </TabsContent>

          {/* ── Messages Tab ── */}
          <TabsContent value="messages" className="space-y-3">
            {loadingMsg ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : messages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <EmptyState
                  icon={Mail}
                  title={t("portal.cs.empty_msg_title")}
                  sub={t("portal.cs.empty_msg_sub")}
                />
              </div>
            ) : (
              <AnimatePresence>
                {messages.map((m) => (
                  <DirectMessageCard
                    key={m.id}
                    msg={m}
                    onRead={(id) => markReadMutation.mutate(id)}
                  />
                ))}
              </AnimatePresence>
            )}
            {messages.length > 0 && unreadCount === 0 && (
              <p className="text-center text-xs text-gray-400 pt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {t("portal.cs.all_read")}
              </p>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </PortalLayout>
  );
}
