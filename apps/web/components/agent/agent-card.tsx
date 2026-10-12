"use client";

import { AgentConfigDialog } from "@/components/agent/agent-config-dialog";
import { AgentDetailsDialog } from "@/components/agent/agent-details-dialog";
import { PublishConfirmDialog } from "@/components/agent/publish-confirm-dialog";
import { type AgentOut, type PublisherDestination, api } from "@/lib/api";
import { ConnectorIcon } from "@/lib/connector-icons";
import { describeAgent } from "@/lib/describe-agent";
import { formatSchedule } from "@/lib/schedule";
import { useToken } from "@/lib/use-token";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Pause,
  Pencil,
  Power,
  Store,
} from "lucide-react";
import { useState } from "react";

/**
 * Compact agent card: connector icon stack + name + status dot, a one-line
 * summary, one meta line (schedule · docs), and a slim footer (Activate/Pause,
 * Edit, Details). Everything else lives on the detail page — the whole card
 * is a link to it.
 */

type Props = {
  agent: AgentOut;
  workspaceId: string;
};

function statusDotClass(label: string, live: boolean): string {
  if (live || label.startsWith("Live")) return "bg-green-500";
  if (label.startsWith("Ready") || label.startsWith("Approved")) return "bg-emerald-500";
  if (label.startsWith("Pending") || label.startsWith("Reviewing")) return "bg-amber-400";
  if (label.startsWith("Needs")) return "bg-red-500";
  return "bg-neutral-300"; // Draft — pending review
}

/** Distinct connector/tool types the agent is wired to (Slack, Email, Gmail…). */
function connectedTools(destinations: PublisherDestination[]): PublisherDestination["type"][] {
  return [...new Set(destinations.map((d) => d.type))];
}

export const TOOL_LABELS: Record<string, string> = {
  slack: "Slack",
  email: "Email",
  gmail: "Gmail",
  "google-sheets": "Google Sheets",
  "google-chat": "Google Chat",
  "google-tasks": "Google Tasks",
  "google-docs": "Google Docs",
  "google-calendar": "Google Calendar",
  "outlook-mail": "Outlook",
  "outlook-calendar": "Outlook Calendar",
  "ms-teams": "Microsoft Teams",
  "ms-todo": "Microsoft To Do",
  "ms-onenote": "OneNote",
  "ms-onedrive": "OneDrive",
  "ms-excel": "Excel",
  "ms-word": "Word",
  "ms-powerpoint": "PowerPoint",
};

/** The real brand mark for a connector type.
 *
 *  Delegates to ConnectorIcon, which already resolves the official marks the app
 *  ships — including the Microsoft brand PNGs under /public/icons. This used to
 *  hand-roll a switch of tinted lucide glyphs, so an Outlook destination showed a
 *  generic blue envelope while the Connectors page, the Bazaar and the SILA trace
 *  all showed the real Outlook logo for the same account.
 *
 *  The LABEL is what gets matched, not the type key: ConnectorIcon reads
 *  human-typed names, so "google-chat" misses its keyword ("google chat") and
 *  falls through to the generic Google mark, while "Google Chat" hits it. */
export function ToolGlyph({ type, className }: { type: string; className?: string }) {
  return <ConnectorIcon name={TOOL_LABELS[type] ?? type} className={className} />;
}

/** Overlapping connector avatars (up to three, then a +N bubble). Shared with
 *  the Bazaar cards, which show the same stack from sanitized requirements. */
export function ToolStack({ types }: { types: string[] }) {
  const shown = types.slice(0, 3);
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {shown.map((t) => (
        <span
          key={t}
          title={TOOL_LABELS[t] ?? t}
          className="grid size-6 place-items-center rounded-full border border-neutral-200 bg-white ring-2 ring-white"
        >
          <ToolGlyph type={t} className="size-3" />
        </span>
      ))}
      {types.length > 3 && (
        <span className="grid size-6 place-items-center rounded-full border border-neutral-200 bg-neutral-50 text-[9px] font-semibold text-neutral-500 ring-2 ring-white">
          +{types.length - 3}
        </span>
      )}
    </span>
  );
}

