import { Switch, Route } from "wouter";
import DevHome from "./Home";
import DevAbout from "./About";
import DevBuy from "./Buy";
import DevBuyList from "./BuyList";
import DevBuyDetail from "./BuyDetail";
import DevRent from "./Rent";
import DevManagement from "./Management";
import DevDirections from "./Directions";
import DevStayPlan from "./StayPlan";
import DevForResident from "./ForResident";
import DevForOwner from "./ForOwner";
import DevForPartner from "./ForPartner";
import DevPrivacy from "./Privacy";
import DevTerms from "./Terms";
// Shared flows reused underneath the development site so the short-term Rent
// engine (search → space detail → booking → portal) works end to end.
import Search from "@/pages/search";
import SpaceDetail from "@/pages/space-detail";
import Booking from "@/pages/booking";
import BookingNew from "@/pages/booking-new";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import PortalLogin from "@/pages/portal-login";
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
import Sign from "@/pages/sign";
import PaymentResult from "@/pages/payment-result";
import NotFound from "@/pages/not-found";

// Dedicated router for a single-building "development" instance (Metheim).
// Top-level marketing site is the 4-part Home/Buy/Rent/Management; the guest
// booking + portal routes are mounted unchanged so the short-term Rent flow and
// account area keep functioning.
export default function DevRouter() {
  return (
    <Switch>
      <Route path="/" component={DevHome} />
      <Route path="/about" component={DevAbout} />
      <Route path="/buy" component={DevBuy} />
      <Route path="/buy/list" component={DevBuyList} />
      <Route path="/buy/:id" component={DevBuyDetail} />
      <Route path="/rent" component={DevRent} />
      <Route path="/management" component={DevManagement} />
      <Route path="/directions" component={DevDirections} />

      {/* Metheim-specific versions of the standard site's marketing pages.
          Same URLs as MillionStay so existing links resolve, but tenant/owner/
          partner personas instead of student-homestay/education-agent content. */}
      <Route path="/stay-plan" component={DevStayPlan} />
      <Route path="/for-student" component={DevForResident} />
      <Route path="/for-homestay-host" component={DevForOwner} />
      <Route path="/for-agent" component={DevForPartner} />

      {/* Shared short-term booking engine */}
      <Route path="/search" component={Search} />
      <Route path="/spaces/:id" component={SpaceDetail} />
      <Route path="/booking/new" component={BookingNew} />
      <Route path="/booking/:spaceId" component={Booking} />

      {/* Auth + guest portal */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/portal-login" component={PortalLogin} />
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

      {/* Metheim (Korea) legal pages — override the shared privacy policy with the
          tenant's own 개인정보처리방침, plus a dedicated 이용약관. */}
      <Route path="/privacy-policy" component={DevPrivacy} />
      <Route path="/privacy" component={DevPrivacy} />
      <Route path="/terms" component={DevTerms} />

      {/* Misc shared */}
      <Route path="/sign/:token" component={Sign} />
      <Route path="/payment-result" component={PaymentResult} />

      <Route component={NotFound} />
    </Switch>
  );
}
