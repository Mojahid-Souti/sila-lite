"use client";

import { SettingsModal } from "@/components/app/settings-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { api } from "@/lib/api";
import { stopAuthRefresh } from "@/lib/auth-refresh";
import { clearTokens } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useMe } from "@/lib/use-me";
import {
  Bell,
  ChevronsUpDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspaces } from "./workspace-context";

export function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { currentId } = useWorkspaces();
  const pathname = usePathname();
  // Operator dashboard is role-gated (admin/reviewer); the shell is UX only — RLS+OPA
  // still gate every action. Mode is not chosen at onboarding, it's a per-shell switch.
  const { role } = useWorkspaceRole(currentId ?? "");
  const isOperator = role === "admin" || role === "reviewer";
  const onDashboard = pathname.startsWith("/workspaces/") || pathname.startsWith("/admin");
  // Shared identity query — see lib/use-me.ts. Was a private fetch here, which
  // made this the second of three concurrent /auth/me calls per page load.
  const { me } = useMe();
  // Which modal section to open; null keeps it closed.
  const [panel, setPanel] = useState<
    "dashboard" | "account" | "workspace" | "notifications" | "support" | null
  >(null);

  // The saved display name wins. The email handle is only a fallback for an
  // account that has never set one — deriving it unconditionally is what kept
  // this row reading "Test" for a test account after the name was changed.
  const saved = me?.full_name?.trim() ?? "";
  const handle = me?.email.split("@")[0] ?? "";
  // A derived handle gets an uppercase first letter ("test" → "Test"); a name
  // the user typed is shown exactly as they typed it.
  const display = saved || (handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "Loading…");
  const initial = (saved || me?.email || "?").charAt(0).toUpperCase();
  const email = me?.email ?? "";

  function handleSignOut() {
    stopAuthRefresh();
    clearTokens();
    toast("Signed out.", "info");
    router.replace(ROUTES.login);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-neutral-100 text-sm font-semibold text-neutral-600">
              {initial}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-950">
                    {display}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">{email}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-neutral-400" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align={collapsed ? "start" : "end"} className="w-64">
          <DropdownMenuLabel className="truncate py-1.5 text-xs font-normal text-neutral-500">
            {email || display}
          </DropdownMenuLabel>
          {/* Settings and Dashboard open the centred modal instead of navigating.
            The routes still exist and still work — they are just no longer
            linked from here, so the shell stays put while you look at them. */}
          <DropdownMenuItem onSelect={() => setPanel("workspace")} className="gap-2.5">
            <Settings className="size-4" />
            Settings
          </DropdownMenuItem>
          {isOperator &&
            (onDashboard ? (
              <DropdownMenuItem onSelect={() => router.push(ROUTES.dashboard)} className="gap-2.5">
                <Sparkles className="size-4" />
                Back to the assistant
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setPanel("dashboard")} className="gap-2.5">
                <LayoutDashboard className="size-4" />
                Dashboard
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem onSelect={() => setPanel("support")} className="gap-2.5">
            <LifeBuoy className="size-4" />
            Support
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPanel("account")} className="gap-2.5">
            <User className="size-4" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPanel("notifications")} className="gap-2.5">
            <Bell className="size-4" />
            Notifications
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="gap-2.5 text-red-600 focus:text-red-700"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Rendered OUTSIDE the DropdownMenu: as the menu closes on select, Radix
        returns focus to the trigger, and a dialog living inside that tree gets
        the focus yanked out from under it as it mounts. */}
      {panel && <SettingsModal open initial={panel} onOpenChange={(o) => !o && setPanel(null)} />}
    </>
  );
}
