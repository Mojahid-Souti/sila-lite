"use client";

export const dynamic = "force-dynamic";

import { AdminStatCard } from "@/app/(app)/admin/_components/admin-stat-card";
import { useWorkspaces } from "@/components/app/workspace-context";
import { ShieldCheck } from "lucide-react";

/**
 * Admin Panel home — starter page. Replace this with the real admin UI.
 * It already proves the wiring works: the route renders, the workspace
 * context is available, and a co-located component is imported.
 */
export default function AdminHomePage() {
  const { current } = useWorkspaces();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 border-neutral-200 border-b pb-5">
        <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-semibold text-neutral-950 text-xl tracking-tight">Admin Panel</h1>
          <p className="text-neutral-500 text-sm">
            Workspace: {current?.name ?? "—"} · build the admin experience here.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Reports queue" value="—" hint="agent_reports awaiting review" />
        <AdminStatCard label="Members" value="—" hint="across this workspace" />
        <AdminStatCard label="Audit events" value="—" hint="last 24 hours" />
      </div>

      <p className="mt-8 max-w-prose text-neutral-500 text-sm">
        This is scaffolding. Add pages under <code>app/(app)/admin/</code> and components under{" "}
        <code>app/(app)/admin/_components/</code>. Fetch data with the shared <code>@/lib/api</code>{" "}
        client. See <code>app/(app)/admin/README.md</code>.
      </p>
    </div>
  );
}
