import { Switch, Route } from "wouter";
import HomestayHome from "./Home";
import HomestayContact from "./Contact";
import HomestayComingSoon from "./ComingSoon";
import Sign from "@/pages/sign";
import ForHomestayHost from "@/pages/for-homestay-host";
import HostLogin from "@/pages/host-login";
import HostPortal from "@/pages/host-portal";

// Dedicated router for homestay.millionstay.com. Pages whose feature ships in a
// later phase render the branded "coming soon" stub so nav never 404s. The live
// host-family flow + e-signature route through their existing pages.
export default function HomestayRouter() {
  return (
    <Switch>
      <Route path="/" component={HomestayHome} />
      <Route path="/contact" component={HomestayContact} />

      {/* Live today */}
      <Route path="/for-homestay-host" component={ForHomestayHost} />
      <Route path="/host-login" component={HostLogin} />
      <Route path="/host-portal" component={HostPortal} />
      <Route path="/sign/:token" component={Sign} />

      {/* Coming soon (filled in later phases) */}
      <Route path="/about">{() => <HomestayComingSoon title="About us" />}</Route>
      <Route path="/how-it-works">{() => <HomestayComingSoon title="How it works" />}</Route>
      <Route path="/mission">{() => <HomestayComingSoon title="Our mission" />}</Route>
      <Route path="/vision">{() => <HomestayComingSoon title="Our vision" />}</Route>
      <Route path="/students/apply">{() => <HomestayComingSoon title="Become a homestay student" />}</Route>
      <Route path="/students/advantages">{() => <HomestayComingSoon title="Student advantages" />}</Route>
      <Route path="/students/tips">{() => <HomestayComingSoon title="Tips for students" />}</Route>
      <Route path="/students/essential-information">{() => <HomestayComingSoon title="Essential information" />}</Route>
      <Route path="/hosts/become-a-host">{() => <HomestayComingSoon title="Become a host family" />}</Route>
      <Route path="/hosts/benefits">{() => <HomestayComingSoon title="Host family benefits" />}</Route>
      <Route path="/hosts/tips">{() => <HomestayComingSoon title="Tips for host families" />}</Route>
      <Route path="/hosts/apply">{() => <HomestayComingSoon title="Become a host family" />}</Route>
      <Route path="/partners">{() => <HomestayComingSoon title="Working with partners" />}</Route>
      <Route path="/partners/study-tour">{() => <HomestayComingSoon title="Study tours" />}</Route>

      <Route>{() => <HomestayComingSoon title="Page not found" />}</Route>
    </Switch>
  );
}