export function AgentCard({ agent, workspaceId }: Props) {
  const cfg = agent.publisher_config;
  const isWorkflow = agent.kind === "workflow" && !!cfg;
  const tools = isWorkflow ? connectedTools(cfg?.destinations ?? []) : [];
  const docs = cfg?.docs ?? [];
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  // Vetted but not yet listed — offer the Bazaar publish right on the card.
  const canPublish =
    agent.status_label === "Ready" && (agent.status === "draft" || agent.status === "in_review");

  // Activation — an approved ("Ready") agent can be turned on (its n8n workflow
  // runs on the schedule) or paused. Draft/pending agents can't run.
  const token = useToken();
  const qc = useQueryClient();
  const canRun = agent.status_label === "Ready";
  const live = Boolean(cfg?.active);
  const activate = useMutation({
    mutationFn: (next: boolean) =>
      api.agents.setActivation(workspaceId, agent.id, next, token as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", workspaceId] });
      qc.invalidateQueries({ queryKey: ["agent", workspaceId, agent.id] });
    },
  });

  const description = isWorkflow ? describeAgent(cfg) : agent.description;

  return (
    <div className="relative rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md">
      {/* The whole card opens the details modal; buttons sit above it (z-10).
          It used to link to the builder page — five tabs deep for a reader who
          only wanted to see what the agent does. That page is still reachable
          from inside the modal. */}
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-label={`Open ${agent.name}`}
        className="absolute inset-0 rounded-xl"
      />

      <div className="flex items-center gap-2.5">
        {tools.length > 0 ? (
          <ToolStack types={tools} />
        ) : (
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-neutral-200 bg-neutral-50">
            <Bot className="size-3 text-neutral-500" />
          </span>
        )}
        <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-neutral-900">
          {agent.name}
        </h3>
        <span
          title={agent.status_label}
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-neutral-500"
        >
          <span className={`size-2 rounded-full ${statusDotClass(agent.status_label, live)}`} />
          {live ? "Active" : agent.status_label.split(" ")[0]}
        </span>
      </div>

      {description && (
        <p className="mt-2 line-clamp-1 text-[12.5px] text-neutral-500">{description}</p>
      )}

      <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-neutral-400">
        {cfg?.schedule && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatSchedule(cfg.schedule.cron, cfg.schedule.timezone)}
          </span>
        )}
        {docs.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3" />
            {docs.length === 1 ? "1 doc" : `${docs.length} docs`}
          </span>
        )}
        {!isWorkflow && agent.version != null && <span>v{agent.version}</span>}
        {!isWorkflow && <span>{agent.classification}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
        {isWorkflow && canRun ? (
          <button
            type="button"
            onClick={() => activate.mutate(!live)}
            disabled={activate.isPending}
            className="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-[11.5px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
          >
            {activate.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : live ? (
              <Pause className="size-3" />
            ) : (
              <Power className="size-3" />
            )}
            {live ? "Pause" : "Activate"}
          </button>
        ) : (
          <span className="text-[11px] text-neutral-400">
            {isWorkflow ? "Awaiting review" : " "}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          {canPublish && (
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              className="relative z-10 inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11.5px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Store className="size-3" /> Publish
            </button>
          )}
          {isWorkflow && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label={`Edit ${agent.name}`}
              className="relative z-10 grid size-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {/* Opens the details modal in place. The full builder page is one
              click further, from inside the modal — a reader who only wants to
              see what the agent does no longer leaves the list to find out. */}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="relative z-10 inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            Details <ChevronRight className="size-3.5" />
          </button>
        </span>
      </div>

      <AgentDetailsDialog
        agent={agent}
        workspaceId={workspaceId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={
          isWorkflow
            ? () => {
                // One modal at a time: details closes, the edit surface opens.
                setDetailsOpen(false);
                setEditOpen(true);
              }
            : undefined
        }
      />
      {isWorkflow && (
        <AgentConfigDialog
          agent={agent}
          workspaceId={workspaceId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {canPublish && token && (
        <PublishConfirmDialog
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          agent={agent}
          workspaceId={workspaceId}
          token={token}
        />
      )}
    </div>
  );
}
