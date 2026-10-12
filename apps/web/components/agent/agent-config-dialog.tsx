"use client";

import { AgentConfigPanel } from "@/components/agent/agent-config-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentOut } from "@/lib/api";

/**
 * The agent edit surface as a centered modal. Hosts the safe-fields config panel
 * (name · schedule · destination · documents); the panel closes the dialog itself
 * on a successful schedule/destination save, and stays open on a doc-change re-vet
 * so the user sees the "sent back to review" note.
 */
export function AgentConfigDialog({
  agent,
  workspaceId,
  open,
  onOpenChange,
}: {
  agent: AgentOut;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        {/* Header is fixed (the X lives here) — only the body scrolls, so the scrollbar
            never collides with the close button. */}
        <DialogHeader className="shrink-0 border-b border-neutral-100 px-6 py-4 pr-14">
          <DialogTitle className="text-lg">Edit agent</DialogTitle>
          <DialogDescription>
            Change the name, schedule, destination, or documents. AI internals stay locked.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <AgentConfigPanel
            agent={agent}
            workspaceId={workspaceId}
            onSaved={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
