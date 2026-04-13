import { Switch, Route, Router as WouterRouter } from "wouter";
import { AuthProvider, useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import SchedulePage from "@/pages/SchedulePage";
import EarningsPage from "@/pages/EarningsPage";

function PortalRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user || user.portal_type !== "service_host") {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/earnings" component={EarningsPage} />
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
