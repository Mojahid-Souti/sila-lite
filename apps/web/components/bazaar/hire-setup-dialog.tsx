"use client";

import { TOOL_LABELS } from "@/components/agent/agent-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type BazaarAgentOut, api } from "@/lib/api";
import { connectProvider } from "@/lib/connector-connect";
import { ConnectorIcon } from "@/lib/connector-icons";
import { ROUTES } from "@/lib/constants";
import { ConnectCancelled } from "@/lib/nango";
import { ME_QUERY_KEY } from "@/lib/use-me";
import { useToken } from "@/lib/use-token";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Adaptive hire setup — invisible machinery, per Mojahid. The dialog computes
 * what's missing for THIS hirer (unconnected apps, targets, a docs choice) and
 * renders ONLY that; when nothing is missing it goes straight to a progress
 * state. Provisioning creates the hirer's OWN copy (their accounts, their
 * data) and runs it through the security agent before it can be activated.
 */

type Phase = "setup" | "working" | "done";

type Outcome = "auto_approved" | "ready_for_review" | "rejected" | "failed";

// google-sheets targets accept a pasted URL — extract the id client-side.
function sheetId(raw: string): string {
  const m = raw.match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : raw.trim();
}

/** Docs-picker options: non-empty KBs, newest first, one per name (repeated
 *  test uploads created many identically-named KBs — show only the newest).
 *  O(n log n) over the workspace's KB page. */
function dedupeByName<T extends { name: string; created_at: string; document_count?: number }>(
  items: T[]
): T[] {
  const byName = new Map<string, T>();
  const sorted = [...items]
    .filter((kb) => (kb.document_count ?? 0) > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const kb of sorted) {
    if (!byName.has(kb.name)) byName.set(kb.name, kb);
  }
  return [...byName.values()];
}

