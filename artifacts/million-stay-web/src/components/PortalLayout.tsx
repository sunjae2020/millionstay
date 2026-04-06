import { Link, useLocation } from "wouter";
import { Calendar, FileText, User, Home } from "lucide-react";

const NAV_ITEMS = [
  { href: "/portal/bookings", label: "My Bookings", icon: Calendar },
  { href: "/portal/invoices", label: "Invoices", icon: FileText },
  { href: "/portal/profile", label: "Profile", icon: User },
];

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden md:block w-52 shrink-0">
            <nav className="space-y-1 sticky top-20">
              <Link href="/">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-2">
                  <Home className="w-4 h-4" />
                  Browse Spaces
                </div>
              </Link>
              <div className="text-xs font-semibold text-muted-foreground px-3 py-1 uppercase tracking-wider">
                My Account
              </div>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = location === href;
                return (
                  <Link key={href} href={href}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
