"use client";

import type { SilaWorkerLane } from "@/lib/sila-socket";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader, XCircle } from "lucide-react";

/**
 * Fan-out worker roster — one lane per parallel sub-task (the planner's
 * decomposition). Each lane advances queued → running → done/failed as the
 * worker frames arrive. Shown above the closing reply on a fan-out turn.
 */
function laneIcon(status: SilaWorkerLane["status"]) {
  switch (status) {
    case "running":
      return <Loader className="size-3.5 animate-spin text-neutral-500" />;
    case "done":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />;
    case "failed":
      return <XCircle className="size-3.5 text-red-500" />;
    default:
      return <Circle className="size-3.5 text-neutral-300" />;
  }
}

export function SilaRoster({ roster }: { roster: SilaWorkerLane[] }) {
  if (roster.length === 0) return null;
  const done = roster.filter((l) => l.status === "done").length;
  const failed = roster.filter((l) => l.status === "failed").length;

  return (
    <div className="my-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Working in parallel
        </span>
        <span className="text-[11px] tabular-nums text-neutral-400">
          {done}/{roster.length} done{failed ? ` · ${failed} failed` : ""}
        </span>
      </div>
      <ul className="space-y-1.5">
        {roster.map((lane) => (
          <li key={lane.workerId} className="flex items-start gap-2 text-[13px]">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
              {laneIcon(lane.status)}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate",
                  lane.status === "running" ? "sila-shimmer" : "text-neutral-700",
                  lane.status === "queued" && "text-neutral-400"
                )}
              >
                {lane.label}
              </span>
              {lane.status === "failed" && lane.result && (
                <span className="block truncate text-[12px] text-red-500">{lane.result}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
