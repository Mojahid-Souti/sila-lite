"use client";

import { TOOL_LABELS, ToolGlyph } from "@/components/agent/agent-card";
import { AgentStatusBadge } from "@/components/agent/agent-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VettingStatusBadge } from "@/components/vetting/vetting-status-badge";
import type { AgentOut, PublisherDestination } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { SOVEREIGNTY_NOTE, describeAgent } from "@/lib/describe-agent";
import { formatSchedule } from "@/lib/schedule";
import { ArrowUpRight, Clock, FileText, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";

/**
 * What an agent IS, as a centered modal — the card's "Details" used to navigate
 * to the full builder page, which is a context switch for a reader who only
 * wanted to see what the thing does. Edit hands straight over to the same config
 * modal used everywhere else, so there is one edit surface, not a third.
 *
 * Read-only by design: everything editable lives behind Edit, and the fields the
 * gatekeeper owns (vetting, classification, version) are shown but never typed
 * into here.
 */

/** Where a run's output lands, in the words the owner used when they built it. */
function destinationTarget(d: PublisherDestination): string {
  if (d.type === "slack") return d.channel_name ? `#${d.channel_name}` : "a channel";
  if (d.type === "google-sheets") return "a spreadsheet";
  if (d.type === "google-chat") return d.space ?? "a space";
  if (d.type === "google-docs") return d.title ?? "a new document";
  if (d.type === "google-calendar") return d.calendar_id ?? "your calendar";
  if (d.type === "ms-teams") return d.teams_target ? "a channel" : "your Teams";
  if (d.type === "email" || d.type === "gmail" || d.type === "outlook-mail") return d.to;
  return TOOL_LABELS[d.type] ?? d.type;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </dt>
      {/* Wraps, never truncates: the schedule lost its timezone to an ellipsis
          ("Weekdays 9:00 AM Asia/Mu…"), and the timezone is the half that
          settles whether 9am means anything to the reader. */}
      <dd className="mt-1 text-[13px] leading-snug text-neutral-900">{children}</dd>
    </div>
  );
}

export function AgentDetailsDialog({
  agent,
  workspaceId,
  open,
  onOpenChange,
  onEdit,
}: {
  agent: AgentOut;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands over to the config modal — absent when the agent has nothing safely
   *  editable (an imported Dify app rather than a built workflow). */
  onEdit?: () => void;
}) {
  const cfg = agent.publisher_config;
  const isWorkflow = agent.kind === "workflow" && !!cfg;
  const destinations = cfg?.destinations ?? [];
  const docs = cfg?.docs ?? [];
  const description = isWorkflow ? describeAgent(cfg) : agent.description;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-neutral-100 px-6 py-4 pr-14">
          <DialogTitle className="flex min-w-0 items-center gap-2.5 text-lg">
            <span className="truncate">{agent.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <AgentStatusBadge status={agent.status} />
            <VettingStatusBadge status={agent.vetting_status ?? "unvetted"} />
            {cfg?.active && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-green-700">
                <span className="size-2 rounded-full bg-green-500" />
                Running on schedule
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {description && (
            <p className="text-[13.5px] leading-relaxed text-neutral-700">{description}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Schedule">
              {cfg?.schedule ? (
                <span className="flex items-start gap-1.5">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    {formatSchedule(cfg.schedule.cron, cfg.schedule.timezone)}
                  </span>
                </span>
              ) : (
                "On request"
              )}
            </Field>
            <Field label="Documents">
              {docs.length > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5 shrink-0 text-neutral-400" />
                  {docs.length === 1 ? "1 document" : `${docs.length} documents`}
                </span>
              ) : (
                "None"
              )}
            </Field>
            <Field label="Classification">
              <span className="capitalize">{agent.classification}</span>
            </Field>
            <Field label="Created">{formatDate(agent.created_at)}</Field>
            <Field label="Last updated">{formatDate(agent.updated_at)}</Field>
            {agent.version != null && <Field label="Version">v{agent.version}</Field>}
          </dl>

          {destinations.length > 0 && (
            <div>
              <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-neutral-400">
                Where it publishes
              </p>
              <ul className="space-y-1.5">
                {destinations.map((d, i) => (
                  <li
                    // Two destinations of the same type are legitimate (two
                    // channels), so position is part of the identity.
                    key={`${d.type}-${i}`}
                    className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <ToolGlyph type={d.type} className="size-4 shrink-0" />
                    <span className="shrink-0 text-[13px] font-medium text-neutral-800">
                      {TOOL_LABELS[d.type] ?? d.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right text-[12.5px] text-neutral-500">
                      {destinationTarget(d)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {docs.length > 0 && (
            <div>
              <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-neutral-400">
                Grounded in
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {docs.map((doc) => (
                  <li
                    key={doc}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 text-[12px] text-neutral-600"
                  >
                    <FileText className="size-3 shrink-0" />
                    <span className="truncate">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The claim a cloud assistant cannot make — the reason this runs here. */}
          <p className="flex gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] leading-relaxed text-neutral-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
            {SOVEREIGNTY_NOTE}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-neutral-100 px-6 py-3.5">
          <Button asChild variant="ghost" size="sm">
            <Link href={ROUTES.agentDetail(workspaceId, agent.id)}>
              Versions, vetting and tools
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" className="rounded-lg" onClick={onEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
