import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useBrand } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/hooks/useModules";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/appName";
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
  ChevronsLeft,
  ChevronsRight,
  User,
  Briefcase,
  CheckSquare,
  TrendingUp,
  Building,
  Layers,
  MapPin,
  CalendarDays,
  FileText,
  FileSignature,
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
  MailCheck,
  ScrollText,
  KeyRound,
  BarChart3,
  Palette,
  Plug,
  LogOut,
  Menu,
  X,
  ConciergeBell,
  HeadphonesIcon,
  Globe,
  Wrench,
  Home,
  DollarSign,
  Newspaper,
  Languages,
  Sun,
  Moon,
  Bot,
  BookOpen,
  MessagesSquare,
  Sparkles,
  GraduationCap,
  Handshake,
  Images,
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

// Nav hrefs belonging to the Homestay intake module. Hidden when the tenant
// has the module disabled (see useModules / HOMESTAY_MODULE_ENABLED).
const HOMESTAY_NAV_HREFS = new Set([
  "/account/homestay-applications",
  "/account/homestay-student-requests",
  "/account/homestay-placements",
]);

function getNav(
  t: (k: string) => string,
  opts?: { homestayEnabled?: boolean },
): NavSection[] {
  const homestayEnabled = opts?.homestayEnabled ?? true;
  const sections: NavSection[] = [
    {
      label: t("nav.account"),
      icon: Users,
      defaultOpen: true,
      items: [
        { href: "/account/contacts", label: t("nav.contact"), icon: User },
        { href: "/account/accounts", label: t("nav.account"), icon: Briefcase },
        { href: "/account/tenant-lifecycle", label: t("nav.tenant_lifecycle"), icon: Home },
        { href: "/account/leads", label: t("nav.lead"), icon: TrendingUp },
        { href: "/account/homestay-applications", label: t("nav.homestay_applications"), icon: Home },
        { href: "/account/homestay-student-requests", label: t("nav.homestay_student_requests"), icon: GraduationCap },
        { href: "/account/homestay-placements", label: t("nav.homestay_placements"), icon: Handshake },
        { href: "/account/tasks", label: t("nav.task"), icon: CheckSquare },
      ],
    },
    {
      label: t("nav.cs"),
      icon: HeadphonesIcon,
      defaultOpen: false,
      items: [
        { href: "/cs/tickets", label: t("nav.cs_tickets"), icon: HeadphonesIcon },
      ],
    },
    {
      label: t("nav.property"),
      icon: Building2,
      defaultOpen: true,
      items: [
        { href: "/property/properties", label: t("nav.property"), icon: Building2 },
        { href: "/property/spaces", label: t("nav.space"), icon: Layers },
        { href: "/property/space-options", label: t("nav.space_options"), icon: Tag },
        { href: "/property/space-policies", label: t("nav.space_policy"), icon: FileText },
        { href: "/property/bulk-photo-upload", label: t("nav.bulk_photo"), icon: ImagePlus },
      ],
    },
    {
      label: t("nav.booking_contract"),
      icon: CalendarCheck,
      defaultOpen: false,
      items: [
        { href: "/calendar", label: t("nav.calendar"), icon: CalendarDays },
        { href: "/booking/bookings", label: t("nav.booking"), icon: CalendarDays },
        { href: "/booking/contracts", label: t("nav.contract"), icon: FileText },
        { href: "/booking/service-hosts", label: t("nav.service_host"), icon: Users },
        { href: "/maintenance/work-orders", label: t("nav.work_order"), icon: Wrench },
      ],
    },
    {
      label: t("nav.products"),
      icon: Package,
      defaultOpen: false,
      items: [
        { href: "/products/products", label: t("nav.accommodation"), icon: Package },
        { href: "/services", label: t("nav.service_product"), icon: ConciergeBell },
        { href: "/products/promotions", label: t("nav.promotion"), icon: Tag },
        { href: "/products/beneficiaries", label: t("nav.beneficiary"), icon: Users },
      ],
    },
    {
      label: t("nav.documents"),
      icon: FileText,
      defaultOpen: false,
      items: [
        { href: "/documents", label: t("nav.all_documents"), icon: FileText },
        { href: "/documents/quotes", label: t("nav.quotes"), icon: FileText },
        { href: "/finance/invoices", label: t("nav.invoice"), icon: Receipt },
        { href: "/finance/receipts", label: t("nav.receipt"), icon: Receipt },
        { href: "/booking/contracts", label: t("nav.contract"), icon: FileSignature },
        { href: "/settings/document-templates", label: t("nav.document_templates"), icon: FileText },
        { href: "/settings/homestay-billing", label: t("nav.homestay_billing"), icon: CreditCard },
      ],
    },
    {
      label: t("nav.finance"),
      icon: CreditCard,
      defaultOpen: false,
      items: [
        { href: "/finance/invoices", label: t("nav.invoice"), icon: Receipt },
        { href: "/finance/transactions", label: t("nav.transaction"), icon: ArrowRightLeft },
        { href: "/finance/receipts", label: t("nav.receipt"), icon: Receipt },
        { href: "/finance/commissions", label: t("nav.commission"), icon: Percent },
        { href: "/finance/recurring", label: t("nav.recurring"), icon: RefreshCw },
        { href: "/finance/exchange-rates", label: t("nav.exchange_rates"), icon: DollarSign },
        { href: "/finance/journal", label: t("nav.journal"), icon: BookOpen },
      ],
    },
    {
      label: t("nav.content"),
      icon: Newspaper,
      defaultOpen: true,
      items: [
        { href: "/content/blog", label: t("nav.blog_posts"), icon: Newspaper },
        { href: "/content/blog-categories", label: t("nav.blog_categories"), icon: Tag },
        { href: "/content/listings", label: t("nav.sale_listings"), icon: Building2 },
        { href: "/content/pages", label: t("nav.website_pages"), icon: Globe },
        { href: "/content/media", label: t("nav.media_library"), icon: Images },
        { href: "/content/page-translations", label: t("nav.page_translations"), icon: Languages },
      ],
    },
    {
      label: t("nav.ai_assistant"),
      icon: Bot,
      defaultOpen: true,
      items: [
        { href: "/ai/widget", label: t("nav.chat_widget"), icon: Sparkles },
        { href: "/ai/knowledge", label: t("nav.knowledge_base"), icon: BookOpen },
        { href: "/ai/conversations", label: t("nav.conversations"), icon: MessagesSquare },
      ],
    },
    {
      label: t("nav.settings"),
      icon: Settings,
      defaultOpen: false,
      items: [
        { href: "/settings/organisation", label: t("nav.organisation"), icon: Building },
        { href: "/settings/users", label: t("nav.users"), icon: UserCog },
        { href: "/settings/contract-types", label: t("nav.contract_types"), icon: FileText },
        { href: "/settings/product-groups", label: t("nav.product_groups"), icon: Layers },
        { href: "/settings/product-types", label: t("nav.product_types"), icon: Tag },
        { href: "/settings/payment-info", label: t("nav.payment_info"), icon: Landmark },
        { href: "/settings/cost-center", label: t("nav.cost_center"), icon: Wallet },
        { href: "/settings/suburbs", label: t("nav.suburb"), icon: MapPin },
        { href: "/settings/document-templates", label: t("nav.document_templates"), icon: FileText },
        { href: "/settings/homestay-billing", label: t("nav.homestay_billing"), icon: CreditCard },
        { href: "/settings/application-emails", label: t("nav.application_emails"), icon: MailCheck },
        { href: "/settings/translations", label: t("nav.languages"), icon: Languages },
        { href: "/settings/integrations", label: t("nav.integrations"), icon: Plug },
        { href: "/settings/api-keys", label: t("nav.api_keys"), icon: KeyRound },
        { href: "/settings/system-log", label: t("nav.system_log"), icon: ScrollText },
        { href: "/settings/design", label: t("nav.design"), icon: Palette },
        {
          href: "/settings/reports",
          label: t("nav.reports"),
          icon: BarChart3,
          children: [
            { href: "/settings/reports/bookings", label: t("nav.booking_report"), icon: BarChart3 },
            { href: "/settings/reports/revenue", label: t("nav.revenue_report"), icon: BarChart3 },
            { href: "/settings/reports/occupancy", label: t("nav.occupancy_report"), icon: BarChart3 },
          ],
        },
      ],
    },
  ];

  if (!homestayEnabled) {
    return sections.map((s) => ({
      ...s,
      items: s.items.filter((i) => !HOMESTAY_NAV_HREFS.has(i.href)),
    }));
  }
  return sections;
}

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
        "flex items-center gap-2 rounded-md text-xs font-medium transition-colors",
        indent ? "py-1.5 ml-6 pl-4 pr-3" : "py-1.5 pl-5 pr-3",
        active
          ? "bg-sidebar-primary/10 text-sidebar-primary font-semibold"
          : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent"
      )}
    >
      <Icon className={cn("h-3 w-3 flex-shrink-0", active && "text-sidebar-primary")} />
      {label}
      {active && (
        <span className="ml-auto w-1 h-1 rounded-full bg-sidebar-primary flex-shrink-0" />
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
          "flex items-center gap-2 w-full py-1.5 pl-5 pr-3 rounded-md text-xs font-medium transition-colors",
          selfActive || anyChildActive
            ? "bg-sidebar-primary/10 text-sidebar-primary"
            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent"
        )}
      >
        <item.icon className="h-3 w-3 flex-shrink-0" />
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
          "flex items-center gap-1.5 w-full px-2 py-1.5 text-sm font-semibold uppercase tracking-wider transition-colors",
          anyActive
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
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

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "th", label: "ภาษาไทย" },
  { code: "vi", label: "Tiếng Việt" },
];

function HeaderLanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function changeLang(code: string) {
    i18n.changeLanguage(code);
    try { localStorage.setItem("ms_admin_language", code); } catch {}
    setOpen(false);
  }

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{current.label}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[130px]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLang(l.code)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                l.code === i18n.language ? "font-semibold text-primary" : "text-foreground"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LanguageSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function changeLang(code: string) {
    i18n.changeLanguage(code);
    try { localStorage.setItem("ms_admin_language", code); } catch {}
    setOpen(false);
  }

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  if (collapsed) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          title={current.label}
          className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <Globe className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[120px]">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                  l.code === i18n.language ? "font-semibold text-primary" : "text-foreground"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full px-1 py-1 rounded text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        <Globe className="h-3 w-3 flex-shrink-0" />
        <span>{current.label}</span>
        <ChevronDown className={cn("h-2.5 w-2.5 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 w-full">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLang(l.code)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                l.code === i18n.language ? "font-semibold text-primary" : "text-foreground"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <div className="border-t border-sidebar-border px-2 py-2 flex flex-col items-center gap-1">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center" title={user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email : "Admin"}>
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <button
          onClick={logout}
          className="flex-shrink-0 p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          title={t("nav.logout")}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
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
          title={t("nav.logout")}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SidebarLogo({
  logo,
  brandName,
  collapsed,
  onToggle,
}: {
  logo?: string | null;
  brandName: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (collapsed) {
    return (
      <div className="h-14 flex items-center justify-center border-b border-sidebar-border flex-shrink-0">
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="hidden md:flex h-7 w-7 items-center justify-center rounded text-sidebar-foreground/50 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-14 flex items-center px-3 border-b border-sidebar-border flex-shrink-0 gap-2">
      {/* MillionStay logo (falls back to brand logo if one is configured) */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {import.meta.env.VITE_LOGO_MODE === "text" && !logo
          ? <span className="font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap">{APP_NAME}</span>
          : <img
              src={logo ?? `${import.meta.env.BASE_URL}millionstay-logo.png`}
              alt={brandName}
              className="max-h-[2.625rem] max-w-[225px] object-contain"
            />}
      </div>
      {/* Collapse button — desktop only */}
      <button
        onClick={onToggle}
        title="Collapse sidebar"
        className="hidden md:flex flex-shrink-0 h-6 w-6 rounded items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
      >
        <ChevronsLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

const COLLAPSED_KEY = "ms_sidebar_collapsed";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logo, logoDark, brandName, darkMode, toggleDarkMode } = useBrand();
  const effectiveLogo = darkMode && logoDark ? logoDark : logo;
  const { t } = useTranslation();
  const { homestayEnabled } = useModules();
  const NAV = getNav(t, { homestayEnabled });
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
            logo={effectiveLogo}
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
          "flex-1 overflow-y-auto scrollbar-hide py-3 flex flex-col gap-3",
          collapsed ? "px-1 items-center" : "px-2"
        )}>
          {/* Dashboards */}
          <div className={cn("flex flex-col gap-0.5", collapsed && "w-full items-center")}>
            {collapsed ? (
              <Link
                href="/dashboard"
                title={t("nav.dashboard")}
                className={cn(
                  "flex items-center rounded-md text-xs font-medium transition-colors justify-center w-9 h-9 mx-auto",
                  ["/", "/dashboard", "/dashboard/reservations", "/dashboard/finance", "/dashboard/operations"].includes(location)
                    ? "bg-sidebar-primary/10 text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent"
                )}
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              </Link>
            ) : (
              <>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Dashboards</p>
                {(() => {
                  const onDashboard = location === "/" || location === "/dashboard";
                  return (
                    <Link
                      href="/dashboard"
                      className={cn(
                        "flex items-center gap-2 rounded-md text-xs font-medium transition-colors py-1.5 pl-5 pr-3",
                        onDashboard
                          ? "bg-sidebar-primary/10 text-sidebar-primary font-semibold"
                          : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent"
                      )}
                    >
                      <LayoutDashboard className="h-3 w-3 flex-shrink-0" />
                      {t("nav.dashboard")}
                    </Link>
                  );
                })()}
              </>
            )}
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
        {/* Top bar */}
        <header className="h-14 flex items-center gap-3 px-4 border-b bg-card flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/70 hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile brand — MillionStay logo */}
          {import.meta.env.VITE_LOGO_MODE === "text" && !effectiveLogo
            ? <span className="font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap md:hidden">{APP_NAME}</span>
            : <img
                src={effectiveLogo ?? `${import.meta.env.BASE_URL}millionstay-logo.png`}
                alt={brandName}
                className="max-h-[2.625rem] max-w-[210px] object-contain md:hidden"
              />}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Language switcher — always visible, top right */}
          <HeaderLanguageSwitcher />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
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
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2 sm:gap-0 border-b bg-card">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
