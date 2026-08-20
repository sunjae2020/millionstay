import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DisplayCurrencyProvider } from "@/contexts/DisplayCurrencyContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Search from "@/pages/search";
import SpaceDetail from "@/pages/space-detail";
import Booking from "@/pages/booking";
import BookingNew from "@/pages/booking-new";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Portal from "@/pages/portal";
import PortalBookings from "@/pages/portal-bookings";
import PortalInvoices from "@/pages/portal-invoices";
import PortalReceipt from "@/pages/portal-receipt";
import PortalDocuments from "@/pages/portal-documents";
import PortalBookingDetail from "@/pages/portal-booking-detail";
import PortalProfile from "@/pages/portal-profile";
import PortalMyData from "@/pages/portal-my-data";
import PortalPayment from "@/pages/portal-payment";
import PortalCs from "@/pages/portal-cs";
import PortalCsNew from "@/pages/portal-cs-new";
import PortalCsDetail from "@/pages/portal-cs-detail";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import Contact from "@/pages/contact";
import StayPlan from "@/pages/stay-plan";
import ForStudent from "@/pages/for-student";
import ForAgent from "@/pages/for-agent";
import ForHomestayHost from "@/pages/for-homestay-host";
import ForShortTerm from "@/pages/for-short-term";
import HostLogin from "@/pages/host-login";
import HostPortal from "@/pages/host-portal";
import PortalLogin from "@/pages/portal-login";
import FAQ from "@/pages/faq";
import HouseRules from "@/pages/house-rules";
import PrivacyPolicy from "@/pages/privacy-policy";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminBookings from "@/pages/admin-bookings";
import AdminBookingDetail from "@/pages/admin-booking-detail";
import AdminGuests from "@/pages/admin-guests";
import AdminSpaces from "@/pages/admin-spaces";
import ChatWidget from "@/components/chat/ChatWidget";
import OwnerLanding from "@/pages/owner-landing";
import HomestayRouter from "@/pages/homestay/HomestayRouter";
import DevRouter from "@/pages/development/DevRouter";
import Sign from "@/pages/sign";
import InspectionSign from "@/pages/inspection-sign";
import WorkOrderSign from "@/pages/work-order-sign";
import PaymentResult from "@/pages/payment-result";
import { getApiBase } from "@/lib/api-base";
import { getOwnerSiteSlug } from "@/lib/owner-site";
import { isHomestaySubdomain } from "@/lib/homestay-site";
import { isDevelopmentSite } from "@/lib/site-mode";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
    },
  },
});

function Router() {
  // A single-building "development" instance (VITE_SITE_MODE=development, e.g.
  // Metheim) serves the 4-part Buy/Rent/Management site instead of the standard
  // marketplace. Its router mounts the shared booking/portal routes underneath.
  if (isDevelopmentSite()) return <DevRouter />;

  // homestay.millionstay.com is a dedicated site with its own shell + routes.
  if (isHomestaySubdomain()) return <HomestayRouter />;

  // On a tenant subdomain ({slug}.millionstay.com), the home route renders the
  // owner's one-page landing instead of the main site. All other routes
  // (/spaces/:id, /booking, …) keep working so detail + booking flows function.
  const ownerSlug = getOwnerSiteSlug();
  return (
    <Switch>
      <Route path="/">{ownerSlug ? <OwnerLanding slug={ownerSlug} /> : <Home />}</Route>
      <Route path="/sign/:token" component={Sign} />
      {/* 세대점검표 — tenant review & signature (token link, no login). */}
      <Route path="/inspection/:token" component={InspectionSign} />
      <Route path="/work-order/:token" component={WorkOrderSign} />
      <Route path="/search" component={Search} />
      <Route path="/spaces/:id" component={SpaceDetail} />
      <Route path="/booking/new" component={BookingNew} />
      <Route path="/booking/:spaceId" component={Booking} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/portal" component={Portal} />
      <Route path="/portal/bookings" component={PortalBookings} />
      <Route path="/portal/bookings/:id" component={PortalBookingDetail} />
      <Route path="/portal/invoices/:id/receipt" component={PortalReceipt} />
      <Route path="/portal/invoices" component={PortalInvoices} />
      <Route path="/portal/documents" component={PortalDocuments} />
      <Route path="/portal/profile" component={PortalProfile} />
      <Route path="/portal/my-data" component={PortalMyData} />
      <Route path="/portal/payment" component={PortalPayment} />
      <Route path="/portal/cs/new" component={PortalCsNew} />
      <Route path="/portal/cs/:id" component={PortalCsDetail} />
      <Route path="/portal/cs" component={PortalCs} />
      <Route path="/about" component={About} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/blog" component={Blog} />
      <Route path="/contact" component={Contact} />
      <Route path="/payment-result" component={PaymentResult} />
      <Route path="/stay-plan" component={StayPlan} />
      <Route path="/for-student" component={ForStudent} />
      <Route path="/for-agent" component={ForAgent} />
      <Route path="/for-homestay-host" component={ForHomestayHost} />
      <Route path="/for-short-term" component={ForShortTerm} />
      <Route path="/host-login" component={HostLogin} />
      <Route path="/host-portal" component={HostPortal} />
      <Route path="/portal-login" component={PortalLogin} />
      <Route path="/faq" component={FAQ} />
      <Route path="/house-rules" component={HouseRules} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/bookings/:id" component={AdminBookingDetail} />
      <Route path="/admin/bookings" component={AdminBookings} />
      <Route path="/admin/guests" component={AdminGuests} />
      <Route path="/admin/spaces" component={AdminSpaces} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Show the AI chat widget on public pages only (not the embedded admin UI),
 * and only when an admin has enabled it (toggle in Admin → Integrations).
 */
function ChatGate() {
  const [location] = useLocation();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${getApiBase()}/api/v1/public/chat/config`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((c) => { if (active) setEnabled(Boolean(c?.enabled)); })
      .catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, []);

  if (location.startsWith("/admin")) return null;
  if (enabled !== true) return null;
  return <ChatWidget />;
}

function AdminDomainRedirect() {
  useEffect(() => {
    if (window.location.hostname === "admin.millionstay.com") {
      window.location.replace(window.location.origin + "/admin");
    }
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DisplayCurrencyProvider>
        <TooltipProvider>
          <AdminDomainRedirect />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <ChatGate />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </DisplayCurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
