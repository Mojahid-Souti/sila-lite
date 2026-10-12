import { AnimatedFormPanel } from "@/components/auth/animated-form-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <AuthShell>
      <AnimatedFormPanel>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-neutral-100" />}>
          <VerifyForm />
        </Suspense>
      </AnimatedFormPanel>
    </AuthShell>
  );
}
