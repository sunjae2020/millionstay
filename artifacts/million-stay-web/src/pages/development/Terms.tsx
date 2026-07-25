import { LegalPage } from "@/components/development/LegalPage";

// 이용약관 (MetHeim Korea). CMS-editable per-locale via
// usePageContent("dev-terms") + shared company info from "dev-footer".
export default function DevTerms() {
  return <LegalPage pageKey="dev-terms" ns="terms" />;
}
