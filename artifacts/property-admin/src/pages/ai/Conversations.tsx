import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiJson } from "@/lib/apiFetch";
import { MessagesSquare, User, Bot, Wrench } from "lucide-react";

interface Conversation {
  id: string;
  session_id: string;
  language: string | null;
  status: string;
  lead_id: number | null;
  contact_email: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name: string | null;
  created_at: string;
}

const ACCENT = "#E8621A";

export default function Conversations() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Conversation | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => apiJson<{ success: boolean; data: Conversation[] }>("/api/v1/chat/conversations"),
  });
  const conversations = data?.data ?? [];

  return (
    <Layout>
      <PageHeader
        title={t("ai.conv.title")}
        subtitle={t("ai.conv.subtitle")}
      />
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[360px_1fr]">
        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("ai.conv.loading")}</p>
          ) : conversations.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
              <MessagesSquare className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("ai.conv.empty")}</p>
            </Card>
          ) : (
            conversations.map((c) => (
              <Card
                key={c.id}
                onClick={() => setSelected(c)}
                className={`cursor-pointer p-3 transition hover:shadow ${selected?.id === c.id ? "ring-2" : ""}`}
                style={selected?.id === c.id ? { ["--tw-ring-color" as any]: ACCENT } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {c.contact_email ?? t("ai.conv.visitor", { id: c.session_id.slice(0, 8) })}
                  </span>
                  {c.lead_id && <Badge style={{ backgroundColor: ACCENT }} className="text-white">{t("ai.conv.lead", { id: c.lead_id })}</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {c.language && <Badge variant="outline" className="text-xs">{c.language}</Badge>}
                  <span>{new Date(c.last_message_at ?? c.created_at).toLocaleString()}</span>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Transcript */}
        <div>
          {selected ? <Transcript conversation={selected} /> : (
            <Card className="flex h-full min-h-[300px] items-center justify-center p-8 text-sm text-muted-foreground">
              {t("ai.conv.select_prompt")}
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Transcript({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["chat-conversations", conversation.id, "messages"],
    queryFn: () => apiJson<{ success: boolean; data: { messages: Message[] } }>(
      `/api/v1/chat/conversations/${conversation.id}/messages`,
    ),
  });
  const messages = (data?.data?.messages ?? []).filter((m) => m.content);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 border-b pb-3 text-sm">
        <span className="font-medium">{conversation.contact_email ?? t("ai.conv.visitor", { id: conversation.session_id.slice(0, 8) })}</span>
        {conversation.lead_id && <Badge style={{ backgroundColor: ACCENT }} className="text-white">{t("ai.conv.lead", { id: conversation.lead_id })}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{conversation.status}</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("ai.conv.loading_transcript")}</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="flex gap-2.5 text-sm">
              <div className="mt-0.5 flex-shrink-0">
                {m.role === "user" ? <User className="h-4 w-4 text-gray-500" />
                  : m.role === "tool" ? <Wrench className="h-4 w-4 text-amber-500" />
                  : <Bot className="h-4 w-4" style={{ color: ACCENT }} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">
                  {m.role === "tool"
                    ? t("ai.conv.tool_label", { name: m.tool_name ?? "" })
                    : m.role === "user" ? t("ai.conv.role_user") : t("ai.conv.role_assistant")}
                </div>
                <div className={`whitespace-pre-wrap break-words ${m.role === "tool" ? "font-mono text-xs text-muted-foreground" : ""}`}>
                  {m.role === "tool" ? truncate(m.content, 600) : m.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
