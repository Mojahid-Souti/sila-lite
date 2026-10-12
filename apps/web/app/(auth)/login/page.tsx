import { AuthCardTransition } from "@/components/auth/auth-card-transition";
import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

// The login-04 shape: a centered card on a full-page muted background, legal
// line beneath it. Shares its layout + entrance animation with signup, so
// moving between the two feels continuous.
export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-neutral-50 p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-5xl">
        <AuthCardTransition>
          <Suspense
            fallback={<div className="h-[560px] animate-pulse rounded-xl bg-neutral-100" />}
          >
            <LoginForm />
          </Suspense>
        </AuthCardTransition>
      </div>
      <p className="max-w-sm text-balance text-center text-xs text-neutral-500 md:max-w-5xl [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-neutral-800">
        By continuing, you agree to our <a href="/legal/terms">Terms of Service</a> and{" "}
        <a href="/legal/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
