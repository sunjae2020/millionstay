import { useState } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { cn } from "@/lib/utils";
import {
  Settings2,
  Building2,
  Palette,
  Users,
  Bell,
  Mail,
  CreditCard,
  Shield,
  Globe,
} from "lucide-react";
import { CompanyInfo } from "./sections/CompanyInfo";
import { Design } from "./sections/Design";
import { UserManagement } from "./sections/UserManagement";
import { Notifications } from "./sections/Notifications";
import { Email } from "./sections/Email";
import { Payments } from "./sections/Payments";
import { Security } from "./sections/Security";
import { Integrations } from "./sections/Integrations";

const SECTIONS = [
  { key: "company", label: "회사 정보", icon: Building2, component: CompanyInfo },
  { key: "design", label: "디자인", icon: Palette, component: Design },
  { key: "users", label: "사용자 관리", icon: Users, component: UserManagement },
  { key: "notifications", label: "알림", icon: Bell, component: Notifications },
  { key: "email", label: "이메일", icon: Mail, component: Email },
  { key: "payments", label: "결제", icon: CreditCard, component: Payments },
  { key: "security", label: "보안", icon: Shield, component: Security },
  { key: "integrations", label: "연동", icon: Globe, component: Integrations },
];

export default function Settings() {
  const [active, setActive] = useState("company");
  const current = SECTIONS.find((s) => s.key === active)!;
  const ActiveComponent = current.component;

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Settings2 className="h-5 w-5" />
            Settings
          </>
        }
        subtitle="시스템 설정 및 환경 구성"
      />

      <div className="flex h-[calc(100vh-65px)]">
        {/* Left nav */}
        <aside className="w-52 shrink-0 border-r bg-muted/20 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-left transition-colors",
                active === key
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        {/* Right content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl px-8 py-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <current.icon className="h-5 w-5 text-muted-foreground" />
                {current.label}
              </h2>
              <div className="h-px bg-border mt-4" />
            </div>
            <ActiveComponent />
          </div>
        </main>
      </div>
    </Layout>
  );
}
