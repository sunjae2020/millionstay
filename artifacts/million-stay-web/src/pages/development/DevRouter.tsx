import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
import InspectionSign from "@/pages/inspection-sign";
import WorkOrderSign from "@/pages/work-order-sign";
import InvoicePay from "@/pages/invoice-pay";
import DocumentSubmit from "@/pages/document-submit";
import PaymentResult from "@/pages/payment-result";
import NotFound from "@/pages/not-found";

// Sends a retired URL to its current one, replacing the history entry so the
// back button skips the legacy path.
function LegacyRedirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

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
          The personas are tenant/owner/partner, not MillionStay's student-
          homestay/education-agent ones, so each page is served from a slug that
          names its own audience. The MillionStay URLs these pages were
          originally mounted on stay as redirects. */}
      <Route path="/stay-plan" component={DevStayPlan} />
      <Route path="/for-resident" component={DevForResident} />
      <Route path="/for-owner" component={DevForOwner} />
      <Route path="/for-partner" component={DevForPartner} />
      {/* 에이전트 = 파트너 (부동산 중개·소개 파트너) — same page. */}
      <Route path="/for-agent"><LegacyRedirect to="/for-partner" /></Route>
      <Route path="/for-student"><LegacyRedirect to="/for-resident" /></Route>
      <Route path="/for-homestay-host"><LegacyRedirect to="/for-owner" /></Route>

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
      {/* 세대점검표 — tenant review & signature (token link, no login). */}
      <Route path="/inspection/:token" component={InspectionSign} />
      {/* 작업 확인서 — 시설 담당자 확인 서명(토큰 링크, 로그인 없음).
          토큰 페이지는 두 라우터에 **모두** 걸어야 한다 — 단일 건물 인스턴스는
          이 DevRouter 만 타므로 App.tsx 쪽에만 넣으면 404 가 된다. */}
      <Route path="/work-order/:token" component={WorkOrderSign} />
      {/* 청구서 조회·입금 통보 / 서류 제출 — 토큰 링크(로그인 없음).
          서명·점검 링크와 마찬가지로 두 라우터에 **모두** 걸어야 한다. */}
      <Route path="/pay/:token" component={InvoicePay} />
      <Route path="/documents/:token" component={DocumentSubmit} />
      <Route path="/payment-result" component={PaymentResult} />

      <Route component={NotFound} />
    </Switch>
  );
}
