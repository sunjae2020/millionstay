import { LegalPage } from "@/components/development/LegalPage";

// 개인정보처리방침 (MetHeim Korea). CMS-editable per-locale via
// usePageContent("dev-privacy") + shared company info from "dev-footer".
export default function DevPrivacy() {
  return <LegalPage pageKey="dev-privacy" ns="privacy" />;
}
