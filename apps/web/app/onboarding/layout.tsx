"use client";

import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Onboarding is auth-gated but has no app chrome (no sidebar/header) — it runs
 * once, before the user enters either shell.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">{children}</div>
    </AuthGuard>
  );
}
