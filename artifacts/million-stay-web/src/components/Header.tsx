import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, User, LogOut, Home, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  function handleLogout() {
    logout();
    navigate("/");
    setMobileOpen(false);
  }

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
              M
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">
              MillionStay
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Find a Space
              </Button>
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/portal/bookings">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    My Bookings
                  </Button>
                </Link>
                <Link href="/portal/invoices">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Invoices
                  </Button>
                </Link>
                <Link href="/portal/profile">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <User className="w-4 h-4 mr-1.5" />
                    {user?.first_name ?? user?.email}
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={handleLogout} className="ml-1">
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-primary text-white hover:bg-primary/90">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t py-3 space-y-1 pb-4">
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                <Home className="w-4 h-4" /> Find a Space
              </div>
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/portal/bookings" onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                    <Calendar className="w-4 h-4" /> My Bookings
                  </div>
                </Link>
                <Link href="/portal/invoices" onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                    <FileText className="w-4 h-4" /> Invoices
                  </div>
                </Link>
                <Link href="/portal/profile" onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                    <User className="w-4 h-4" /> Profile
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium text-destructive w-full"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <div className="px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">Sign In</div>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <div className="px-3 py-2 rounded-md bg-primary text-white text-sm font-medium mx-3 text-center">
                    Get Started
                  </div>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
