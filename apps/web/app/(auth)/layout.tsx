import { EmailConfirmationBroadcaster } from "@/components/auth/email-confirmation-broadcaster";
import { GuestGuard } from "@/components/auth/guest-guard";
import { ToastProvider } from "@/lib/toast";

// Providers + guards only — no visual shell here. Each page picks its own
// presentation (login-04 card vs. the split-screen showcase) so pages can be
// redesigned one at a time (per CLAUDE.md's page-by-page unit of approval)
// without dragging the others along.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GuestGuard>
        <EmailConfirmationBroadcaster />
        {children}
      </GuestGuard>
    </ToastProvider>
  );
}
