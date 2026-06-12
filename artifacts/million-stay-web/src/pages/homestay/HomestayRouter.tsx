import { Switch, Route } from "wouter";
import HomestayHome from "./Home";
import HomestayContact from "./Contact";
import HomestayComingSoon from "./ComingSoon";
import AboutUs from "./AboutUs";
import HowItWorks from "./HowItWorks";
import Mission from "./Mission";
import Vision from "./Vision";
import StudentBecome from "./StudentBecome";
import StudentAdvantages from "./StudentAdvantages";
import StudentTips from "./StudentTips";
import StudentEssentialInfo from "./StudentEssentialInfo";
import StudentApply from "./StudentApply";
import HostBecome from "./HostBecome";
import HostBenefits from "./HostBenefits";
import HostTips from "./HostTips";
import HostApply from "./HostApply";
import PartnersWorking from "./PartnersWorking";
import StudyTour from "./StudyTour";
import Sign from "@/pages/sign";
import ForHomestayHost from "@/pages/for-homestay-host";
import HostLogin from "@/pages/host-login";
import HostPortal from "@/pages/host-portal";

// Dedicated router for homestay.millionstay.com. Site map: 5 top menus + home.
// Content pages are live; the online student application + agent portal funnel
// to "coming soon" / contact until their phase ships.
export default function HomestayRouter() {
  return (
    <Switch>
      <Route path="/" component={HomestayHome} />

      {/* About Us */}
      <Route path="/about" component={AboutUs} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/mission" component={Mission} />
      <Route path="/vision" component={Vision} />

      {/* Student */}
      <Route path="/students" component={StudentBecome} />
      <Route path="/students/advantages" component={StudentAdvantages} />
      <Route path="/students/tips" component={StudentTips} />
      <Route path="/students/essential-information" component={StudentEssentialInfo} />
      <Route path="/students/apply" component={StudentApply} />

      {/* Host Family */}
      <Route path="/hosts/become-a-host" component={HostBecome} />
      <Route path="/hosts/benefits" component={HostBenefits} />
      <Route path="/hosts/tips" component={HostTips} />
      <Route path="/hosts/apply" component={HostApply} />

      {/* Partners */}
      <Route path="/partners" component={PartnersWorking} />
      <Route path="/partners/study-tour" component={StudyTour} />

      {/* Contact */}
      <Route path="/contact" component={HomestayContact} />

      {/* Live flows (existing pages) */}
      <Route path="/for-homestay-host" component={ForHomestayHost} />
      <Route path="/host-login" component={HostLogin} />
      <Route path="/host-portal" component={HostPortal} />
      <Route path="/sign/:token" component={Sign} />

      <Route>{() => <HomestayComingSoon title="Page not found" />}</Route>
    </Switch>
  );
}
