import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Building2, BookOpen, TrendingUp, LogOut, User, ChevronRight } from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/properties", icon: Building2, label: "My Properties" },
  { href: "/bookings", icon: BookOpen, label: "Occupancy" },
  { href: "/revenue", icon: TrendingUp, label: "Revenue" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div>
              <div className="font-bold text-sm text-white">MillionStay</div>
              <div className="text-xs text-sidebar-accent-foreground">Owner Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <User className="w-4 h-4 text-sidebar-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="text-xs text-sidebar-accent-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
