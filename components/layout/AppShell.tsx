"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import type { ReactNode } from "react";
import { PageViewTracker } from "@/components/telemetry/PageViewTracker";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <PageViewTracker />
      <MobileNav onOpen={() => setMobileOpen(true)} />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <main className="md:pl-24 lg:pl-72 min-h-screen px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </>
  );
}
