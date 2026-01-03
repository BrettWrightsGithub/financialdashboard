"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/budget-planner", label: "Budget Planner" },
  { href: "/transactions", label: "Transactions" },
  { href: "/review-queue", label: "Review Queue", showBadge: true },
  { href: "/admin/rules", label: "Rules" },
  { href: "/admin", label: "Admin" },
];

export function Navigation() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState<number>(0);

  useEffect(() => {
    const fetchReviewCount = async () => {
      try {
        const res = await fetch("/api/review-queue?countOnly=true");
        if (res.ok) {
          const data = await res.json();
          setReviewCount(data.count || 0);
        }
      } catch (error) {
        console.error("Failed to fetch review count:", error);
      }
    };

    fetchReviewCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchReviewCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-slate-900 dark:text-white">
              💰 Financial Command Center
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                  {item.showBadge && reviewCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                      {reviewCount > 99 ? "99+" : reviewCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
