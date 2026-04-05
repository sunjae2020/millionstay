import { Link, useLocation } from "wouter";
import { useBrand } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Package,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronRight,
  User,
  Briefcase,
  CheckSquare,
  TrendingUp,
  Building,
  Layers,
  MapPin,
  CalendarDays,
  FileText,
  Box,
  Tag,
  Receipt,
  ArrowRightLeft,
  RefreshCw,
  Percent,
  ImagePlus,
  UserCog,
  Landmark,
  Wallet,
  Mail,
  ScrollText,
  BarChart3,
  Palette,
  Plug,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";

type NavChild = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavChild[];
};

type NavSection = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavChild[];
  defaultOpen?: boolean;
};

const NAV: NavSection[] = [
  {
    label: "Account",
    icon: Users,
    defaultOpen: true,
    items: [
      { href: "/account/contacts", label: "Contact", icon: User },
      { href: "/account/accounts", label: "Account", icon: Briefcase },
      { href: "/account/leads", label: "Lead", icon: TrendingUp },
      { href: "/account/tasks", label: "Task", icon: CheckSquare },
    ],
  },
  {
    label: "Property",
    icon: Building2,
    defaultOpen: true,
    items: [
      { href: "/property/properties", label: "Property", icon: Building2 },
      { href: "/property/spaces", label: "Space", icon: Layers },
      { href: "/property/space-options", label: "Space Options", icon: Tag },
      { href: "/property/space-policies", label: "Space Policy", icon: FileText },
      { href: "/property/bulk-photo-upload", label: "Bulk Photo Upload", icon: ImagePlus },
    ],
  },
  {
    label: "Booking",
    icon: CalendarCheck,
    defaultOpen: false,
    items: [
      { href: "/booking/bookings", label: "Booking", icon: CalendarDays },
      { href: "/booking/contracts", label: "Contract", icon: FileText },
      { href: "/booking/contract-products", label: "Contract Product", icon: Box },
      { href: "/booking/service-hosts", label: "Service Host", icon: Users },
    ],
  },
  {
    label: "Products",
    icon: Package,
    defaultOpen: false,
    items: [
      { href: "/products/products", label: "Product", icon: Package },
      { href: "/products/promotions", label: "Promotion", icon: Tag },
      { href: "/products/beneficiaries", label: "Beneficiary", icon: Users },
    ],
  },
  {
    label: "Finance",
    icon: CreditCard,
    defaultOpen: false,
    items: [
      { href: "/finance/invoices", label: "Invoice", icon: Receipt },
      { href: "/finance/transactions", label: "Transaction", icon: ArrowRightLeft },
      { href: "/finance/receipts", label: "Receipt", icon: Receipt },
      { href: "/finance/commissions", label: "Commission", icon: Percent },
      { href: "/finance/recurring", label: "Recurring", icon: RefreshCw },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    defaultOpen: false,
    items: [
      { href: "/settings/organisation", label: "Organisation", icon: Building },
      { href: "/settings/users", label: "Users", icon: UserCog },
      { href: "/settings/contract-types", label: "Contract Types", icon: FileText },
      { href: "/settings/product-groups", label: "Product Groups", icon: Layers },
      { href: "/settings/product-types", label: "Product Types", icon: Tag },
      { href: "/settings/payment-info", label: "Payment Info", icon: Landmark },
      { href: "/settings/cost-center", label: "Cost Center", icon: Wallet },
      { href: "/settings/suburbs", label: "Suburb", icon: MapPin },
      { href: "/settings/email-templates", label: "Email Templates", icon: Mail },
      { href: "/settings/integrations", label: "Integrations", icon: Plug },
      { href: "/settings/system-log", label: "System Log", icon: ScrollText },
      { href: "/settings/design", label: "Design & Branding", icon: Palette },
      {
        href: "/settings/reports",
        label: "Reports",
        icon: BarChart3,
        children: [
          { href: "/settings/reports/bookings", label: "Booking Report", icon: BarChart3 },
          { href: "/settings/reports/revenue", label: "Revenue Report", icon: BarChart3 },
          { href: "/settings/reports/occupancy", label: "Occupancy Report", icon: BarChart3 },
        ],
      },
    ],
  },
];

function NavLeaf({
  href,
  icon: Icon,
  label,
  indent = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  indent?: boolean;
}) {
  const [location] = useLocation();
  const active = location === href || location.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
        indent ? "px-3 py-1.5 ml-4 pl-5" : "px-3 py-2",
        active
          ? "bg-sidebar-primary/20 text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {label}
    </Link>
  );
}

function NavItemWithChildren({ item }: { item: NavChild }) {
  const [location] = useLocation();
  const anyChildActive = item.children?.some(
    (c) => location === c.href || location.startsWith(c.href + "/")
  );
  const [open, setOpen] = useState(!!anyChildActive);
  const selfActive = location === item.href || location.startsWith(item.href + "/");

  useEffect(() => {
    if (anyChildActive) setOpen(true);
  }, [anyChildActive]);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
          selfActive || anyChildActive
            ? "bg-sidebar-primary/20 text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 opacity-60" />
        ) : (
          <ChevronRight className="h-3 w-3 opacity-60" />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {item.children?.map((child) => (
            <NavLeaf key={child.href} href={child.href} icon={child.icon} label={child.label} indent />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionToggle({
  section,
}: {
  section: NavSection;
}) {
  const [location] = useLocation();
  const anyActive = section.items.some(
    (item) =>
      location === item.href ||
      location.startsWith(item.href + "/") ||
      item.children?.some((c) => location === c.href || location.startsWith(c.href + "/"))
  );
  const [open, setOpen] = useState(section.defaultOpen ?? anyActive);

  // Auto-open when any child route becomes active
  useEffect(() => {
    if (anyActive) setOpen(true);
  }, [anyActive]);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider hover:text-sidebar-foreground/60 transition-colors"
        onClick={() => {
          // Don't allow closing a section that has an active child
          if (anyActive && open) return;
          setOpen((o) => !o);
        }}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <section.icon className="h-3 w-3" />
        {section.label}
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {section.items.map((item) =>
            item.children ? (
              <NavItemWithChildren key={item.href} item={item} />
            ) : (
              <NavLeaf key={item.href} href={item.href} icon={item.icon} label={item.label} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();
  return (
    <div className="border-t border-sidebar-border px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-sidebar-foreground truncate">
            {user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email : "Admin"}
          </p>
          <p className="text-[10px] text-sidebar-foreground/40 truncate">{user?.role ?? ""}</p>
        </div>
        <button
          onClick={logout}
          className="flex-shrink-0 p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[10px] text-sidebar-foreground/30 pl-9">MillionStay Admin v2</p>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logo, brandName } = useBrand();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          {logo ? (
            <img
              src={logo}
              alt={brandName}
              className="max-h-8 max-w-[160px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-sidebar-foreground font-semibold text-sm">{brandName}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-3">
          {/* Dashboard */}
          <div className="flex flex-col gap-0.5">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === "/" || location === "/dashboard"
                  ? "bg-sidebar-primary/20 text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              Dashboard
            </Link>
          </div>

          {/* All sections */}
          {NAV.map((section) => (
            <SectionToggle key={section.label} section={section} />
          ))}
        </nav>

        {/* Footer */}
        <SidebarFooter />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
      <div>
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
