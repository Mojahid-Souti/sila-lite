"use client";

import { getToken } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { getOnboardingComplete } from "@/lib/jwt-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Phase 17 gate. Runs inside AuthGuard (token already present): if the user
 * hasn't finished onboarding, send them to /onboarding before any app route.
 * O(1) — reads one decoded JWT claim, no network call.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getOnboardingComplete(getToken())) {
      router.replace(ROUTES.onboarding);
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-neutral-400">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
