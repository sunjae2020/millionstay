import { Layout, PageHeader } from "@/components/Layout";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  subtitle?: string;
}

export function ComingSoonPage({ title, subtitle }: ComingSoonProps) {
  return (
    <Layout>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Coming Soon</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This section is under development.
          </p>
        </div>
      </div>
    </Layout>
  );
}
