"use client";

import { useEffect, useState } from "react";
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { CashflowCard } from "@/components/dashboard/CashflowCard";
import { OutstandingInflowsCard } from "@/components/dashboard/OutstandingInflowsCard";
import { AlertsCard, type Alert } from "@/components/dashboard/AlertsCard";
import { CashflowTrendCard } from "@/components/dashboard/CashflowTrendCard";
import { OverspentCategoriesCard } from "@/components/dashboard/OverspentCategoriesCard";
import { MonthSelector } from "@/components/budget/MonthSelector";
import { getDashboardData, getExpectedInflows, getCashflowTrend, getOverspentCategories } from "@/lib/queries";
import { getCurrentMonth, formatCurrency } from "@/lib/cashflow";
import type { ExpectedInflow } from "@/types/database";

interface DashboardData {
  cashflow: {
    income: number;
    fixed: number;
    variableEssentials: number;
    discretionary: number;
    debt: number;
    savings: number;
    business: number;
  };
  totalExpenses: number;
  netCashflow: number;
  safeToSpend: {
    weeklyTarget: number;
    weeklySpent: number;
    remaining: number;
    monthlyBudget: number;
  };
  outstandingInflows: ExpectedInflow[];
  transactions: any[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [inflows, setInflows] = useState<ExpectedInflow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [trendData, setTrendData] = useState<{ month: string; net: number }[]>([]);
  const [overspentCategories, setOverspentCategories] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboardData, inflowsData, trend, overspent] = await Promise.all([
          getDashboardData(selectedMonth),
          getExpectedInflows(selectedMonth),
          getCashflowTrend(6),
          getOverspentCategories(selectedMonth, 3),
        ]);

        setData(dashboardData);
        setInflows(inflowsData);
        setTrendData(trend);
        setOverspentCategories(overspent);

        // Generate alerts based on data
        const newAlerts: Alert[] = [];

        // Check for pending inflows
        const pendingInflows = inflowsData.filter((i) => i.status === "pending");
        if (pendingInflows.length > 0) {
          const totalPending = pendingInflows.reduce(
            (sum, i) => sum + i.expected_amount,
            0
          );
          newAlerts.push({
            id: "pending-inflows",
            type: "info",
            title: "Outstanding income",
            message: `You have ${formatCurrency(totalPending)} in expected inflows not yet received`,
          });
        }

        // Check if over budget on discretionary
        if (
          dashboardData.safeToSpend.weeklySpent >
          dashboardData.safeToSpend.weeklyTarget
        ) {
          newAlerts.push({
            id: "over-budget",
            type: "warning",
            title: "Over weekly spending target",
            message: `You've spent ${formatCurrency(dashboardData.safeToSpend.weeklySpent)} of your ${formatCurrency(dashboardData.safeToSpend.weeklyTarget)} weekly target`,
          });
        }

        // Check for negative cashflow
        if (dashboardData.netCashflow < 0) {
          newAlerts.push({
            id: "negative-cashflow",
            type: "danger",
            title: "Negative cashflow this month",
            message: `You're spending ${formatCurrency(Math.abs(dashboardData.netCashflow))} more than you're earning`,
          });
        }

        setAlerts(newAlerts);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedMonth]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Your financial overview at a glance
          </p>
        </div>
        <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Safe to Spend - Featured prominently */}
        <div className="lg:col-span-1">
          <SafeToSpendCard
            safeToSpend={data?.safeToSpend.remaining || 0}
            weeklyTarget={data?.safeToSpend.weeklyTarget || 0}
            spentThisWeek={data?.safeToSpend.weeklySpent || 0}
          />
        </div>

        {/* Monthly Cashflow */}
        <div className="lg:col-span-1">
          <CashflowCard
            currentMonth={selectedMonth}
            income={data?.cashflow.income || 0}
            expenses={data?.totalExpenses || 0}
            netCashflow={data?.netCashflow || 0}
          />
        </div>

        {/* Outstanding Inflows */}
        <div className="lg:col-span-1">
          <OutstandingInflowsCard inflows={inflows} />
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cashflow Trend */}
        <div>
          <CashflowTrendCard trend={trendData} />
        </div>

        {/* Overspent Categories */}
        <div>
          <OverspentCategoriesCard categories={overspentCategories} />
        </div>
      </div>

      {/* Alerts Section */}
      <AlertsCard alerts={alerts} />
    </div>
  );
}
