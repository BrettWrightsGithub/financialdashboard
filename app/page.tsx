import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { CashflowCard } from "@/components/dashboard/CashflowCard";
import { OutstandingInflowsCard } from "@/components/dashboard/OutstandingInflowsCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Your financial overview at a glance
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Safe to Spend - Featured prominently */}
        <div className="lg:col-span-1">
          <SafeToSpendCard />
        </div>

        {/* Monthly Cashflow */}
        <div className="lg:col-span-1">
          <CashflowCard />
        </div>

        {/* Outstanding Inflows */}
        <div className="lg:col-span-1">
          <OutstandingInflowsCard />
        </div>
      </div>

      {/* Alerts Section */}
      <AlertsCard />
    </div>
  );
}
