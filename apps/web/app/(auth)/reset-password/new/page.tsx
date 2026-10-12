import { AnimatedFormPanel } from "@/components/auth/animated-form-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const dynamic = "force-dynamic";

export default function NewPasswordPage() {
  return (
    <AuthShell>
      <AnimatedFormPanel>
        <NewPasswordForm />
      </AnimatedFormPanel>
    </AuthShell>
  );
}
