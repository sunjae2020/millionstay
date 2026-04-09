import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Search from "@/pages/search";
import SpaceDetail from "@/pages/space-detail";
import Booking from "@/pages/booking";
import BookingNew from "@/pages/booking-new";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Portal from "@/pages/portal";
import PortalBookings from "@/pages/portal-bookings";
import PortalInvoices from "@/pages/portal-invoices";
import PortalDocuments from "@/pages/portal-documents";
import PortalBookingDetail from "@/pages/portal-booking-detail";
import PortalProfile from "@/pages/portal-profile";
import PortalPayment from "@/pages/portal-payment";
import PortalCs from "@/pages/portal-cs";
import PortalCsNew from "@/pages/portal-cs-new";
import PortalCsDetail from "@/pages/portal-cs-detail";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import StayPlan from "@/pages/stay-plan";
import ForStudent from "@/pages/for-student";
import ForAgent from "@/pages/for-agent";
import FAQ from "@/pages/faq";
import HouseRules from "@/pages/house-rules";
import PrivacyPolicy from "@/pages/privacy-policy";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminBookings from "@/pages/admin-bookings";
import AdminBookingDetail from "@/pages/admin-booking-detail";
import AdminGuests from "@/pages/admin-guests";
import AdminSpaces from "@/pages/admin-spaces";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/spaces/:id" component={SpaceDetail} />
      <Route path="/booking/new" component={BookingNew} />
      <Route path="/booking/:spaceId" component={Booking} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/portal" component={Portal} />
      <Route path="/portal/bookings" component={PortalBookings} />
      <Route path="/portal/bookings/:id" component={PortalBookingDetail} />
      <Route path="/portal/invoices" component={PortalInvoices} />
      <Route path="/portal/documents" component={PortalDocuments} />
      <Route path="/portal/profile" component={PortalProfile} />
      <Route path="/portal/payment" component={PortalPayment} />
      <Route path="/portal/cs/new" component={PortalCsNew} />
      <Route path="/portal/cs/:id" component={PortalCsDetail} />
      <Route path="/portal/cs" component={PortalCs} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/stay-plan" component={StayPlan} />
      <Route path="/for-student" component={ForStudent} />
      <Route path="/for-agent" component={ForAgent} />
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
      <TooltipProvider>
        <AdminDomainRedirect />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
