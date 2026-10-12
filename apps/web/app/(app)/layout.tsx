"use client";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { CommandPaletteProvider } from "@/components/app/command-palette";
import { SidebarProvider, useSidebar } from "@/components/app/sidebar-context";
import { SimpleSidebar } from "@/components/app/simple-sidebar";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import { OnboardingGuard } from "@/components/auth/onboarding-guard";
import { ToastProvider } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthGuard>
        <OnboardingGuard>
          <WorkspaceProvider>
            <SidebarProvider>
              <CommandPaletteProvider>
                <Shell>{children}</Shell>
              </CommandPaletteProvider>
            </SidebarProvider>
          </WorkspaceProvider>
        </OnboardingGuard>
      </AuthGuard>
    </ToastProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  // Two shells, same backend (RLS/OPA gate every action either way — the shell is UX,
  // never a privilege). End-users live in the SILA agent-first shell; the operator
  // dashboard (full nav) is shown on the management routes, reached via a role-gated
  // switch in the account menu. Both sidebars share the 64/256 collapsed width.
  const operator = pathname.startsWith("/workspaces/") || pathname.startsWith("/admin");
  return (
    <div className="min-h-screen bg-white">
      {operator ? <AppSidebar /> : <SimpleSidebar />}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out",
          collapsed ? "ml-[64px]" : "ml-[256px]"
        )}
      >
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
