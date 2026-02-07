"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/transactions", label: "Transactions", icon: "💳" },
  { href: "/accounts", label: "Accounts", icon: "🏦" },
  { href: "/budget-planner", label: "Budget", icon: "📊" },
  { href: "/admin/rules", label: "Rules", icon: "🧠" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem("sidebar-expanded");
    if (saved !== null) {
      setExpanded(saved === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sidebar-expanded", String(expanded));
  }, [expanded]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "[") {
        event.preventDefault();
        setExpanded((value) => !value);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const desktopWidth = expanded ? "md:w-64" : "md:w-[72px]";

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 bg-slate-900 text-slate-100 border-r border-slate-800 transition-[width,transform] duration-200 ${desktopWidth} ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 w-64`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-sm rounded border border-slate-700 px-2 py-1 hidden md:inline-flex items-center gap-2"
          >
            <span>☰</span>
            {expanded && <span>Menu</span>}
          </button>
          <span className={`font-semibold tracking-wide ${expanded ? "block" : "hidden md:hidden"}`}>Command Center</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 rounded-full bg-slate-700 border border-slate-600 items-center justify-center"
        >
          {expanded ? "◀" : "▶"}
        </button>

        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`block rounded-lg px-3 py-2 text-sm min-h-[44px] ${active ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                title={!expanded ? item.label : undefined}
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden>{item.icon}</span>
                  {expanded && <span>{item.label}</span>}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
