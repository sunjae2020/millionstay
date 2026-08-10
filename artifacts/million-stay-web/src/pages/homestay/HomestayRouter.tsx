import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Switch, Route, useLocation } from "wouter";
import HomestayHome from "./Home";
import HomestayContact from "./Contact";
import HomestayComingSoon from "./ComingSoon";
import AboutUs from "./AboutUs";
import StudentBecome from "./StudentBecome";
import StudentApply from "./StudentApply";
import HostBecome from "./HostBecome";
import HostApply from "./HostApply";
import PartnersWorking from "./PartnersWorking";
import HomestayBlog from "./HomestayBlog";
import HomestayBlogPost from "./HomestayBlogPost";
import HomestayPrivacy from "./HomestayPrivacy";
import HomestayTerms from "./HomestayTerms";
import Sign from "@/pages/sign";
import ForHomestayHost from "@/pages/for-homestay-host";
import HostLogin from "@/pages/host-login";
import HostPortal from "@/pages/host-portal";

// Redirects a former sub-page URL to its anchored section on the consolidated
// page (e.g. /students/advantages → /students#advantages). The destination
// page's HomestayLayout reads the hash and scrolls to the section.
function HashRedirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

// Dedicated router for homestay.millionstay.com. Single-tier site map: 5 top
// menus (About / Student / Host Family / Partners / Contact) + home. Former
// sub-pages are now #anchored sections, with their old URLs redirected below so
// existing links and search-engine results keep working.
export default function HomestayRouter() {
  const { t } = useTranslation();
  return (
    <Switch>
      <Route path="/" component={HomestayHome} />

      {/* About Us (How It Works / Mission / Vision absorbed as sections) */}
      <Route path="/about" component={AboutUs} />
      <Route path="/how-it-works"><HashRedirect to="/about#how-it-works" /></Route>
      <Route path="/mission"><HashRedirect to="/about#mission" /></Route>
      <Route path="/vision"><HashRedirect to="/about#vision" /></Route>

      {/* Student (Advantages / Tips / Essential Information absorbed) */}
      <Route path="/students" component={StudentBecome} />
      <Route path="/students/advantages"><HashRedirect to="/students#advantages" /></Route>
      <Route path="/students/tips"><HashRedirect to="/students#tips" /></Route>
      <Route path="/students/essential-information"><HashRedirect to="/students#essentials" /></Route>
      <Route path="/students/apply" component={StudentApply} />

      {/* Host Family (Benefits / Tips absorbed) */}
      <Route path="/hosts/become-a-host" component={HostBecome} />
      <Route path="/hosts/benefits"><HashRedirect to="/hosts/become-a-host#benefits" /></Route>
      <Route path="/hosts/tips"><HashRedirect to="/hosts/become-a-host#tips" /></Route>
      <Route path="/hosts/apply" component={HostApply} />

      {/* Partners (Study Tour absorbed) */}
      <Route path="/partners" component={PartnersWorking} />
      <Route path="/partners/study-tour"><HashRedirect to="/partners#study-tour" /></Route>

      {/* Blog — page exists but is intentionally hidden from the main nav. */}
      <Route path="/blog" component={HomestayBlog} />
      <Route path="/blog/:slug" component={HomestayBlogPost} />

      {/* Contact */}
      <Route path="/contact" component={HomestayContact} />

      {/* Legal */}
      <Route path="/privacy" component={HomestayPrivacy} />
      <Route path="/privacy-policy"><HashRedirect to="/privacy" /></Route>
      <Route path="/terms" component={HomestayTerms} />

      {/* Live flows (existing pages). The host application form keeps the shared
          MillionStay component but is served under the homestay site's own
          /hosts/… slug; the old MillionStay URL redirects to it. */}
      <Route path="/hosts/application" component={ForHomestayHost} />
      <Route path="/for-homestay-host"><HashRedirect to="/hosts/application" /></Route>
      <Route path="/host-login" component={HostLogin} />
      <Route path="/host-portal" component={HostPortal} />
      <Route path="/sign/:token" component={Sign} />

      <Route>{() => <HomestayComingSoon title={t("homestay.coming_soon.not_found")} />}</Route>
    </Switch>
  );
}
