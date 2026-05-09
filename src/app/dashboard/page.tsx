import { AdaptArxivDashboard } from "@/components/adaptarxiv-dashboard";
import { DashboardAppHeader } from "@/components/dashboard/dashboard-app-header";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";

type DashboardPageProps = {
  searchParams?: Promise<{
    arxivUrl?: string | string[];
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const arxivUrl =
    typeof params?.arxivUrl === "string" ? params.arxivUrl : undefined;

  return (
    <>
      <DashboardAppHeader />
      <AdaptArxivDashboard initialArxivUrl={arxivUrl} />
      <DashboardFooter />
    </>
  );
}
