import { Switch, Route, Router as WouterRouter } from "wouter";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import OwnerApplicationPage from "@/pages/OwnerApplicationPage";
import DashboardPage from "@/pages/DashboardPage";
import PropertiesPage from "@/pages/PropertiesPage";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import BookingsPage from "@/pages/BookingsPage";
import RevenuePage from "@/pages/RevenuePage";
import DocumentsPage from "@/pages/DocumentsPage";
import SitePage from "@/pages/SitePage";
import InquiriesPage from "@/pages/InquiriesPage";
import SupportPage from "@/pages/SupportPage";
import SupportDetailPage from "@/pages/SupportDetailPage";
import SecurityPage from "@/pages/SecurityPage";
import { OWNER_SITE_ENABLED } from "@/lib/flags";

function PortalRoutes() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user || user.portal_type !== "owner") {
    return (
      <Switch>
        <Route path="/apply" component={OwnerApplicationPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/properties/:id" component={PropertyDetailPage} />
      <Route path="/bookings" component={BookingsPage} />
      <Route path="/revenue" component={RevenuePage} />
      <Route path="/documents" component={DocumentsPage} />
      {OWNER_SITE_ENABLED && <Route path="/site" component={SitePage} />}
      {OWNER_SITE_ENABLED && <Route path="/inquiries" component={InquiriesPage} />}
      <Route path="/support" component={SupportPage} />
      <Route path="/support/:id" component={SupportDetailPage} />
      <Route path="/security" component={SecurityPage} />
      <Route>
        <div className="p-8 text-muted-foreground">{t("common.page_not_found")}</div>
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
