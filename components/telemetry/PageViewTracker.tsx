"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackClientEvent } from "@/lib/clientTelemetry";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    const query = searchParams?.toString() || "";
    const fullPath = query ? `${pathname}?${query}` : pathname;

    if (!initializedRef.current) {
      initializedRef.current = true;
      void trackClientEvent("app_loaded", { pagePath: fullPath });
    }

    if (lastTrackedPathRef.current === fullPath) return;
    lastTrackedPathRef.current = fullPath;

    void trackClientEvent("page_view", { pagePath: fullPath });
  }, [pathname, searchParams]);

  return null;
}
