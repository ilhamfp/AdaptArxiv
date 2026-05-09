import { AdaptArxivDashboard } from "@/components/adaptarxiv-dashboard";
import { DashboardAppHeader } from "@/components/dashboard/dashboard-app-header";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";

export default function DashboardPage() {
  return (
    <>
      <DashboardAppHeader />
      <AdaptArxivDashboard />
      <DashboardFooter />
    </>
  );
}
