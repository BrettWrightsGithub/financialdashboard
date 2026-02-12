"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageViewTracker } from "@/components/telemetry/PageViewTracker";
import { AssistantPanel } from "@/components/assistant/v2/AssistantPanel";
import { isAssistantPanelV2Enabled } from "@/lib/featureFlags";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const hasLegacyAssistantOnRoute =
    pathname === "/transactions" || pathname === "/admin/rules";
  const showAssistantV2 =
    isAssistantPanelV2Enabled() && !hasLegacyAssistantOnRoute;

  return (
    <>
      <PageViewTracker />
      <MobileNav onOpen={() => setMobileOpen(true)} />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <main className="md:pl-24 lg:pl-72 min-h-screen px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      {showAssistantV2 ? <AssistantPanel projectName="global" /> : null}
    </>
  );
}