export function HireSetupDialog({
  open,
  onClose,
  agent,
  workspaceId,
  token,
  onHired,
}: {
  open: boolean;
  onClose: () => void;
  agent: BazaarAgentOut;
  workspaceId: string;
  token: string;
  onHired?: () => void;
}) {
  const req = agent.requirements;
  const qc = useQueryClient();
  const authToken = useToken();
  const [phase, setPhase] = useState<Phase>("setup");
  const [stageLabel, setStageLabel] = useState("Setting up your copy…");
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [kbChoice, setKbChoice] = useState<string>("skip");
  const [connecting, setConnecting] = useState<string | null>(null);
  const [run, setRun] = useState<{ agentId: string; runId: string } | null>(null);
  const [done, setDone] = useState<{
    agentId: string;
    outcome: Outcome;
    warnings: string[];
  } | null>(null);

  const providers = req?.requires ?? [];
  const needsEmail = req?.needs_email_recipient ?? false;
  const needsDocs = (req?.data_mode ?? "own_docs") === "own_docs" && (req?.docs_count ?? 0) > 0;

  const { data: connectors } = useQuery({
    queryKey: ["connectors", workspaceId],
    queryFn: () => api.connectors.list(workspaceId, token),
    enabled: open && !!token && providers.length > 0,
  });
  const connected = new Set((connectors ?? []).filter((c) => c.connected).map((c) => c.provider));

  const { data: kbs } = useQuery({
    queryKey: ["kbs", workspaceId],
    queryFn: () => api.kb.listKBs(workspaceId, token),
    enabled: open && !!token && needsDocs,
  });

  const { data: me } = useQuery({
    // Same key as lib/use-me.ts — a private "me" key here meant this refetched
    // an identity the app already had cached.
    queryKey: ME_QUERY_KEY,
    queryFn: () => api.auth.me(token) as Promise<{ email?: string }>,
    enabled: open && !!token && (needsEmail || providers.some((p) => p.includes("mail"))),
  });

  // Slack channel options once connected (the channel doubles as the target).
  const slackNeeded = providers.includes("slack");
  const { data: slackChannels } = useQuery({
    queryKey: ["connector-resources", workspaceId, "slack", "channel"],
    queryFn: () => api.connectors.listResources(workspaceId, "slack", "channel", token),
    enabled: open && !!token && slackNeeded && connected.has("slack"),
  });

  const allConnected = providers.every((p) => connected.has(p));
  const emailDefault = me?.email ?? "";

  function targetOf(provider: string): string {
    return targets[provider] ?? (provider.includes("mail") ? emailDefault : "");
  }

  const targetsComplete =
    providers.every((p) => targetOf(p).trim() !== "") &&
    (!needsEmail || (targets.email ?? emailDefault).trim() !== "");
  // Nothing to ask → one click becomes zero clicks (auto-start on open).
  const zeroConfig = providers.length === 0 && !needsEmail && !needsDocs;
  const canStart = allConnected && targetsComplete;

  async function start() {
    setPhase("working");
    setError(null);
    setStageLabel("Setting up your copy…");
    const destinations: Array<Record<string, string>> = [];
    for (const p of providers) {
      const value = targetOf(p).trim();
      if (p === "slack") {
        const label = slackChannels?.find((o) => o.value === value)?.label ?? "";
        destinations.push({ type: "slack", channel_id: value, channel_name: label });
      } else if (p === "google-sheets") {
        destinations.push({ type: "google-sheets", spreadsheet_id: sheetId(value) });
      } else if (p === "google-chat") {
        destinations.push({ type: "google-chat", space: value });
      } else {
        destinations.push({ type: p, to: value }); // gmail / outlook-mail
      }
    }
    if (needsEmail)
      destinations.push({ type: "email", to: (targets.email ?? emailDefault).trim() });
    try {
      const res = await api.hires.provision(
        workspaceId,
        agent.id,
        {
          destinations,
          kb_id: needsDocs && kbChoice !== "skip" ? kbChoice : undefined,
        },
        token
      );
      setStageLabel("Checking it with the security agent…");
      setDone({ agentId: res.agent.id, outcome: "ready_for_review", warnings: res.warnings });
      setRun({ agentId: res.agent.id, runId: res.vetting_run_id });
      onHired?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setPhase("setup");
    }
  }

  // Poll the security scan (same pattern as the publish modal).
  useQuery({
    queryKey: ["hire-vetting", run?.runId],
    queryFn: async () => {
      if (!run) return null;
      const r = await api.vetting.getRun(workspaceId, run.agentId, run.runId, token);
      if (r.status === "completed" || r.status === "failed") {
        setDone((prev) =>
          prev
            ? {
                ...prev,
                outcome:
                  r.status === "failed" ? "failed" : ((r.outcome ?? "ready_for_review") as Outcome),
              }
            : prev
        );
        setRun(null);
        setPhase("done");
        qc.invalidateQueries({ queryKey: ["agents", workspaceId] });
      }
      return r;
    },
    enabled: !!run && !!authToken,
    refetchInterval: 1500,
  });

  // Zero-question hire: open → straight to work (one shot per open).
  const autoStarted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot auto-start; `start` reads current state
  useEffect(() => {
    if (open && zeroConfig && !autoStarted.current) {
      autoStarted.current = true;
      void start();
    }
    if (!open) autoStarted.current = false;
  }, [open, zeroConfig]);

  async function handleConnect(provider: string) {
    setConnecting(provider);
    setError(null);
    try {
      await connectProvider(workspaceId, provider, token);
      await qc.invalidateQueries({ queryKey: ["connectors", workspaceId] });
    } catch (err) {
      if (!(err instanceof ConnectCancelled)) {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    } finally {
      setConnecting(null);
    }
  }

  function close() {
    setPhase("setup");
    setError(null);
    setRun(null);
    setDone(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-neutral-500" />
            Hire {agent.name}
          </DialogTitle>
          <DialogDescription>
            You get your own private copy — it runs with your accounts and your data, never the
            publisher's.
          </DialogDescription>
        </DialogHeader>

        {phase === "setup" && !zeroConfig && (
          <div className="space-y-4">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {(providers.length > 0 || needsEmail) && (
              <div className="space-y-2.5">
                {providers.map((p) => (
                  <div key={p} className="rounded-lg border border-neutral-200 p-3">
                    <div className="flex items-center gap-2">
                      <ConnectorIcon name={p} className="size-4" />
                      <span className="text-sm font-medium text-neutral-800">
                        {TOOL_LABELS[p] ?? p}
                      </span>
                      {connected.has(p) ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-600">
                          <Check className="size-3.5" /> Connected
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnect(p)}
                          disabled={connecting === p}
                          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                        >
                          {connecting === p ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Plug className="size-3" />
                          )}
                          Connect
                        </button>
                      )}
                    </div>
                    {connected.has(p) && (
                      <div className="mt-2">
                        {p === "slack" ? (
                          <Select
                            value={targets.slack ?? ""}
                            onValueChange={(v) => setTargets((t) => ({ ...t, slack: v }))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Pick your channel" />
                            </SelectTrigger>
                            <SelectContent>
                              {(slackChannels ?? []).map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  #{o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <input
                            type="text"
                            value={targetOf(p)}
                            onChange={(e) => setTargets((t) => ({ ...t, [p]: e.target.value }))}
                            placeholder={
                              p === "google-sheets"
                                ? "Paste your spreadsheet link or ID"
                                : p === "google-chat"
                                  ? "Your Chat space"
                                  : "you@company.com"
                            }
                            className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-primary focus:outline-none"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {needsEmail && (
                  <div className="rounded-lg border border-neutral-200 p-3">
                    <p className="mb-2 text-sm font-medium text-neutral-800">
                      Where should it email you?
                    </p>
                    <input
                      type="email"
                      value={targets.email ?? emailDefault}
                      onChange={(e) => setTargets((t) => ({ ...t, email: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {needsDocs && (
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="mb-2 text-sm font-medium text-neutral-800">
                  Which of your documents should it use?
                </p>
                <Select value={kbChoice} onValueChange={setKbChoice}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip — add documents later in Knowledge</SelectItem>
                    {/* Only KBs that actually hold documents (an empty one can't
                        ground anything), newest first, DEDUPED by name — repeated
                        test uploads created many same-named KBs; show the newest. */}
                    {dedupeByName(kbs?.items ?? []).map((kb) => (
                      <SelectItem key={kb.id} value={kb.id}>
                        {kb.name}
                        <span className="ml-1.5 text-neutral-400 text-xs">
                          {kb.document_count} doc{(kb.document_count ?? 0) === 1 ? "" : "s"} ·{" "}
                          {new Date(kb.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {req?.data_mode === "included" && (req?.docs_count ?? 0) > 0 && (
              <p className="text-[12.5px] text-neutral-500">
                Comes with {req?.docs_count} document{(req?.docs_count ?? 0) === 1 ? "" : "s"} —
                you'll get your own copy of the data.
              </p>
            )}

            <button
              type="button"
              disabled={!canStart}
              onClick={() => void start()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary font-medium text-sm text-white hover:bg-primary/90 disabled:border disabled:border-neutral-200 disabled:bg-white disabled:text-neutral-400"
            >
              <Sparkles className="size-4" /> Hire &amp; set up
            </button>
          </div>
        )}

        {(phase === "working" || (phase === "setup" && zeroConfig)) && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-neutral-400" />
            <p className="text-sm font-medium text-neutral-800">{stageLabel}</p>
            <p className="text-xs text-neutral-500">
              Your copy is being prepared and checked — this takes under a minute.
            </p>
          </div>
        )}

        {phase === "done" && done && (
          <div className="space-y-4 py-2">
            {done.outcome === "auto_approved" ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Ready — your copy passed the security check.
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Open it and press Activate to start it on its schedule.
                  </p>
                </div>
              </div>
            ) : done.outcome === "ready_for_review" ? (
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Almost there — a reviewer takes one look first.
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Your copy is created; it can run as soon as a reviewer approves it.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    The security check flagged this copy.
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    It stays paused — open it to see the findings.
                  </p>
                </div>
              </div>
            )}
            {done.warnings.map((w) => (
              <p key={w} className="text-[12.5px] text-amber-700">
                {w}
              </p>
            ))}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-lg border border-neutral-200 px-3.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
              <Link
                href={ROUTES.agentDetail(workspaceId, done.agentId)}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                Open your agent
              </Link>
            </div>
            <p className="text-[11.5px] text-neutral-400">
              Want it different? Open your copy and Customize — documents, targets, and schedule are
              yours to change (changes re-run the security check).
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
