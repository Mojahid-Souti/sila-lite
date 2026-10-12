"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND_GRADIENT } from "@/lib/brand";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspaces } from "./workspace-context";

export function WorkspaceSwitcher({
  collapsed,
  showAvatar = true,
}: {
  collapsed: boolean;
  showAvatar?: boolean;
}) {
  const router = useRouter();
  const { workspaces, currentId, current, selectWorkspace } = useWorkspaces();
  const initial = (current?.name ?? "W").charAt(0).toUpperCase();
  const displayName = current?.name ?? "Select workspace";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
            // Collapsed: match the borderless, centered nav icons. Expanded: the
            // bordered switcher box with the workspace name + chevron.
            collapsed
              ? "h-9 justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
              : "gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 hover:border-neutral-300 hover:bg-neutral-50"
          )}
        >
          {showAvatar ? (
            <span
              className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold text-white"
              style={{ backgroundImage: BRAND_GRADIENT }}
            >
              {initial}
            </span>
          ) : (
            collapsed && <Building2 className="size-4 shrink-0" />
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-950">
                {displayName}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "bottom"} align="start" className="w-60">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-neutral-500">
          Switch workspace
        </DropdownMenuLabel>
        {workspaces.length === 0 ? (
          <div className="px-2 py-2.5 text-sm text-neutral-500">No workspaces yet.</div>
        ) : (
          workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => {
                // Persist the choice — without it the context snaps back to the
                // newest workspace (the user's own personal one) on next load.
                selectWorkspace(ws.id);
                router.push(ROUTES.dashboard);
              }}
              className="gap-2.5"
            >
              {showAvatar && (
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold text-white"
                  style={{ backgroundImage: BRAND_GRADIENT }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate text-sm">{ws.name}</span>
              {ws.id === currentId && <Check className="size-4 shrink-0 text-neutral-950" />}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.newWorkspace} className="gap-2.5 text-neutral-700">
            <Plus className="size-4" />
            Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
