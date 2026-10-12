"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AgentOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Globe, Loader2, Lock, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Publish confirmation — makes the cross-workspace reach explicit and, for
 * workflow agents WITH documents, offers the publisher's data choice:
 * include the docs (hirers run on the same data, copied to their workspace)
 * or let hirers bring their own. Success toasts a link to the listing.
 */
export function PublishConfirmDialog({
  open,
  onClose,
  agent,
  workspaceId,
  token,
}: {
  open: boolean;
  onClose: () => void;
  agent: AgentOut;
  workspaceId: string;
  token: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [includeDocs, setIncludeDocs] = useState(false);

  const docsCount = agent.publisher_config?.docs?.length ?? 0;
  // Only Public/Internal agents may share their documents (server-enforced too).
  const canShareDocs =
    agent.kind === "workflow" &&
    docsCount > 0 &&
    ["public", "internal"].includes(agent.classification);

  const publish = useMutation({
    mutationFn: () => api.agents.publish(workspaceId, agent.id, token, includeDocs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", workspaceId, agent.id] });
      qc.invalidateQueries({ queryKey: ["agents", workspaceId] });
      toast(`${agent.name} is live in the Bazaar.`, "success");
      onClose();
      router.push(ROUTES.bazaarAgent(agent.id));
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Publish failed", "error"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="space-y-2.5 p-6 pb-4">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Store className="size-5" />
          </span>
          <DialogTitle className="text-base">Publish "{agent.name}" to the Bazaar</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Every workspace on the platform can discover and hire it. Hirers set up their own copy
            with their own accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <ul className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5 text-[12.5px] text-neutral-600">
            <li className="flex items-start gap-2">
              <Globe className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
              The listing shows what the agent does, its schedule, and which apps it needs.
            </li>
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
              Your channels, recipients, and connected accounts are never shown or shared.
            </li>
          </ul>

          {canShareDocs && (
            <button
              type="button"
              onClick={() => setIncludeDocs((v) => !v)}
              aria-pressed={includeDocs}
              className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                includeDocs
                  ? "border-primary/40 bg-primary/[0.04]"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                  includeDocs ? "border-primary bg-primary text-white" : "border-neutral-300"
                }`}
              >
                {includeDocs && <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium text-neutral-900 text-sm">
                  <FileText className="size-3.5 text-neutral-400" />
                  Include the {docsCount} document{docsCount === 1 ? "" : "s"}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-neutral-500 leading-relaxed">
                  Hirers run the agent on the same data — a copy lands in their workspace. Leave off
                  to let them attach their own documents instead.
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-3.5 font-medium text-neutral-700 text-sm hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={publish.isPending}
            onClick={() => publish.mutate()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-medium text-sm text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {publish.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Store className="size-4" />
            )}
            Publish
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
