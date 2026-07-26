import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ServiceHostApplicationPage from "@/pages/ServiceHostApplicationPage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import JobDetailPage from "@/pages/JobDetailPage";
import WorkOrdersPage from "@/pages/WorkOrdersPage";
import SchedulePage from "@/pages/SchedulePage";
import EarningsPage from "@/pages/EarningsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import SupportPage from "@/pages/SupportPage";
import SupportDetailPage from "@/pages/SupportDetailPage";

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
    return (
      <Switch>
        <Route path="/apply" component={ServiceHostApplicationPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/jobs/:id" component={JobDetailPage} />
      <Route path="/work-orders" component={WorkOrdersPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/earnings" component={EarningsPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/support/:id" component={SupportDetailPage} />
      <Route>
        <div className="p-8 text-muted-foreground">Page not found</div>
      </Route>
    </Switch>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <PortalRoutes />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
