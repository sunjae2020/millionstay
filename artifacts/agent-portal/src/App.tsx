import { Switch, Route, Router as WouterRouter } from "wouter";
import { AuthProvider, useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import BookingsPage from "@/pages/BookingsPage";
import BookingDetailPage from "@/pages/BookingDetailPage";
import PropertiesPage from "@/pages/PropertiesPage";
import CommissionPage from "@/pages/CommissionPage";

function PortalRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user || user.portal_type !== "agent") {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/bookings" component={BookingsPage} />
      <Route path="/bookings/:id" component={BookingDetailPage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/commission" component={CommissionPage} />
      <Route>
        <div className="p-8 text-muted-foreground">Page not found</div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <PortalRoutes />
      </WouterRouter>
    </AuthProvider>
  );
}
