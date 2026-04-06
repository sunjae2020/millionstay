import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import {
  LayoutDashboard, CalendarCheck, Users, Home, LogOut, ChevronRight,
} from "lucide-react";

const ADMIN_KEY = "ms_admin_key";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/guests", label: "Guests", icon: Users },
  { href: "/admin/spaces", label: "Spaces", icon: Home },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!localStorage.getItem(ADMIN_KEY)) {
      setLocation("/admin");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_KEY);
    setLocation("/admin");
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 bg-white border-r flex flex-col">
        <div className="px-5 py-5 border-b">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-primary font-extrabold text-xl tracking-tight">MILLION</span>
          </Link>
          <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100"
                }`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {active && <ChevronRight className="h-3 w-3 ml-auto" />}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
