import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Building2,
  Settings,
  Tag,
  Layers,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const propertySubNav = [
  { href: "/property/suburbs", label: "Suburbs", icon: MapPin },
  { href: "/property/properties", label: "Properties", icon: Building2 },
  { href: "/property/space-options", label: "Space Options", icon: Tag },
  { href: "/property/space-policies", label: "Space Policies", icon: Settings },
  { href: "/property/spaces", label: "Spaces", icon: Layers },
];

function NavItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const [location] = useLocation();
  const active = location === href || location.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-white/15 text-white"
          : "text-white/70 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

function SectionToggle({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="flex items-center gap-1 w-full px-3 py-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
      </button>
      {open && <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">PropertyAdmin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
          </div>

          <SectionToggle label="Property">
            {propertySubNav.map((item) => (
              <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
          </SectionToggle>
        </nav>

        {/* Footer */}
        <div className="h-12 flex items-center px-4 border-t border-sidebar-border">
          <span className="text-xs text-white/40">Property Module v1.0</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
