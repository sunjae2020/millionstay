import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";

interface Integration {
  name: string;
  description: string;
  status: "connected" | "disconnected" | "partial";
  docUrl: string;
  envKeys: string[];
  category: string;
}

const INTEGRATIONS: Integration[] = [
  {
    name: "Stripe",
    description: "결제 처리 및 인보이스 자동 수금",
    status: "disconnected",
    docUrl: "https://dashboard.stripe.com/apikeys",
    envKeys: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
    category: "결제",
  },
  {
    name: "Resend",
    description: "이메일 발송 서비스 (인보이스, 계약서, 알림)",
    status: "disconnected",
    docUrl: "https://resend.com/api-keys",
    envKeys: ["RESEND_API_KEY"],
    category: "이메일",
  },
  {
    name: "Google Maps",
    description: "매물 위치 지도 표시 및 주소 자동완성",
    status: "disconnected",
    docUrl: "https://console.cloud.google.com/apis/credentials",
    envKeys: ["GOOGLE_MAPS_API_KEY"],
    category: "지도",
  },
  {
    name: "Twilio / SMS",
    description: "SMS 알림 발송 (예약 확인, 결제 알림)",
    status: "disconnected",
    docUrl: "https://console.twilio.com/",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    category: "메시징",
  },
  {
    name: "DocuSign",
    description: "전자 서명 (계약서 서명 자동화)",
    status: "disconnected",
    docUrl: "https://developers.docusign.com/",
    envKeys: ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_SECRET_KEY"],
    category: "문서",
  },
  {
    name: "Xero",
    description: "회계 소프트웨어 연동 (인보이스, 경비 동기화)",
    status: "disconnected",
    docUrl: "https://developer.xero.com/app/manage",
    envKeys: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET"],
    category: "회계",
  },
];

const STATUS_CONFIG = {
  connected: { label: "연결됨", color: "text-emerald-600", icon: CheckCircle2, badge: "outline" as const },
  partial: { label: "일부 설정", color: "text-amber-600", icon: CheckCircle2, badge: "secondary" as const },
  disconnected: { label: "미연결", color: "text-muted-foreground", icon: XCircle, badge: "secondary" as const },
};

const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

export function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">외부 서비스 연동</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          각 서비스는 Replit Secrets에 환경변수를 추가하여 활성화합니다.
        </p>
      </div>

      {categories.map((category, idx) => (
        <div key={category}>
          {idx > 0 && <Separator />}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
            {INTEGRATIONS.filter((i) => i.category === category).map((integration) => {
              const cfg = STATUS_CONFIG[integration.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={integration.name}
                  className="rounded-lg border bg-card px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{integration.name}</span>
                        <Badge
                          variant={cfg.badge}
                          className={`text-xs ${integration.status === "connected" ? "text-emerald-600 border-emerald-300" : ""}`}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{integration.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {integration.envKeys.map((key) => (
                          <code
                            key={key}
                            className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
                          >
                            {key}
                          </code>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      asChild
                    >
                      <a href={integration.docUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        문서
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
