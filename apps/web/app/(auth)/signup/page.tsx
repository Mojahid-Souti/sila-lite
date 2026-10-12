import { AuthCardTransition } from "@/components/auth/auth-card-transition";
import { SignupForm } from "@/components/auth/signup-form";

// Mirrors the login page exactly (login-04 card + shared entrance), so moving
// login ↔ signup animates continuously instead of swapping whole layouts.
export default function SignupPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-neutral-50 p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-5xl">
        <AuthCardTransition>
          <SignupForm />
        </AuthCardTransition>
      </div>
      <p className="max-w-sm text-balance text-center text-xs text-neutral-500 md:max-w-5xl [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-neutral-800">
        By continuing, you agree to our <a href="/legal/terms">Terms of Service</a> and{" "}
        <a href="/legal/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
