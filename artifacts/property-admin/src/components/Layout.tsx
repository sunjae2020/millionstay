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
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

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
  collapsed = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  indent?: boolean;
  collapsed?: boolean;
}) {
  const [location] = useLocation();
  const active = location === href || location.startsWith(href + "/");
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [active]);

  if (collapsed) {
    return (
      <Link
        ref={ref}
        href={href}
        title={label}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-md mx-auto transition-colors",
          active
            ? "bg-sidebar-primary/20 text-sidebar-primary"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
        indent ? "px-3 py-1.5 ml-4 pl-5" : "px-3 py-2",
        active
          ? "bg-sidebar-primary/20 text-sidebar-primary font-semibold"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", active && "text-sidebar-primary")} />
      {label}
      {active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary flex-shrink-0" />
      )}
    </Link>
  );
}

function NavItemWithChildren({ item, collapsed }: { item: NavChild; collapsed?: boolean }) {
  const [location] = useLocation();
  const anyChildActive = item.children?.some(
    (c) => location === c.href || location.startsWith(c.href + "/")
  );
  const [open, setOpen] = useState(!!anyChildActive);
  const selfActive = location === item.href || location.startsWith(item.href + "/");

  useEffect(() => {
    if (anyChildActive) setOpen(true);
  }, [anyChildActive]);

  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.label}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-md mx-auto transition-colors",
          selfActive || anyChildActive
            ? "bg-sidebar-primary/20 text-sidebar-primary"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <item.icon className="h-4 w-4" />
      </Link>
    );
  }

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
  collapsed,
}: {
  section: NavSection;
  collapsed?: boolean;
}) {
  const [location] = useLocation();
  const anyActive = section.items.some(
    (item) =>
      location === item.href ||
      location.startsWith(item.href + "/") ||
      item.children?.some((c) => location === c.href || location.startsWith(c.href + "/"))
  );

  const [open, setOpen] = useState(anyActive || !!section.defaultOpen);

  useEffect(() => {
    if (anyActive) setOpen(true);
  }, [anyActive]);

  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5 items-center">
        {/* Section icon as divider/header */}
        <div
          className={cn(
            "flex items-center justify-center w-9 h-6 rounded mx-auto",
            anyActive ? "text-sidebar-primary/70" : "text-sidebar-foreground/30"
          )}
          title={section.label}
        >
          <section.icon className="h-3 w-3" />
        </div>
        {/* Show all items as icon buttons */}
        {section.items.map((item) =>
          item.children ? (
            <NavItemWithChildren key={item.href} item={item} collapsed />
          ) : (
            <NavLeaf key={item.href} href={item.href} icon={item.icon} label={item.label} collapsed />
          )
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
          anyActive
            ? "text-sidebar-primary/80"
            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
        )}
        onClick={() => {
          if (anyActive && open) return;
          setOpen((o) => !o);
        }}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <section.icon className="h-3 w-3" />
        {section.label}
        {anyActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary flex-shrink-0" />}
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

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  const { user, logout } = useAuth();

  if (collapsed) {
    return (
      <div className="border-t border-sidebar-border px-2 py-2 flex flex-col items-center gap-1">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center" title={user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email : "Admin"}>
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <button
          onClick={logout}
          className="flex-shrink-0 p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

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

function TriangleLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} fill="currentColor">
      <polygon points="8,1 1.5,5 8,9" />
    </svg>
  );
}

function TriangleRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} fill="currentColor">
      <polygon points="2,1 8.5,5 2,9" />
    </svg>
  );
}

function SidebarLogo({
  logo,
  brandName,
  collapsed,
  onToggle,
}: {
  logo?: string;
  brandName: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (collapsed) {
    return (
      <div className="h-14 flex items-center justify-center border-b border-sidebar-border flex-shrink-0 relative">
        {/* Always show favicon symbol (building icon) when collapsed */}
        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        {/* Expand triangle — inside right edge */}
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 h-5 w-5 rounded-full bg-sidebar-accent border border-sidebar-border items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-primary hover:border-sidebar-primary transition-colors"
        >
          <TriangleRight className="h-2.5 w-2.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-14 flex items-center px-3 border-b border-sidebar-border flex-shrink-0 gap-2">
      {/* Logo or icon+name */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {logo ? (
          <img src={logo} alt={brandName} className="max-h-8 max-w-[130px] object-contain" />
        ) : (
          <>
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sidebar-foreground font-semibold text-sm truncate">{brandName}</span>
          </>
        )}
      </div>
      {/* Collapse triangle button — desktop only */}
      <button
        onClick={onToggle}
        title="Collapse sidebar"
        className="hidden md:flex flex-shrink-0 h-6 w-6 rounded items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
      >
        <TriangleLeft className="h-3 w-3" />
      </button>
    </div>
  );
}

const COLLAPSED_KEY = "ms_sidebar_collapsed";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logo, brandName } = useBrand();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  };

  /* Auto-close sidebar on route change (mobile) */
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  /* Prevent body scroll when sidebar is open on mobile */
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Mobile backdrop ───────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar flex flex-col overflow-hidden",
          "transition-all duration-200 ease-in-out",
          "md:static md:z-auto md:flex-shrink-0 md:translate-x-0 md:opacity-100 md:visible md:pointer-events-auto",
          /* Mobile: always full width when open */
          "w-56",
          /* Desktop: collapsed = narrow, expanded = w-56 */
          collapsed ? "md:w-14" : "md:w-56",
          sidebarOpen
            ? "translate-x-0 opacity-100 visible pointer-events-auto"
            : "-translate-x-full opacity-0 invisible pointer-events-none"
        )}
      >
        {/* Logo + collapse toggle */}
        <div className="relative flex-shrink-0">
          <SidebarLogo
            logo={logo}
            brandName={brandName}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
          />
          {/* Mobile close button */}
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto py-3 flex flex-col gap-3",
          collapsed ? "px-1 items-center" : "px-2"
        )}>
          {/* Dashboard */}
          <div className={cn("flex flex-col gap-0.5", collapsed && "w-full items-center")}>
            <Link
              href="/"
              title={collapsed ? "Dashboard" : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed
                  ? "justify-center w-9 h-9 mx-auto"
                  : "gap-2.5 px-3 py-2",
                location === "/" || location === "/dashboard"
                  ? "bg-sidebar-primary/20 text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <LayoutDashboard className={cn("flex-shrink-0", collapsed ? "h-4 w-4" : "h-4 w-4")} />
              {!collapsed && "Dashboard"}
            </Link>
          </div>

          {/* All sections */}
          {NAV.map((section) => (
            <SectionToggle key={section.label} section={section} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <SidebarFooter collapsed={collapsed} />
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar (hidden on md+) */}
        <header className="h-14 flex items-center gap-3 px-4 border-b bg-card flex-shrink-0 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {logo ? (
            <img
              src={logo}
              alt={brandName}
              className="max-h-7 max-w-[130px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-sm truncate">{brandName}</span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
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
