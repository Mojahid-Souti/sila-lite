import { AnimatedFormPanel } from "@/components/auth/animated-form-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <AnimatedFormPanel>
        <ResetPasswordForm />
      </AnimatedFormPanel>
    </AuthShell>
  );
}
