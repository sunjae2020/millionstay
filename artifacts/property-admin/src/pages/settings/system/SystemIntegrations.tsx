import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiJson } from "@/lib/apiFetch";
import { Loader2, Cable, Cpu, CreditCard, Cloud, Mail, MessageSquare, Database } from "lucide-react";
import { Card, StatusDot } from "./ui";

type Integ = { name: string; kind: string; configured: boolean; detail: string };
type Payload = { integrations: Integ[]; configuredCount: number; generatedAt: string };

function KindIcon({ kind }: { kind: string }) {
  const cls = "h-4 w-4 text-primary";
  switch (kind) {
    case "AI": return <Cpu className={cls} />;
    case "Billing": return <CreditCard className={cls} />;
    case "Storage": return <Cloud className={cls} />;
    case "Email": return <Mail className={cls} />;
    case "SMS": return <MessageSquare className={cls} />;
    case "Platform": return <Database className={cls} />;
    default: return <Cable className={cls} />;
  }
}

export default function SystemIntegrations() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<Payload>({
    queryKey: ["system-map-integrations"],
    queryFn: () => apiJson<Payload>("/api/v1/admin/system-map/integrations"),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );

  const items = data?.integrations ?? [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t("system_map.configured_of", { n: data?.configuredCount ?? 0, total: items.length })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((i) => (
          <Card key={i.name} className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <KindIcon kind={i.kind} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-foreground truncate">{i.name}</p>
                <span className="text-[10px] text-muted-foreground">· {i.kind}</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate">{i.detail}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <StatusDot ok={i.configured} />
              <span
                className={`text-[11px] font-semibold ${i.configured ? "text-emerald-600" : "text-muted-foreground"}`}
              >
                {i.configured ? t("system_map.status_connected") : t("system_map.status_not_set")}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("system_map.integ_footer", { time: data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—" })}
      </p>
    </div>
  );
}
